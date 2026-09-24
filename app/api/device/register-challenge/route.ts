import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request
      .json()
      .catch(() => null);

    const deviceId =
      typeof body?.device_id === "string"
        ? body.device_id.trim()
        : "";

    const chipId =
      typeof body?.chip_id === "string"
        ? body.chip_id.trim().toUpperCase()
        : "";

    if (
      !/^PH-7[0-9A-F]{6}$/.test(deviceId) ||
      !/^[0-9A-F]{6}$/.test(chipId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_DEVICE_IDENTITY",
        },
        {
          status: 400,
        },
      );
    }

    if (deviceId !== `PH-7${chipId}`) {
      return NextResponse.json(
        {
          ok: false,
          error: "DEVICE_ID_MISMATCH",
        },
        {
          status: 401,
        },
      );
    }

    const now = new Date().toISOString();

    /*
      Expire old challenges.
    */

    const { error: expireError } =
      await supabase
        .from("device_registration_challenges")
        .update({
          status: "expired",
        })
        .eq("device_id", deviceId)
        .eq("status", "available")
        .lte("expires_at", now);

    if (expireError) {
      console.error(
        "Registration challenge cleanup:",
        expireError,
      );

      return NextResponse.json(
        {
          ok: false,
          error: "CHALLENGE_CLEANUP_FAILED",
        },
        {
          status: 500,
        },
      );
    }

    /*
      Revoke any still-active previous challenge.

      Only one registration challenge may exist
      for a device at a time.
    */

    const { error: revokeError } =
      await supabase
        .from("device_registration_challenges")
        .update({
          status: "revoked",
        })
        .eq("device_id", deviceId)
        .eq("status", "available");

    if (revokeError) {
      console.error(
        "Registration challenge revoke:",
        revokeError,
      );

      return NextResponse.json(
        {
          ok: false,
          error: "CHALLENGE_REVOKE_FAILED",
        },
        {
          status: 500,
        },
      );
    }

    /*
      Generate 256-bit random one-time challenge.

      Database stores ONLY its SHA-256 hash.
    */

    const challenge =
      crypto
        .randomBytes(32)
        .toString("base64url");

    const challengeHash =
      sha256(challenge);

    const expiresAt =
      new Date(
        Date.now() + 2 * 60 * 1000,
      ).toISOString();

    const {
      data,
      error,
    } = await supabase
      .from("device_registration_challenges")
      .insert({
        device_id: deviceId,
        challenge_hash: challengeHash,
        status: "available",
        expires_at: expiresAt,
      })
      .select("id,expires_at")
      .single();

    if (error || !data) {
      console.error(
        "Registration challenge create:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          error: "CHALLENGE_CREATE_FAILED",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,

      challenge_id: data.id,

      challenge,

      expires_at: data.expires_at,
    });
  } catch (error) {
    console.error(
      "REGISTER CHALLENGE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function errorResponse(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status },
  );
}

/* =========================================================
   POST /api/device/bind-discovery

   Authenticated browser endpoint.

   Body:
   {
     pairing_code: string
   }

   Raw temporary pairing code is never stored.
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse(
        "SERVER_CONFIGURATION_ERROR",
        500,
      );
    }

    /* =====================================================
       AUTHENTICATE BROWSER USER
    ===================================================== */

    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(
        "UNAUTHORIZED",
        401,
      );
    }

    const accessToken =
      authHeader.slice(7).trim();

    if (!accessToken) {
      return errorResponse(
        "UNAUTHORIZED",
        401,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(
      accessToken,
    );

    if (userError || !user) {
      return errorResponse(
        "UNAUTHORIZED",
        401,
      );
    }

    /* =====================================================
       REQUEST BODY
    ===================================================== */

    let body: {
      pairing_code?: unknown;
      pairingCode?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "INVALID_BODY",
        400,
      );
    }

    const pairingCode =
      typeof body.pairing_code === "string"
        ? body.pairing_code.trim()
        : typeof body.pairingCode === "string"
          ? body.pairingCode.trim()
          : "";

    if (
      !pairingCode ||
      pairingCode.length < 20 ||
      pairingCode.length > 200
    ) {
      return errorResponse(
        "INVALID_PAIRING_CODE",
        400,
      );
    }

    /* =====================================================
       HASH TEMPORARY PAIRING PROOF

       Must match hashing used by /api/device/register.
    ===================================================== */

    const pairingCodeHash =
      sha256(pairingCode);

    /* =====================================================
       ATOMIC DATABASE BIND
    ===================================================== */

    const {
      data,
      error: bindError,
    } = await supabase.rpc(
      "bind_device_discovery_session",
      {
        p_pairing_code_hash:
          pairingCodeHash,

        p_user_id:
          user.id,
      },
    );

    if (bindError) {
      console.error(
        "DISCOVERY BIND RPC ERROR:",
        bindError,
      );

      return errorResponse(
        "DISCOVERY_BIND_FAILED",
        500,
      );
    }

    if (!data || typeof data !== "object") {
      return errorResponse(
        "INVALID_BIND_RESPONSE",
        500,
      );
    }

    const result = data as {
      ok?: boolean;
      code?: string;
      discovery_session_id?: string;
      device_id?: string;
      expires_at?: string;
    };

    if (!result.ok) {
      switch (result.code) {
        case "PAIRING_SESSION_NOT_FOUND":
          return errorResponse(
            result.code,
            404,
          );

        case "PAIRING_SESSION_UNAVAILABLE":
          return errorResponse(
            result.code,
            410,
          );

        case "PAIRING_SESSION_ALREADY_BOUND":
          return errorResponse(
            result.code,
            409,
          );

        default:
          return errorResponse(
            result.code ??
              "DISCOVERY_BIND_FAILED",
            400,
          );
      }
    }

    return NextResponse.json({
      ok: true,
      code: result.code ?? "BOUND",

      discovery_session_id:
        result.discovery_session_id,

      device_id:
        result.device_id,

      expires_at:
        result.expires_at,
    });
  } catch (error) {
    console.error(
      "BIND DISCOVERY ERROR:",
      error,
    );

    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}
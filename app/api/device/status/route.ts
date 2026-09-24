import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const adminSupabase = createClient(
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

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer,
  );
}

function hmacSha256(
  key: string,
  value: string,
) {
  return crypto
    .createHmac("sha256", key)
    .update(value)
    .digest("hex");
}

export async function POST(
  request: Request,
) {
  try {
    /* ============================================
       AUTH HEADERS
    ============================================ */

    const deviceId =
      request.headers
        .get("x-device-id")
        ?.trim() ?? "";

    const timestamp =
      request.headers
        .get("x-device-timestamp")
        ?.trim() ?? "";

    const nonce =
      request.headers
        .get("x-device-nonce")
        ?.trim() ?? "";

    const signature =
      request.headers
        .get("x-device-signature")
        ?.trim()
        .toLowerCase() ?? "";

    if (
      !deviceId ||
      !timestamp ||
      !nonce ||
      !signature
    ) {
      return NextResponse.json(
        {
          error:
            "Missing device authentication.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      !/^PH-7[0-9A-F]{6}$/.test(deviceId)
    ) {
      return NextResponse.json(
        {
          error: "Invalid device ID.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      !/^[a-f0-9]{64}$/.test(signature)
    ) {
      return NextResponse.json(
        {
          error: "Invalid signature.",
        },
        {
          status: 401,
        },
      );
    }

    /* ============================================
       TIMESTAMP WINDOW

       ESP sends Unix timestamp in seconds.
       Maximum clock drift: 120 seconds.
    ============================================ */

    const timestampNumber =
      Number(timestamp);

    if (
      !Number.isInteger(timestampNumber) ||
      timestampNumber <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid timestamp.",
        },
        {
          status: 401,
        },
      );
    }

    const serverUnix =
      Math.floor(Date.now() / 1000);

    if (
      Math.abs(
        serverUnix - timestampNumber,
      ) > 120
    ) {
      return NextResponse.json(
        {
          error:
            "Device timestamp outside allowed window.",
        },
        {
          status: 401,
        },
      );
    }

    /* ============================================
       READ RAW BODY

       Signature covers EXACT body received.
    ============================================ */

    const rawBody =
      await request.text();

    let body: {
      device_id?: unknown;
      status_data?: unknown;
    };

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof body.device_id !== "string" ||
      body.device_id.trim() !== deviceId
    ) {
      return NextResponse.json(
        {
          error:
            "Device identity mismatch.",
        },
        {
          status: 401,
        },
      );
    }

    /* ============================================
       DEVICE SECRET

       Registry stores SHA256(deviceSecret).

       IMPORTANT:
       Since raw DEVICE_SECRET is not stored server-side,
       the stored secret hash itself is used as the
       operational heartbeat HMAC key.

       Stage-2 must derive:
       heartbeatKey = SHA256(DEVICE_SECRET)
    ============================================ */

    const {
      data: registry,
      error: registryError,
    } = await adminSupabase
      .from("device_registry")
      .select(
        "device_id,device_secret_hash,lifecycle_state",
      )
      .eq("device_id", deviceId)
      .maybeSingle();

    if (registryError) {
      console.error(
        "Registry lookup:",
        registryError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to authenticate device.",
        },
        {
          status: 500,
        },
      );
    }

    if (!registry) {
      return NextResponse.json(
        {
          error: "Unknown device.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      registry.lifecycle_state !==
        "provisioned" &&
      registry.lifecycle_state !== "active"
    ) {
      return NextResponse.json(
        {
          error:
            "Device is not active.",
        },
        {
          status: 403,
        },
      );
    }

    const heartbeatKey =
      registry.device_secret_hash;

    if (
      typeof heartbeatKey !== "string" ||
      !/^[a-f0-9]{64}$/.test(
        heartbeatKey,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Device authentication unavailable.",
        },
        {
          status: 401,
        },
      );
    }

    /* ============================================
       VERIFY HMAC

       Stage-2 canonical string:

       PHANTOM|HEARTBEAT|V1|
       DEVICE_ID|
       TIMESTAMP|
       NONCE|
       SHA256(RAW_BODY)

       HMAC key:
       SHA256(DEVICE_SECRET)
    ============================================ */

    const bodyHash =
      sha256(rawBody);

    const canonical =
      `PHANTOM|HEARTBEAT|V1|${deviceId}|${timestamp}|${nonce}|${bodyHash}`;

    const expectedSignature =
      hmacSha256(
        heartbeatKey,
        canonical,
      );

    if (
      !safeEqual(
        expectedSignature,
        signature,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Device authentication failed.",
        },
        {
          status: 401,
        },
      );
    }

    /* ============================================
       REPLAY PROTECTION
    ============================================ */

    const nonceHash =
      sha256(
        `${deviceId}|${nonce}`,
      );

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
          5 * 60 * 1000,
      );

    /*
      Delete old nonce records opportunistically.
    */

    await adminSupabase
      .from("device_heartbeat_nonces")
      .delete()
      .lt(
        "expires_at",
        now.toISOString(),
      );

    /*
      UNIQUE nonce_hash makes concurrent replay
      attempts fail as well.
    */

    const {
      error: nonceError,
    } = await adminSupabase
      .from("device_heartbeat_nonces")
      .insert({
        device_id: deviceId,
        nonce_hash: nonceHash,
        expires_at:
          expiresAt.toISOString(),
      });

    if (nonceError) {
      if (nonceError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Heartbeat replay detected.",
          },
          {
            status: 409,
          },
        );
      }

      console.error(
        "Heartbeat nonce:",
        nonceError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to authenticate heartbeat.",
        },
        {
          status: 500,
        },
      );
    }

    /* ============================================
       STATUS DATA
    ============================================ */

    const statusData =
      body.status_data &&
      typeof body.status_data === "object" &&
      !Array.isArray(body.status_data)
        ? body.status_data
        : {};

    const nowIso =
      now.toISOString();

    /* ============================================
       DEVICE EXISTS IN APP
    ============================================ */

    const {
      data: device,
      error: deviceError,
    } = await adminSupabase
      .from("devices")
      .select("id,device_id")
      .eq(
        "device_id",
        deviceId,
      )
      .maybeSingle();

    if (deviceError) {
      console.error(
        "Device lookup:",
        deviceError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify device.",
        },
        {
          status: 500,
        },
      );
    }

    /*
      Provisioned but not claimed devices may not
      exist in devices yet.

      Authentication still succeeded, so return OK
      without creating user-facing device state.
    */

    if (!device) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        claimed: false,
        device_id: deviceId,
        server_time: nowIso,
      });
    }

    /* ============================================
       EXISTING STATUS
    ============================================ */

    const {
      data: existingStatus,
      error: existingError,
    } = await adminSupabase
      .from("device_status")
      .select("id")
      .eq(
        "device_id",
        deviceId,
      )
      .order(
        "updated_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Status lookup:",
        existingError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to read device status.",
        },
        {
          status: 500,
        },
      );
    }

    /* ============================================
       UPDATE / INSERT STATUS
    ============================================ */

    if (existingStatus) {
      const {
        error: updateError,
      } = await adminSupabase
        .from("device_status")
        .update({
          online: true,
          last_seen_at: nowIso,
          updated_at: nowIso,
          status_data: statusData,
        })
        .eq(
          "id",
          existingStatus.id,
        );

      if (updateError) {
        console.error(
          "Status update:",
          updateError,
        );

        return NextResponse.json(
          {
            error:
              "Unable to update status.",
          },
          {
            status: 500,
          },
        );
      }
    } else {
      const {
        error: insertError,
      } = await adminSupabase
        .from("device_status")
        .insert({
          device_id: deviceId,
          online: true,
          last_seen_at: nowIso,
          updated_at: nowIso,
          status_data: statusData,
        });

      if (insertError) {
        console.error(
          "Status insert:",
          insertError,
        );

        return NextResponse.json(
          {
            error:
              "Unable to create status.",
          },
          {
            status: 500,
          },
        );
      }
    }

    await adminSupabase
      .from("devices")
      .update({
        is_online: true,
        last_seen_at: nowIso,
      })
      .eq(
        "device_id",
        deviceId,
      );

    return NextResponse.json({
      success: true,
      authenticated: true,
      claimed: true,
      device_id: deviceId,
      server_time: nowIso,
    });
  } catch (error) {
    console.error(
      "Device status API:",
      error,
    );

    return NextResponse.json(
      {
        error: "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }
}
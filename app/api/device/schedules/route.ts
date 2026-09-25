import {
  NextRequest,
  NextResponse,
} from "next/server";
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

/* =====================================================
   TYPES
===================================================== */

type DeviceScheduleRow = {
  id: string;
  device_id: string;
  control_id: string;
  on_time: string;
  off_time: string;
  days_mask: number;
  timezone: string;
  enabled: boolean;
};

/* =====================================================
   CRYPTO HELPERS
===================================================== */

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
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

function safeEqual(
  a: string,
  b: string,
) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);

  if (x.length !== y.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    x,
    y,
  );
}

/* =====================================================
   RESPONSE HELPER
===================================================== */

function error(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

/* =====================================================
   DEVICE AUTHENTICATION

   Headers:
   x-device-id
   x-device-timestamp
   x-device-nonce
   x-device-signature

   Canonical:
   PHANTOM|SCHEDULE|V1|GET|
   deviceId|timestamp|nonce|sha256("")
===================================================== */

async function authenticateDevice(
  request: NextRequest,
) {
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
    !/^PH-7[0-9A-F]{6}$/.test(
      deviceId,
    ) ||
    !timestamp ||
    !nonce ||
    !/^[a-f0-9]{64}$/.test(
      signature,
    )
  ) {
    return {
      ok: false as const,

      response: error(
        "Invalid device authentication.",
        401,
      ),
    };
  }

  /* -----------------------------
     TIMESTAMP VALIDATION
  ----------------------------- */

  const unix =
    Number(timestamp);

  if (
    !Number.isInteger(unix) ||
    Math.abs(
      Math.floor(
        Date.now() / 1000,
      ) - unix,
    ) > 120
  ) {
    return {
      ok: false as const,

      response: error(
        "Invalid or expired timestamp.",
        401,
      ),
    };
  }

  /* -----------------------------
     DEVICE REGISTRY
  ----------------------------- */

  const {
    data: registry,
    error: registryError,
  } = await supabase
    .from("device_registry")
    .select(
      `
      device_secret_hash,
      lifecycle_state
      `,
    )
    .eq(
      "device_id",
      deviceId,
    )
    .maybeSingle();

  if (
    registryError ||
    !registry ||
    ![
      "active",
      "provisioned",
    ].includes(
      registry.lifecycle_state,
    )
  ) {
    return {
      ok: false as const,

      response: error(
        "Device authentication failed.",
        401,
      ),
    };
  }

  /* -----------------------------
     SIGNATURE
  ----------------------------- */

  const bodyHash =
    sha256("");

  const canonical =
    `PHANTOM|SCHEDULE|V1|GET|${deviceId}|${timestamp}|${nonce}|${bodyHash}`;

  /*
   * IMPORTANT:
   *
   * Same operational key convention
   * already used by heartbeat/commands:
   *
   * device_secret_hash is the
   * 64-character lowercase hex string
   * and is used as UTF-8 HMAC key.
   */

  const expected =
    hmacSha256(
      registry.device_secret_hash,
      canonical,
    );

  if (
    !safeEqual(
      expected,
      signature,
    )
  ) {
    return {
      ok: false as const,

      response: error(
        "Device signature invalid.",
        401,
      ),
    };
  }

  /* -----------------------------
     REPLAY PROTECTION
  ----------------------------- */

  const nonceHash =
    sha256(
      `SCHEDULE|${deviceId}|${nonce}`,
    );

  /*
   * Opportunistic cleanup.
   * Prevents nonce table from growing
   * forever even if heartbeat traffic
   * is unavailable.
   */

  await supabase
    .from(
      "device_heartbeat_nonces",
    )
    .delete()
    .eq(
      "device_id",
      deviceId,
    )
    .lt(
      "expires_at",
      new Date().toISOString(),
    );

  const {
    error: nonceError,
  } = await supabase
    .from(
      "device_heartbeat_nonces",
    )
    .insert({
      device_id:
        deviceId,

      nonce_hash:
        nonceHash,

      expires_at:
        new Date(
          Date.now() +
            5 * 60 * 1000,
        ).toISOString(),
    });

  if (nonceError) {
    if (
      nonceError.code ===
      "23505"
    ) {
      return {
        ok: false as const,

        response: error(
          "Device request replay detected.",
          409,
        ),
      };
    }

    console.error(
      "Schedule nonce:",
      nonceError,
    );

    return {
      ok: false as const,

      response: error(
        "Device authentication failed.",
        500,
      ),
    };
  }

  return {
    ok: true as const,
    deviceId,
  };
}

/* =====================================================
   NORMALIZE TIME

   PostgreSQL TIME may arrive as:
   14:00:00

   ESP only needs:
   14:00
===================================================== */

function compactTime(
  value: string,
) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

/* =====================================================
   GET SCHEDULES - ESP

   ESP flow:

   GET /api/device/schedules

   ->
   Verify device HMAC

   ->
   Verify device security state

   ->
   Verify active ownership

   ->
   Read device-wide schedule revision

   ->
   Return complete enabled snapshot

   ->
   ESP replaces schedule RAM snapshot
===================================================== */

export async function GET(
  request: NextRequest,
) {
  const auth =
    await authenticateDevice(
      request,
    );

  if (!auth.ok) {
    return auth.response;
  }

  /* -----------------------------
     SECURITY STATE
  ----------------------------- */

  const {
    data: security,
    error: securityError,
  } = await supabase
    .from(
      "device_security_state",
    )
    .select("state")
    .eq(
      "device_id",
      auth.deviceId,
    )
    .maybeSingle();

  if (securityError) {
    console.error(
      "Schedule security:",
      securityError,
    );

    return error(
      "Unable to verify device security.",
      500,
    );
  }

  if (
    security?.state &&
    security.state !== "active"
  ) {
    return error(
      "Device schedule sync is blocked.",
      423,
    );
  }

  /* -----------------------------
     VERIFY DEVICE IS CLAIMED

     Schedules should not be sent to
     an unclaimed/provisioned device.
  ----------------------------- */

  const {
    data: ownership,
    error: ownershipError,
  } = await supabase
    .from(
      "device_ownerships",
    )
    .select("id")
    .eq(
      "device_id",
      auth.deviceId,
    )
    .eq(
      "is_active",
      true,
    )
    .maybeSingle();

  if (ownershipError) {
    console.error(
      "Schedule ownership:",
      ownershipError,
    );

    return error(
      "Unable to verify device ownership.",
      500,
    );
  }

  if (!ownership) {
    return NextResponse.json({
      success: true,

      device_id:
        auth.deviceId,

      version: 0,

      count: 0,

      schedules: [],

      server_time:
        new Date().toISOString(),
    });
  }

  /* -----------------------------
     DEVICE-WIDE SCHEDULE REVISION

     This revision survives an empty
     enabled-schedule result.

     Therefore:
     - insert
     - edit
     - enable
     - disable
     - delete

     all invalidate the ESP snapshot.
  ----------------------------- */

  const {
    data: revisionRow,
    error: revisionError,
  } = await supabase
    .from(
      "device_schedule_revisions",
    )
    .select("revision")
    .eq(
      "device_id",
      auth.deviceId,
    )
    .maybeSingle();

  if (revisionError) {
    console.error(
      "Schedule revision:",
      revisionError,
    );

    return error(
      "Unable to fetch schedule revision.",
      500,
    );
  }

  const version =
    revisionRow
      ? Number(revisionRow.revision)
      : 0;

  if (
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    console.error(
      "Invalid schedule revision:",
      revisionRow?.revision,
    );

    return error(
      "Invalid schedule revision.",
      500,
    );
  }

  /* -----------------------------
     FETCH COMPLETE ENABLED SNAPSHOT

     Disabled/deleted schedules are
     intentionally absent.

     ESP must REPLACE its existing RAM
     snapshot when revision changes.
  ----------------------------- */

  const {
    data,
    error: scheduleError,
  } = await supabase
    .from(
      "device_schedules",
    )
    .select(
      `
      id,
      device_id,
      control_id,
      on_time,
      off_time,
      days_mask,
      timezone,
      enabled
      `,
    )
    .eq(
      "device_id",
      auth.deviceId,
    )
    .eq(
      "enabled",
      true,
    )
    .order(
      "control_id",
      {
        ascending: true,
      },
    )
    .order(
      "on_time",
      {
        ascending: true,
      },
    );

  if (scheduleError) {
    console.error(
      "Schedule fetch:",
      scheduleError,
    );

    return error(
      "Unable to fetch schedules.",
      500,
    );
  }

  const rows =
    (data ?? []) as
      DeviceScheduleRow[];

  /* -----------------------------
     COMPACT ESP PAYLOAD

     id  = schedule UUID
     c   = control_id
     on  = HH:MM
     off = HH:MM
     d   = 7-bit days mask
     tz  = timezone
  ----------------------------- */

  const schedules =
    rows.map((row) => ({
      id:
        row.id,

      c:
        row.control_id,

      on:
        compactTime(
          row.on_time,
        ),

      off:
        compactTime(
          row.off_time,
        ),

      d:
        row.days_mask,

      tz:
        row.timezone,
    }));

  return NextResponse.json({
    success: true,

    device_id:
      auth.deviceId,

    version,

    count:
      schedules.length,

    schedules,

    server_time:
      new Date().toISOString(),
  });
}
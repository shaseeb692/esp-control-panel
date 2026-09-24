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

function hmacSha256(
  key: string,
  value: string,
) {
  return crypto
    .createHmac("sha256", key)
    .update(value)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);

  if (x.length !== y.length) {
    return false;
  }

  return crypto.timingSafeEqual(x, y);
}

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

async function authenticateDevice(
  request: NextRequest,
  bodyHash: string,
  method: string,
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
    !/^PH-7[0-9A-F]{6}$/.test(deviceId) ||
    !timestamp ||
    !nonce ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return {
      ok: false as const,
      response: error(
        "Invalid device authentication.",
        401,
      ),
    };
  }

  const unix =
    Number(timestamp);

  if (
    !Number.isInteger(unix) ||
    Math.abs(
      Math.floor(Date.now() / 1000) -
        unix,
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

  const {
    data: registry,
    error: registryError,
  } = await supabase
    .from("device_registry")
    .select(
      "device_secret_hash,lifecycle_state",
    )
    .eq("device_id", deviceId)
    .maybeSingle();

  if (
    registryError ||
    !registry ||
    !["active", "provisioned"].includes(
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

  const canonical =
    `PHANTOM|COMMAND|V1|${method}|${deviceId}|${timestamp}|${nonce}|${bodyHash}`;

  const expected =
    hmacSha256(
      registry.device_secret_hash,
      canonical,
    );

  if (!safeEqual(expected, signature)) {
    return {
      ok: false as const,
      response: error(
        "Device signature invalid.",
        401,
      ),
    };
  }

  const nonceHash =
    sha256(
      `COMMAND|${deviceId}|${nonce}`,
    );

  /*
   * Reuse heartbeat nonce table.
   * Prefix in nonce hash separates command
   * authentication from heartbeat authentication.
   */
  const {
    error: nonceError,
  } = await supabase
    .from("device_heartbeat_nonces")
    .insert({
      device_id: deviceId,
      nonce_hash: nonceHash,
      expires_at: new Date(
        Date.now() + 5 * 60 * 1000,
      ).toISOString(),
    });

  if (nonceError) {
    if (nonceError.code === "23505") {
      return {
        ok: false as const,
        response: error(
          "Device request replay detected.",
          409,
        ),
      };
    }

    console.error(
      "Command nonce:",
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
   GET PENDING COMMANDS — ESP
===================================================== */

export async function GET(
  request: NextRequest,
) {
  const emptyBodyHash =
    sha256("");

  const auth =
    await authenticateDevice(
      request,
      emptyBodyHash,
      "GET",
    );

  if (!auth.ok) {
    return auth.response;
  }

  const {
    data: security,
    error: securityError,
  } = await supabase
    .from("device_security_state")
    .select("state")
    .eq(
      "device_id",
      auth.deviceId,
    )
    .maybeSingle();

  if (securityError) {
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
      "Device commands are blocked.",
      423,
    );
  }

  const {
    data,
    error: commandError,
  } = await supabase
    .from("device_commands")
    .select(
      "id,command,status,created_at",
    )
    .eq(
      "device_id",
      auth.deviceId,
    )
    .eq("status", "pending")
    .order("created_at", {
      ascending: true,
    })
    .limit(20);

  if (commandError) {
    console.error(
      "Command fetch:",
      commandError,
    );

    return error(
      "Unable to fetch commands.",
      500,
    );
  }

  return NextResponse.json({
    success: true,
    device_id: auth.deviceId,
    commands: data ?? [],
    server_time:
      new Date().toISOString(),
  });
}

/* =====================================================
   PATCH COMMAND ACK — ESP
===================================================== */

export async function PATCH(
  request: NextRequest,
) {
  const rawBody =
    await request.text();

  const auth =
    await authenticateDevice(
      request,
      sha256(rawBody),
      "PATCH",
    );

  if (!auth.ok) {
    return auth.response;
  }

  let body: {
    command_id?: unknown;
    status?: unknown;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return error(
      "Invalid JSON.",
      400,
    );
  }

  const commandId =
    typeof body.command_id === "string"
      ? body.command_id.trim()
      : "";

  const status =
    typeof body.status === "string"
      ? body.status.trim()
      : "";

  if (!commandId) {
    return error(
      "command_id is required.",
      400,
    );
  }

  if (
    status !== "completed" &&
    status !== "failed"
  ) {
    return error(
      "Invalid command status.",
      400,
    );
  }

  /*
   * Device can ACK only its OWN command.
   */
  const {
    data,
    error: updateError,
  } = await supabase
    .from("device_commands")
    .update({
      status,
    })
    .eq("id", commandId)
    .eq(
      "device_id",
      auth.deviceId,
    )
    .eq("status", "pending")
    .select("id,status")
    .maybeSingle();

  if (updateError) {
    console.error(
      "Command ACK:",
      updateError,
    );

    return error(
      "Unable to update command.",
      500,
    );
  }

  if (!data) {
    return error(
      "Pending command not found.",
      404,
    );
  }

  return NextResponse.json({
    success: true,
    device_id: auth.deviceId,
    command: data,
  });
}
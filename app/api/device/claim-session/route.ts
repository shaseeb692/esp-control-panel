import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/* =========================================================
   CONFIG
========================================================= */

const CLAIM_TOKEN_LIFETIME_MINUTES = 10;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/* =========================================================
   HELPERS
========================================================= */

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function generateClaimToken() {
  // 32 random bytes = 256 bits entropy.
  return `claim_${crypto.randomBytes(32).toString("base64url")}`;
}

/* =========================================================
   POST /api/device/claim-session

   Device authentication:
     x-device-id
     x-device-secret

   Returns:
     short-lived one-time claim token

   IMPORTANT:
     Permanent device secret is NEVER returned.
========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* -----------------------------------------------------
       1. Environment
    ----------------------------------------------------- */

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "[claim-session] Missing Supabase server environment variables.",
      );

      return jsonResponse(
        {
          ok: false,
          error: "SERVER_CONFIGURATION_ERROR",
          message: "Server configuration is incomplete.",
        },
        500,
      );
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    /* -----------------------------------------------------
       2. Read device credentials

       Never put DEVICE_SECRET in URL/query string.
    ----------------------------------------------------- */

    const deviceId =
      request.headers.get("x-device-id")?.trim() ?? "";

    const deviceSecret =
      request.headers.get("x-device-secret")?.trim() ?? "";

    if (!deviceId || !deviceSecret) {
      return jsonResponse(
        {
          ok: false,
          error: "DEVICE_AUTH_REQUIRED",
          message:
            "Device ID and device secret are required.",
        },
        401,
      );
    }

    if (deviceId.length > 200 || deviceSecret.length > 500) {
      return jsonResponse(
        {
          ok: false,
          error: "INVALID_DEVICE_CREDENTIALS",
          message: "Invalid device credentials.",
        },
        400,
      );
    }

    /* -----------------------------------------------------
       3. Check device registry first
    ----------------------------------------------------- */

    const {
      data: registryDevice,
      error: registryError,
    } = await supabase
      .from("device_registry")
      .select(
        `
          device_id,
          lifecycle_state,
          hardware_model,
          firmware_version
        `,
      )
      .eq("device_id", deviceId)
      .maybeSingle();

    if (registryError) {
      console.error(
        "[claim-session] Registry lookup failed:",
        registryError,
      );

      return jsonResponse(
        {
          ok: false,
          error: "REGISTRY_LOOKUP_FAILED",
          message: "Could not verify device.",
        },
        500,
      );
    }

    if (!registryDevice) {
      return jsonResponse(
        {
          ok: false,
          error: "DEVICE_NOT_REGISTERED",
          message: "This device is not registered.",
        },
        404,
      );
    }

    /* -----------------------------------------------------
       4. Lifecycle protection
    ----------------------------------------------------- */

    if (
      registryDevice.lifecycle_state !== "provisioned" &&
      registryDevice.lifecycle_state !== "active"
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "DEVICE_NOT_ACTIVE",
          message:
            "This device cannot create a claim session.",
        },
        423,
      );
    }

    /* -----------------------------------------------------
       5. Verify unique per-device secret

       Database function hashes incoming raw secret and
       compares it with device_registry.device_secret_hash.

       Raw secret is never stored by this API.
    ----------------------------------------------------- */

    const {
      data: secretValid,
      error: secretError,
    } = await supabase.rpc("verify_device_secret", {
      p_device_id: deviceId,
      p_device_secret: deviceSecret,
    });

    if (secretError) {
      console.error(
        "[claim-session] Device authentication RPC failed:",
        secretError,
      );

      return jsonResponse(
        {
          ok: false,
          error: "DEVICE_AUTH_FAILED",
          message: "Could not authenticate device.",
        },
        500,
      );
    }

    if (secretValid !== true) {
      return jsonResponse(
        {
          ok: false,
          error: "INVALID_DEVICE_CREDENTIALS",
          message: "Invalid device credentials.",
        },
        401,
      );
    }

    /* -----------------------------------------------------
       6. Check device security state

       If no row exists yet, we allow a provisioned device.

       If a row exists and is not ACTIVE, claim QR issuance
       is blocked.
    ----------------------------------------------------- */

    const {
      data: securityState,
      error: securityError,
    } = await supabase
      .from("device_security_state")
      .select("*")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (securityError) {
      console.error(
        "[claim-session] Security-state lookup failed:",
        securityError,
      );

      return jsonResponse(
        {
          ok: false,
          error: "SECURITY_STATE_CHECK_FAILED",
          message: "Could not verify device security state.",
        },
        500,
      );
    }

    if (securityState) {
      /*
       * Different schema versions may call the column
       * "state" or "security_state".
       */
      const rawState =
        securityState.security_state ??
        securityState.state ??
        "active";

      const normalizedState = String(rawState).toLowerCase();

      if (normalizedState !== "active") {
        return jsonResponse(
          {
            ok: false,
            error: "DEVICE_SECURITY_LOCKED",
            message:
              "Device claim is disabled by its security state.",
            security_state: normalizedState,
          },
          423,
        );
      }
    }

    /* -----------------------------------------------------
       7. Generate temporary RAW claim token

       RAW:
         sent back to authenticated physical device

       HASH:
         stored in Supabase

       Database compromise therefore does not reveal an
       immediately usable claim token.
    ----------------------------------------------------- */

    const rawToken = generateClaimToken();
    const tokenHash = sha256(rawToken);

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() +
        CLAIM_TOKEN_LIFETIME_MINUTES * 60 * 1000,
    );

    /* -----------------------------------------------------
       8. Revoke previous unused tokens for this device

       Only newest QR/session remains usable.
    ----------------------------------------------------- */

    const {
      error: revokeError,
    } = await supabase.rpc(
      "revoke_device_claim_tokens",
      {
        p_device_id: deviceId,
      },
    );

    if (revokeError) {
      console.error(
        "[claim-session] Could not revoke old tokens:",
        revokeError,
      );

      return jsonResponse(
        {
          ok: false,
          error: "TOKEN_ROTATION_FAILED",
          message:
            "Could not prepare a new claim session.",
        },
        500,
      );
    }

    /* -----------------------------------------------------
       9. Store HASH only
    ----------------------------------------------------- */

    const {
      error: insertError,
    } = await supabase
      .from("device_claim_tokens")
      .insert({
        device_id: deviceId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error(
        "[claim-session] Claim token insert failed:",
        insertError,
      );

      return jsonResponse(
        {
          ok: false,
          error: "CLAIM_SESSION_CREATE_FAILED",
          message:
            "Could not create device claim session.",
        },
        500,
      );
    }

    /* -----------------------------------------------------
       10. Return RAW temporary token

       IMPORTANT:
       DEVICE_SECRET is NOT returned.
    ----------------------------------------------------- */

    return jsonResponse({
      ok: true,

      device_id: deviceId,

      claim_token: rawToken,

      expires_at: expiresAt.toISOString(),

      expires_in_seconds:
        CLAIM_TOKEN_LIFETIME_MINUTES * 60,

      claim: {
        one_time: true,
        expires_in_minutes:
          CLAIM_TOKEN_LIFETIME_MINUTES,
      },
    });
  } catch (error) {
    console.error(
      "[claim-session] Unexpected error:",
      error,
    );

    return jsonResponse(
      {
        ok: false,
        error: "INTERNAL_SERVER_ERROR",
        message:
          "Unexpected error while creating claim session.",
      },
      500,
    );
  }
}
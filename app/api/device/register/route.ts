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
  }
);

const FACTORY_HMAC_KEY = process.env.PHANTOM_FACTORY_HMAC_KEY;
const MAP_VERSION = "MAP-V1";

const MAP_V1: Record<string, string> = {
  A: "001acd",
  B: "b7x91",
  C: "c4p8z",
  D: "d82mn",
  E: "e5q71",
  F: "021gb9",
  G: "g73wp",
  H: "h19zr",
  I: "i64bx",
  J: "j27qm",
  K: "k85tn",
  L: "l43rv",
  M: "7mq2x",
  N: "n91vk",
  O: "0op7x",
  P: "p61bz",
  Q: "q28mc",
  R: "r94qx",
  S: "s52kn",
  T: "t83mz",
  U: "u47kp",
  V: "v62zr",
  W: "w39px",
  X: "x74qb",
  Y: "8wy4n",
  Z: "z3k81",

  "0": "0zx71",
  "1": "mkg",
  "2": "abk",
  "3": "tyx",
  "4": "4pv82",
  "5": "5qr19",
  "6": "6xn43",
  "7": "7bk95",
  "8": "8mz26",
  "9": "a0g",
};

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function hmacSha256(value: string) {
  if (!FACTORY_HMAC_KEY) {
    throw new Error("FACTORY_HMAC_KEY_NOT_CONFIGURED");
  }

  return crypto
    .createHmac("sha256", FACTORY_HMAC_KEY)
    .update(value)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function buildDeviceSecretId(
  hmac: string,
  chipId: string
) {
  const parts: string[] = [];

  for (let i = 0; i < 8; i++) {
    parts.push(
      hmac.substring(i * 8, i * 8 + 8)
    );

    if (i < 6) {
      const character = chipId[i];

      const mapped = MAP_V1[character];

      if (!mapped) {
        throw new Error("INVALID_MAP_CHARACTER");
      }

      parts.push(mapped);
    }
  }

  return parts.join("-");
}

export async function POST(request: NextRequest) {
  try {
    /*
    |--------------------------------------------------------------------------
    | SERVER CONFIG
    |--------------------------------------------------------------------------
    */

    if (!FACTORY_HMAC_KEY) {
      console.error(
        "PHANTOM_FACTORY_HMAC_KEY is not configured"
      );

      return NextResponse.json(
        {
          ok: false,
          error: "SERVER_CONFIGURATION_ERROR",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | READ DEVICE PAYLOAD
    |--------------------------------------------------------------------------
    */

    const body = await request
      .json()
      .catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_JSON",
        },
        {
          status: 400,
        }
      );
    }

    const deviceId =
      typeof body.device_id === "string"
        ? body.device_id.trim()
        : "";

    const chipId =
      typeof body.chip_id === "string"
        ? body.chip_id.trim().toUpperCase()
        : "";

    const deviceSecret =
      typeof body.device_secret === "string"
        ? body.device_secret.trim().toLowerCase()
        : "";

    const deviceSecretId =
      typeof body.device_secret_id === "string"
        ? body.device_secret_id.trim().toLowerCase()
        : "";

    const mapVersion =
      typeof body.map_version === "string"
        ? body.map_version.trim()
        : "";

    const hardwareModel =
      typeof body.hardware_model === "string"
        ? body.hardware_model.trim()
        : "ESP8266";

    const firmwareVersion =
      typeof body.firmware_version === "string"
        ? body.firmware_version.trim()
        : null;

    /*
    |--------------------------------------------------------------------------
    | BASIC VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !deviceId ||
      !chipId ||
      !deviceSecret ||
      !deviceSecretId ||
      !mapVersion
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_IDENTITY_FIELDS",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^[0-9A-F]{6}$/.test(chipId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_CHIP_ID",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^[a-f0-9]{64}$/.test(deviceSecret)) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_DEVICE_SECRET",
        },
        {
          status: 400,
        }
      );
    }

    if (mapVersion !== MAP_VERSION) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNSUPPORTED_MAP_VERSION",
        },
        {
          status: 400,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DEVICE ID ↔ CHIP ID BINDING
    |--------------------------------------------------------------------------
    */

    const expectedDeviceId =
      `PH-7${chipId}`;

    if (deviceId !== expectedDeviceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "DEVICE_ID_MISMATCH",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FACTORY HMAC VERIFICATION
    |--------------------------------------------------------------------------
    |
    | Same canonical string as Birth Firmware:
    |
    | PHANTOM|V1|DEVICE_ID|CHIP_ID|DEVICE_SECRET
    |
    */

    const canonical =
      `PHANTOM|V1|${deviceId}|${chipId}|${deviceSecret}`;

    const expectedHmac =
      hmacSha256(canonical);

    const expectedDeviceSecretId =
      buildDeviceSecretId(
        expectedHmac,
        chipId
      ).toLowerCase();

    if (
      !safeEqual(
        expectedDeviceSecretId,
        deviceSecretId
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "FACTORY_IDENTITY_VERIFICATION_FAILED",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | HASH SECRETS
    |--------------------------------------------------------------------------
    |
    | Raw DEVICE_SECRET is never stored.
    |
    */

    const deviceSecretHash =
      sha256(deviceSecret);

    const deviceSecretIdHash =
      sha256(deviceSecretId);

    /*
    |--------------------------------------------------------------------------
    | CHECK EXISTING FACTORY RECORD
    |--------------------------------------------------------------------------
    */

    const {
      data: existingFactory,
      error: factoryReadError,
    } = await supabase
      .from("device_factory_registrations")
      .select(
        `
        device_id,
        chip_id,
        device_secret_id_hash,
        verified
        `
      )
      .eq("device_id", deviceId)
      .maybeSingle();

    if (factoryReadError) {
      console.error(
        "Factory lookup:",
        factoryReadError
      );

      return NextResponse.json(
        {
          ok: false,
          error: "FACTORY_LOOKUP_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | PREVENT IDENTITY REPLACEMENT
    |--------------------------------------------------------------------------
    */

    if (existingFactory) {
      if (
        existingFactory.chip_id !== chipId ||
        !safeEqual(
          existingFactory.device_secret_id_hash,
          deviceSecretIdHash
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "FACTORY_IDENTITY_CONFLICT",
          },
          {
            status: 409,
          }
        );
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE LAST SEEN
      |--------------------------------------------------------------------------
      */

      const { error: updateFactoryError } =
        await supabase
          .from(
            "device_factory_registrations"
          )
          .update({
            verified: true,
            verified_at: new Date().toISOString(),
            last_seen_at:
              new Date().toISOString(),
          })
          .eq("device_id", deviceId);

      if (updateFactoryError) {
        console.error(
          "Factory update:",
          updateFactoryError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "FACTORY_UPDATE_FAILED",
          },
          {
            status: 500,
          }
        );
      }
    } else {
      /*
      |--------------------------------------------------------------------------
      | FIRST EVER INTERNET REGISTRATION
      |--------------------------------------------------------------------------
      |
      | AUTOMATIC.
      | No manual device DB row.
      |
      */

      const { error: factoryInsertError } =
        await supabase
          .from(
            "device_factory_registrations"
          )
          .insert({
            device_id: deviceId,
            chip_id: chipId,

            map_version: MAP_VERSION,

            device_secret_id_hash:
              deviceSecretIdHash,

            verified: true,

            verified_at:
              new Date().toISOString(),

            first_seen_at:
              new Date().toISOString(),

            last_seen_at:
              new Date().toISOString(),
          });

      if (factoryInsertError) {
        console.error(
          "Factory insert:",
          factoryInsertError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "FACTORY_REGISTRATION_FAILED",
          },
          {
            status: 500,
          }
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | AUTO PROVISION INTO DEVICE REGISTRY
    |--------------------------------------------------------------------------
    |
    | Calls SQL function from migration 07.
    |
    */

    const {
      error: provisionError,
    } = await supabase.rpc(
      "auto_provision_verified_device",
      {
        p_device_id: deviceId,

        p_chip_id: chipId,

        p_device_secret_hash:
          deviceSecretHash,

        p_device_secret_id_hash:
          deviceSecretIdHash,

        p_hardware_model:
          hardwareModel,

        p_firmware_version:
          firmwareVersion,
      }
    );

    if (provisionError) {
      console.error(
        "Auto provision:",
        provisionError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "AUTO_PROVISION_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK OWNERSHIP
    |--------------------------------------------------------------------------
    */

    const {
      data: ownership,
      error: ownershipError,
    } = await supabase
      .from("device_ownership")
      .select(
        "owner_user_id,status"
      )
      .eq("device_id", deviceId)
      .eq("status", "active")
      .maybeSingle();

    if (ownershipError) {
      console.error(
        "Ownership:",
        ownershipError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "OWNERSHIP_LOOKUP_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DEVICE ALREADY CLAIMED
    |--------------------------------------------------------------------------
    */

    if (ownership) {
      return NextResponse.json({
        ok: true,

        device_id: deviceId,

        factory_verified: true,

        registered: true,

        claimed: true,

        discovery_available: false,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | EXPIRE OLD DISCOVERY SESSIONS
    |--------------------------------------------------------------------------
    */

    const now =
      new Date().toISOString();

    const { error: expireError } =
      await supabase
        .from(
          "device_discovery_sessions"
        )
        .update({
          status: "expired",
        })
        .eq("device_id", deviceId)
        .eq("status", "available")
        .lte("expires_at", now);

    if (expireError) {
      console.error(
        "Discovery cleanup:",
        expireError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "DISCOVERY_CLEANUP_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK ACTIVE DISCOVERY SESSION
    |--------------------------------------------------------------------------
    */

    const {
      data: activeSession,
      error: activeSessionError,
    } = await supabase
      .from(
        "device_discovery_sessions"
      )
      .select("id,expires_at")
      .eq("device_id", deviceId)
      .eq("status", "available")
      .gt("expires_at", now)
      .maybeSingle();

    if (activeSessionError) {
      console.error(
        "Discovery lookup:",
        activeSessionError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "DISCOVERY_LOOKUP_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | EXISTING SESSION
    |--------------------------------------------------------------------------
    |
    | We don't know its original raw pairing code because only
    | its hash is stored.
    |
    | Revoke it and generate a fresh code for this authenticated
    | device registration.
    |
    */

    if (activeSession) {
      const { error: revokeError } =
        await supabase
          .from(
            "device_discovery_sessions"
          )
          .update({
            status: "revoked",
          })
          .eq("id", activeSession.id);

      if (revokeError) {
        console.error(
          "Discovery revoke:",
          revokeError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "DISCOVERY_REVOKE_FAILED",
          },
          {
            status: 500,
          }
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE TEMPORARY DISCOVERY CODE
    |--------------------------------------------------------------------------
    */

    const pairingCode =
      crypto
        .randomBytes(24)
        .toString("base64url");

    const pairingCodeHash =
      sha256(pairingCode);

    const expiresAt =
      new Date(
        Date.now() +
          10 * 60 * 1000
      ).toISOString();

    const {
      data: discoverySession,
      error: discoveryError,
    } = await supabase
      .from(
        "device_discovery_sessions"
      )
      .insert({
        device_id: deviceId,

        pairing_code_hash:
          pairingCodeHash,

        status: "available",

        expires_at: expiresAt,
      })
      .select(
        "id,expires_at"
      )
      .single();

    if (discoveryError) {
      console.error(
        "Discovery create:",
        discoveryError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "DISCOVERY_SESSION_CREATE_FAILED",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | RESPONSE TO ESP
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      ok: true,

      device_id: deviceId,

      factory_verified: true,

      registered: true,

      claimed: false,

      discovery_available: true,

      discovery_session_id:
        discoverySession.id,

      pairing_code:
        pairingCode,

      expires_at:
        discoverySession.expires_at,
    });
  } catch (error) {
    console.error(
      "DEVICE REGISTER ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}
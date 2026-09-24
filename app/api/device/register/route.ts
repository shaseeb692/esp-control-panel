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

const FACTORY_HMAC_KEY =
  process.env.PHANTOM_FACTORY_HMAC_KEY;

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

function hmacSha256(
  value: string,
  key?: string,
) {
  const hmacKey =
    key ?? FACTORY_HMAC_KEY;

  if (!hmacKey) {
    throw new Error(
      "FACTORY_HMAC_KEY_NOT_CONFIGURED",
    );
  }

  return crypto
    .createHmac("sha256", hmacKey)
    .update(value)
    .digest("hex");
}

function safeEqual(
  a: string,
  b: string,
) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (
    aBuffer.length !== bBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer,
  );
}

function buildDeviceSecretId(
  hmac: string,
  chipId: string,
) {
  const parts: string[] = [];

  for (let i = 0; i < 8; i++) {
    parts.push(
      hmac.substring(
        i * 8,
        i * 8 + 8,
      ),
    );

    if (i < 6) {
      const character =
        chipId[i];

      const mapped =
        MAP_V1[character];

      if (!mapped) {
        throw new Error(
          "INVALID_MAP_CHARACTER",
        );
      }

      parts.push(mapped);
    }
  }

  return parts.join("-");
}

function jsonError(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    {
      status,
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    /* ================================================
       SERVER CONFIG
    ================================================= */

    if (!FACTORY_HMAC_KEY) {
      console.error(
        "PHANTOM_FACTORY_HMAC_KEY is not configured",
      );

      return jsonError(
        "SERVER_CONFIGURATION_ERROR",
        500,
      );
    }

    /* ================================================
       READ PAYLOAD
    ================================================= */

    const body = await request
      .json()
      .catch(() => null);

    if (!body) {
      return jsonError(
        "INVALID_JSON",
        400,
      );
    }

    const deviceId =
      typeof body.device_id === "string"
        ? body.device_id.trim()
        : "";

    const chipId =
      typeof body.chip_id === "string"
        ? body.chip_id
            .trim()
            .toUpperCase()
        : "";

    const deviceSecret =
      typeof body.device_secret === "string"
        ? body.device_secret
            .trim()
            .toLowerCase()
        : "";

    const deviceSecretId =
      typeof body.device_secret_id === "string"
        ? body.device_secret_id
            .trim()
            .toLowerCase()
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
      Anti-replay fields.
    */

    const challengeId =
      typeof body.challenge_id === "string"
        ? body.challenge_id.trim()
        : "";

    const challenge =
      typeof body.challenge === "string"
        ? body.challenge.trim()
        : "";

    const challengeProof =
      typeof body.challenge_proof === "string"
        ? body.challenge_proof
            .trim()
            .toLowerCase()
        : "";

    /* ================================================
       BASIC VALIDATION
    ================================================= */

    if (
      !deviceId ||
      !chipId ||
      !deviceSecret ||
      !deviceSecretId ||
      !mapVersion
    ) {
      return jsonError(
        "MISSING_IDENTITY_FIELDS",
        400,
      );
    }

    if (
      !challengeId ||
      !challenge ||
      !challengeProof
    ) {
      return jsonError(
        "MISSING_REGISTRATION_CHALLENGE",
        400,
      );
    }

    if (
      !/^[0-9A-F]{6}$/.test(
        chipId,
      )
    ) {
      return jsonError(
        "INVALID_CHIP_ID",
        400,
      );
    }

    if (
      !/^[a-f0-9]{64}$/.test(
        deviceSecret,
      )
    ) {
      return jsonError(
        "INVALID_DEVICE_SECRET",
        400,
      );
    }

    if (
      !/^[a-f0-9]{64}$/.test(
        challengeProof,
      )
    ) {
      return jsonError(
        "INVALID_CHALLENGE_PROOF",
        400,
      );
    }

    if (
      mapVersion !== MAP_VERSION
    ) {
      return jsonError(
        "UNSUPPORTED_MAP_VERSION",
        400,
      );
    }

    /* ================================================
       DEVICE ID <-> CHIP
    ================================================= */

    const expectedDeviceId =
      `PH-7${chipId}`;

    if (
      deviceId !==
      expectedDeviceId
    ) {
      return jsonError(
        "DEVICE_ID_MISMATCH",
        401,
      );
    }

    /* ================================================
       FACTORY IDENTITY VERIFICATION
    ================================================= */

    const canonical =
      `PHANTOM|V1|${deviceId}|${chipId}|${deviceSecret}`;

    const expectedHmac =
      hmacSha256(canonical);

    const expectedDeviceSecretId =
      buildDeviceSecretId(
        expectedHmac,
        chipId,
      ).toLowerCase();

    if (
      !safeEqual(
        expectedDeviceSecretId,
        deviceSecretId,
      )
    ) {
      return jsonError(
        "FACTORY_IDENTITY_VERIFICATION_FAILED",
        401,
      );
    }

    /* ================================================
       REGISTRATION CHALLENGE LOOKUP
    ================================================= */

    const {
      data: challengeRow,
      error: challengeReadError,
    } = await supabase
      .from(
        "device_registration_challenges",
      )
      .select(
        `
        id,
        device_id,
        challenge_hash,
        status,
        expires_at,
        used_at
        `,
      )
      .eq(
        "id",
        challengeId,
      )
      .maybeSingle();

    if (challengeReadError) {
      console.error(
        "Challenge lookup:",
        challengeReadError,
      );

      return jsonError(
        "CHALLENGE_LOOKUP_FAILED",
        500,
      );
    }

    if (!challengeRow) {
      return jsonError(
        "CHALLENGE_NOT_FOUND",
        401,
      );
    }

    if (
      challengeRow.device_id !==
      deviceId
    ) {
      return jsonError(
        "CHALLENGE_DEVICE_MISMATCH",
        401,
      );
    }

    /*
      Critical replay protection.

      Once USED, EXPIRED or REVOKED,
      this request cannot authenticate again.
    */

    if (
      challengeRow.status !==
      "available"
    ) {
      return jsonError(
        "CHALLENGE_ALREADY_USED",
        409,
      );
    }

    if (
      new Date(
        challengeRow.expires_at,
      ).getTime() <= Date.now()
    ) {
      await supabase
        .from(
          "device_registration_challenges",
        )
        .update({
          status: "expired",
        })
        .eq(
          "id",
          challengeId,
        )
        .eq(
          "status",
          "available",
        );

      return jsonError(
        "CHALLENGE_EXPIRED",
        401,
      );
    }

    /* ================================================
       VERIFY RAW CHALLENGE
    ================================================= */

    const receivedChallengeHash =
      sha256(challenge);

    if (
      !safeEqual(
        receivedChallengeHash,
        challengeRow.challenge_hash,
      )
    ) {
      return jsonError(
        "INVALID_CHALLENGE",
        401,
      );
    }

    /* ================================================
       VERIFY DEVICE CHALLENGE PROOF

       ESP computes:

       HMAC-SHA256(
         DEVICE_SECRET,
         PHANTOM|REGISTER|V1|
         DEVICE_ID|
         CHALLENGE_ID|
         CHALLENGE
       )
    ================================================= */

    const challengeCanonical =
      `PHANTOM|REGISTER|V1|${deviceId}|${challengeId}|${challenge}`;

    const expectedChallengeProof =
      hmacSha256(
        challengeCanonical,
        deviceSecret,
      );

    if (
      !safeEqual(
        expectedChallengeProof,
        challengeProof,
      )
    ) {
      return jsonError(
        "CHALLENGE_PROOF_FAILED",
        401,
      );
    }

    /* ================================================
       ATOMIC-STYLE CHALLENGE CONSUMPTION

       Update only succeeds while status=available.

       If another identical request consumed it first,
       this update returns no row.
    ================================================= */

    const {
      data: consumedChallenge,
      error: consumeError,
    } = await supabase
      .from(
        "device_registration_challenges",
      )
      .update({
        status: "used",
        used_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        challengeId,
      )
      .eq(
        "device_id",
        deviceId,
      )
      .eq(
        "status",
        "available",
      )
      .select("id")
      .maybeSingle();

    if (consumeError) {
      console.error(
        "Challenge consume:",
        consumeError,
      );

      return jsonError(
        "CHALLENGE_CONSUME_FAILED",
        500,
      );
    }

    if (!consumedChallenge) {
      return jsonError(
        "CHALLENGE_REPLAY_DETECTED",
        409,
      );
    }

    /* ================================================
       HASH PERMANENT SECRETS
    ================================================= */

    const deviceSecretHash =
      sha256(deviceSecret);

    const deviceSecretIdHash =
      sha256(deviceSecretId);

    /* ================================================
       FACTORY REGISTRATION LOOKUP
    ================================================= */

    const {
      data: existingFactory,
      error: factoryReadError,
    } = await supabase
      .from(
        "device_factory_registrations",
      )
      .select(
        `
        device_id,
        chip_id,
        device_secret_id_hash,
        verified
        `,
      )
      .eq(
        "device_id",
        deviceId,
      )
      .maybeSingle();

    if (factoryReadError) {
      console.error(
        "Factory lookup:",
        factoryReadError,
      );

      return jsonError(
        "FACTORY_LOOKUP_FAILED",
        500,
      );
    }

    /* ================================================
       EXISTING FACTORY IDENTITY
    ================================================= */

    if (existingFactory) {
      if (
        existingFactory.chip_id !==
          chipId ||
        !safeEqual(
          existingFactory
            .device_secret_id_hash,
          deviceSecretIdHash,
        )
      ) {
        return jsonError(
          "FACTORY_IDENTITY_CONFLICT",
          409,
        );
      }

      const {
        error: updateFactoryError,
      } = await supabase
        .from(
          "device_factory_registrations",
        )
        .update({
          verified: true,

          verified_at:
            new Date().toISOString(),

          last_seen_at:
            new Date().toISOString(),
        })
        .eq(
          "device_id",
          deviceId,
        );

      if (updateFactoryError) {
        console.error(
          "Factory update:",
          updateFactoryError,
        );

        return jsonError(
          "FACTORY_UPDATE_FAILED",
          500,
        );
      }
    } else {
      /* ==============================================
         FIRST INTERNET REGISTRATION
      =============================================== */

      const {
        error: factoryInsertError,
      } = await supabase
        .from(
          "device_factory_registrations",
        )
        .insert({
          device_id:
            deviceId,

          chip_id:
            chipId,

          map_version:
            MAP_VERSION,

          device_secret_id_hash:
            deviceSecretIdHash,

          verified:
            true,

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
          factoryInsertError,
        );

        return jsonError(
          "FACTORY_REGISTRATION_FAILED",
          500,
        );
      }
    }

    /* ================================================
       AUTO PROVISION DEVICE
    ================================================= */

    const {
      error: provisionError,
    } = await supabase.rpc(
      "auto_provision_verified_device",
      {
        p_device_id:
          deviceId,

        p_chip_id:
          chipId,

        p_device_secret_hash:
          deviceSecretHash,

        p_device_secret_id_hash:
          deviceSecretIdHash,

        p_hardware_model:
          hardwareModel,

        p_firmware_version:
          firmwareVersion,
      },
    );

    if (provisionError) {
      console.error(
        "Auto provision:",
        provisionError,
      );

      return jsonError(
        "AUTO_PROVISION_FAILED",
        500,
      );
    }

    /* ================================================
       CHECK OWNERSHIP
    ================================================= */

    const {
      data: ownership,
      error: ownershipError,
    } = await supabase
      .from("device_ownership")
      .select(
        "owner_user_id,status",
      )
      .eq(
        "device_id",
        deviceId,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();

    if (ownershipError) {
      console.error(
        "Ownership:",
        ownershipError,
      );

      return jsonError(
        "OWNERSHIP_LOOKUP_FAILED",
        500,
      );
    }

    /* ================================================
       ALREADY CLAIMED
    ================================================= */

    if (ownership) {
      return NextResponse.json({
        ok: true,

        device_id:
          deviceId,

        factory_verified:
          true,

        registered:
          true,

        claimed:
          true,

        discovery_available:
          false,
      });
    }

    /* ================================================
       DISCOVERY CLEANUP
    ================================================= */

    const now =
      new Date().toISOString();

    const {
      error: expireError,
    } = await supabase
      .from(
        "device_discovery_sessions",
      )
      .update({
        status: "expired",
      })
      .eq(
        "device_id",
        deviceId,
      )
      .eq(
        "status",
        "available",
      )
      .lte(
        "expires_at",
        now,
      );

    if (expireError) {
      console.error(
        "Discovery cleanup:",
        expireError,
      );

      return jsonError(
        "DISCOVERY_CLEANUP_FAILED",
        500,
      );
    }

    /* ================================================
       ACTIVE DISCOVERY
    ================================================= */

    const {
      data: activeSession,
      error: activeSessionError,
    } = await supabase
      .from(
        "device_discovery_sessions",
      )
      .select(
        "id,expires_at",
      )
      .eq(
        "device_id",
        deviceId,
      )
      .eq(
        "status",
        "available",
      )
      .gt(
        "expires_at",
        now,
      )
      .maybeSingle();

    if (activeSessionError) {
      console.error(
        "Discovery lookup:",
        activeSessionError,
      );

      return jsonError(
        "DISCOVERY_LOOKUP_FAILED",
        500,
      );
    }

    /*
      We cannot recover the original raw pairing
      code because only its hash is stored.

      Therefore create a fresh pairing session.
    */

    if (activeSession) {
      const {
        error: revokeError,
      } = await supabase
        .from(
          "device_discovery_sessions",
        )
        .update({
          status: "revoked",
        })
        .eq(
          "id",
          activeSession.id,
        );

      if (revokeError) {
        console.error(
          "Discovery revoke:",
          revokeError,
        );

        return jsonError(
          "DISCOVERY_REVOKE_FAILED",
          500,
        );
      }
    }

    /* ================================================
       CREATE TEMPORARY PAIRING PROOF
    ================================================= */

    const pairingCode =
      crypto
        .randomBytes(24)
        .toString("base64url");

    const pairingCodeHash =
      sha256(pairingCode);

    const expiresAt =
      new Date(
        Date.now() +
          10 * 60 * 1000,
      ).toISOString();

    const {
      data: discoverySession,
      error: discoveryError,
    } = await supabase
      .from(
        "device_discovery_sessions",
      )
      .insert({
        device_id:
          deviceId,

        pairing_code_hash:
          pairingCodeHash,

        status:
          "available",

        expires_at:
          expiresAt,
      })
      .select(
        "id,expires_at",
      )
      .single();

    if (
      discoveryError ||
      !discoverySession
    ) {
      console.error(
        "Discovery create:",
        discoveryError,
      );

      return jsonError(
        "DISCOVERY_SESSION_CREATE_FAILED",
        500,
      );
    }

    /* ================================================
       RESPONSE TO ESP
    ================================================= */

    return NextResponse.json({
      ok: true,

      device_id:
        deviceId,

      factory_verified:
        true,

      registered:
        true,

      claimed:
        false,

      discovery_available:
        true,

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
      error,
    );

    return jsonError(
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}
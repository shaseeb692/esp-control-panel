import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/* =========================================================
   HELPERS
========================================================= */

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function jsonError(
  message: string,
  status: number,
  code: string,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
    },
    { status },
  );
}

/* =========================================================
   POST /api/device/claim

   Browser-authenticated endpoint.

   Body:
   {
     claim_token: string,
     house_id: string,
     room_id: string
   }
========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* =====================================================
       ENVIRONMENT
    ===================================================== */

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !publishableKey ||
      !serviceRoleKey
    ) {
      console.error(
        "CLAIM API: Missing Supabase environment variables",
      );

      return jsonError(
        "Server configuration error.",
        500,
        "SERVER_CONFIG_ERROR",
      );
    }

    /* =====================================================
       AUTHENTICATE CURRENT BROWSER USER
    ===================================================== */

    const userSupabase = createServerClient(
      supabaseUrl,
      publishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll() {
            /*
              No cookie mutation is required inside this
              API handler. Session refreshing is handled
              by the application's proxy/session layer.
            */
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      return jsonError(
        "You must be signed in to claim a device.",
        401,
        "UNAUTHORIZED",
      );
    }

    /* =====================================================
       READ BODY
    ===================================================== */

    let body: {
      claim_token?: unknown;
      house_id?: unknown;
      room_id?: unknown;

      // Also accept camelCase from frontend.
      claimToken?: unknown;
      houseId?: unknown;
      roomId?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Invalid request body.",
        400,
        "INVALID_BODY",
      );
    }

    const rawClaimToken =
      typeof body.claim_token === "string"
        ? body.claim_token.trim()
        : typeof body.claimToken === "string"
          ? body.claimToken.trim()
          : "";

    const houseId =
      typeof body.house_id === "string"
        ? body.house_id.trim()
        : typeof body.houseId === "string"
          ? body.houseId.trim()
          : "";

    const roomId =
      typeof body.room_id === "string"
        ? body.room_id.trim()
        : typeof body.roomId === "string"
          ? body.roomId.trim()
          : "";

    if (!rawClaimToken) {
      return jsonError(
        "Device claim token is required.",
        400,
        "CLAIM_TOKEN_REQUIRED",
      );
    }

    if (!houseId) {
      return jsonError(
        "House ID is required.",
        400,
        "HOUSE_ID_REQUIRED",
      );
    }

    if (!roomId) {
      return jsonError(
        "Room ID is required.",
        400,
        "ROOM_ID_REQUIRED",
      );
    }

    /*
      Current claim-session tokens use:

      claim_<base64url random bytes>
    */

    if (
      !rawClaimToken.startsWith("claim_") ||
      rawClaimToken.length < 20 ||
      rawClaimToken.length > 200
    ) {
      return jsonError(
        "Invalid device claim token.",
        400,
        "INVALID_TOKEN_FORMAT",
      );
    }

    /* =====================================================
       HASH TOKEN

       Raw temporary token never needs to be stored in DB.
    ===================================================== */

    const tokenHash = sha256(rawClaimToken);

    /* =====================================================
       SERVICE ROLE

       Used only after browser user identity has been
       established above.

       complete_device_claim() independently validates:
       - token
       - expiry
       - used/revoked state
       - device registry
       - security state
       - house ownership
       - room relationship
       - existing ownership
    ===================================================== */

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await admin.rpc(
      "complete_device_claim",
      {
        p_token_hash: tokenHash,
        p_user_id: user.id,
        p_house_id: houseId,
        p_room_id: roomId,
      },
    );

    if (error) {
      console.error(
        "CLAIM API RPC ERROR:",
        error,
      );

      return jsonError(
        "Unable to complete device claim.",
        500,
        "CLAIM_DATABASE_ERROR",
      );
    }

    if (!data || typeof data !== "object") {
      console.error(
        "CLAIM API: Unexpected RPC response:",
        data,
      );

      return jsonError(
        "Unexpected device claim response.",
        500,
        "INVALID_CLAIM_RESPONSE",
      );
    }

    const result = data as {
      ok?: boolean;
      code?: string;
      message?: string;
      device_id?: string;
      house_id?: string;
      room_id?: string;
      security_state?: string;
    };

    /* =====================================================
       SUCCESS
    ===================================================== */

    if (result.ok) {
      return NextResponse.json(
        {
          ok: true,
          code: result.code ?? "CLAIMED",
          message:
            result.message ??
            "Device claimed successfully.",
          device_id: result.device_id,
          house_id: result.house_id ?? houseId,
          room_id: result.room_id ?? roomId,
        },
        { status: 200 },
      );
    }

    /* =====================================================
       CONTROLLED CLAIM ERRORS
    ===================================================== */

    const code =
      result.code ?? "CLAIM_FAILED";

    let status = 400;

    switch (code) {
      case "INVALID_TOKEN":
      case "TOKEN_REVOKED":
      case "TOKEN_USED":
      case "TOKEN_EXPIRED":
        status = 400;
        break;

      case "HOUSE_NOT_AUTHORIZED":
      case "ROOM_NOT_AUTHORIZED":
        status = 403;
        break;

      case "OWNED_BY_ANOTHER_USER":
        status = 409;
        break;

      case "DEVICE_SECURITY_BLOCKED":
        status = 423;
        break;

      case "DEVICE_NOT_REGISTERED":
        status = 404;
        break;

      case "DEVICE_UNAVAILABLE":
      case "CLAIM_CONFLICT":
        status = 409;
        break;

      default:
        status = 400;
        break;
    }

    return NextResponse.json(
      {
        ok: false,
        code,
        message:
          result.message ??
          "Unable to claim device.",
        ...(result.security_state
          ? {
              security_state:
                result.security_state,
            }
          : {}),
      },
      { status },
    );
  } catch (error) {
    console.error(
      "CLAIM API UNEXPECTED ERROR:",
      error,
    );

    return jsonError(
      "Unexpected server error.",
      500,
      "INTERNAL_SERVER_ERROR",
    );
  }
}
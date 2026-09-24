import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/* =========================================================
   HELPERS
========================================================= */

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

   Discovery-based browser-authenticated claim endpoint.

   Body:
   {
     discovery_session_id: string,
     house_id: string,
     room_id: string
   }

   QR / raw claim token is NOT used.
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
              Session refresh is handled by the
              application's proxy/session layer.
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
      discovery_session_id?: unknown;
      house_id?: unknown;
      room_id?: unknown;

      // CamelCase compatibility.
      discoverySessionId?: unknown;
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

    const discoverySessionId =
      typeof body.discovery_session_id === "string"
        ? body.discovery_session_id.trim()
        : typeof body.discoverySessionId === "string"
          ? body.discoverySessionId.trim()
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

    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

    if (!discoverySessionId) {
      return jsonError(
        "Discovery session ID is required.",
        400,
        "DISCOVERY_SESSION_REQUIRED",
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
      UUID validation.

      Prevent malformed values from reaching PostgreSQL
      uuid parameters and generating unnecessary DB errors.
    */

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(discoverySessionId)) {
      return jsonError(
        "Invalid discovery session ID.",
        400,
        "INVALID_DISCOVERY_SESSION_ID",
      );
    }

    if (!uuidPattern.test(houseId)) {
      return jsonError(
        "Invalid house ID.",
        400,
        "INVALID_HOUSE_ID",
      );
    }

    if (!uuidPattern.test(roomId)) {
      return jsonError(
        "Invalid room ID.",
        400,
        "INVALID_ROOM_ID",
      );
    }

    /* =====================================================
       SERVICE ROLE

       Browser user has already been authenticated.

       Database RPC independently validates:
       - discovery session
       - expiry
       - device registry
       - lifecycle state
       - security state
       - house ownership
       - room relationship
       - existing device ownership
       - concurrent claim conflicts
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
      "complete_device_discovery_claim",
      {
        p_discovery_session_id:
          discoverySessionId,

        p_user_id:
          user.id,

        p_house_id:
          houseId,

        p_room_id:
          roomId,
      },
    );

    if (error) {
      console.error(
        "DISCOVERY CLAIM RPC ERROR:",
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

          code:
            result.code ??
            "CLAIMED",

          message:
            result.message ??
            "Device claimed successfully.",

          device_id:
            result.device_id,

          house_id:
            result.house_id ??
            houseId,

          room_id:
            result.room_id ??
            roomId,
        },
        { status: 200 },
      );
    }

    /* =====================================================
       CONTROLLED CLAIM ERRORS
    ===================================================== */

    const code =
      result.code ??
      "CLAIM_FAILED";

    let status = 400;

    switch (code) {
      case "DISCOVERY_SESSION_NOT_FOUND":
      case "DEVICE_NOT_REGISTERED":
        status = 404;
        break;

      case "DISCOVERY_SESSION_EXPIRED":
        status = 410;
        break;

      case "DISCOVERY_SESSION_UNAVAILABLE":
      case "DEVICE_UNAVAILABLE":
      case "CLAIM_CONFLICT":
        status = 409;
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
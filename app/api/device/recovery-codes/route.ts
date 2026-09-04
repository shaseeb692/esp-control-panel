import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/* =====================================================
   ENV
===================================================== */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

/* =====================================================
   ADMIN
===================================================== */

const adminSupabase =
  createClient(
    supabaseUrl,
    serviceRoleKey
  );

/* =====================================================
   AUTH
===================================================== */

async function getAuthClient() {
  const cookieStore =
    await cookies();

  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(
          cookiesToSet
        ) {
          try {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {}
        },
      },
    }
  );
}

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await getAuthClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const deviceId =
      typeof body?.device_id ===
      "string"
        ? body.device_id.trim()
        : "";

    if (!deviceId) {
      return NextResponse.json(
        {
          error:
            "device_id is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* ===============================================
       OWNER CHECK
    =============================================== */

    const {
      data: ownership,
      error:
        ownershipError,
    } =
      await adminSupabase
        .from(
          "device_ownership"
        )
        .select(
          "id"
        )
        .eq(
          "device_id",
          deviceId
        )
        .eq(
          "owner_user_id",
          user.id
        )
        .eq(
          "status",
          "active"
        )
        .maybeSingle();

    if (
      ownershipError
    ) {
      throw ownershipError;
    }

    if (!ownership) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this device.",
        },
        {
          status: 403,
        }
      );
    }

    /* ===============================================
       SECURITY STATE
    =============================================== */

    const {
      data: securityState,
    } =
      await adminSupabase
        .from(
          "device_security_state"
        )
        .select(
          "state"
        )
        .eq(
          "device_id",
          deviceId
        )
        .maybeSingle();

    const state =
      securityState?.state ??
      "active";

    if (
      state !== "active"
    ) {
      return NextResponse.json(
        {
          error:
            "Recovery codes cannot be regenerated while the device is not active.",
          state,
        },
        {
          status: 423,
        }
      );
    }

    /* ===============================================
       GENERATE
    =============================================== */

    const {
      data,
      error:
        rpcError,
    } =
      await supabase.rpc(
        "generate_device_recovery_codes",
        {
          p_device_id:
            deviceId,
        }
      );

    if (rpcError) {
      console.error(
        "Recovery RPC error:",
        rpcError
      );

      return NextResponse.json(
        {
          error:
            rpcError.message,
        },
        {
          status: 400,
        }
      );
    }

    /* ===============================================
       AUDIT
    =============================================== */

    await adminSupabase
      .from(
        "security_events"
      )
      .insert({
        user_id:
          user.id,
        device_id:
          deviceId,
        event_type:
          "recovery_codes_regenerated",
        metadata: {
          warning:
            "Plaintext recovery codes returned once.",
        },
      });

    return NextResponse.json({
      success: true,
      codes: data,
      warning:
        "Save these codes now. They cannot be retrieved later.",
    });
  } catch (error) {
    console.error(
      "Recovery codes API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to generate recovery codes.",
      },
      {
        status: 500,
      }
    );
  }
}
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
   SERVICE CLIENT
===================================================== */

const adminSupabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

/* =====================================================
   AUTH CLIENT
===================================================== */

async function getAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            /*
              Server Component / Route Handler
              cookie mutation may not always be available.
            */
          }
        },
      },
    }
  );
}

/* =====================================================
   POST COMMAND
===================================================== */

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await getAuthClient();

    /* ===============================================
       AUTHENTICATION
    =============================================== */

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
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

    /* ===============================================
       BODY
    =============================================== */

    const body =
      await request.json();

    const {
      device_id,
      message,
    } = body;

    if (
      typeof device_id !==
        "string" ||
      !device_id.trim()
    ) {
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

    if (
      typeof message !==
        "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "message is required.",
        },
        {
          status: 400,
        }
      );
    }

    const cleanDeviceId =
      device_id.trim();

    const cleanMessage =
      message.trim();

    /* ===============================================
       OWNERSHIP CHECK
    =============================================== */

    const {
      data: ownership,
      error: ownershipError,
    } =
      await adminSupabase
        .from(
          "device_ownership"
        )
        .select(
          `
            id,
            device_id,
            owner_user_id,
            status
          `
        )
        .eq(
          "device_id",
          cleanDeviceId
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
      console.error(
        "Ownership lookup error:",
        ownershipError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify device ownership.",
        },
        {
          status: 500,
        }
      );
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
      error:
        securityStateError,
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
          cleanDeviceId
        )
        .maybeSingle();

    if (
      securityStateError
    ) {
      console.error(
        "Security state error:",
        securityStateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify device security state.",
        },
        {
          status: 500,
        }
      );
    }

    const state =
      securityState?.state ??
      "active";

    if (
      state !== "active"
    ) {
      return NextResponse.json(
        {
          error:
            `Device is ${state.replace(
              "_",
              " "
            )}. Commands are currently blocked.`,
          security_state:
            state,
        },
        {
          status: 423,
        }
      );
    }

    /* ===============================================
       BASIC COMMAND VALIDATION
    =============================================== */

    if (
      cleanMessage.length >
      2000
    ) {
      return NextResponse.json(
        {
          error:
            "Command is too long.",
        },
        {
          status: 400,
        }
      );
    }

    /* ===============================================
       INSERT COMMAND
    =============================================== */

    const {
      data,
      error: commandError,
    } =
      await adminSupabase
        .from(
          "device_commands"
        )
        .insert({
          device_id:
            cleanDeviceId,
          command:
            cleanMessage,
          status:
            "pending",
        })
        .select()
        .single();

    if (
      commandError
    ) {
      console.error(
        "Command insert error:",
        commandError
      );

      return NextResponse.json(
        {
          error:
            commandError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* ===============================================
       SECURITY AUDIT
    =============================================== */

    await adminSupabase
      .from(
        "security_events"
      )
      .insert({
        user_id:
          user.id,
        device_id:
          cleanDeviceId,
        event_type:
          "device_command_sent",
        metadata: {
          command_id:
            data?.id ?? null,
        },
      });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Command API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Invalid request.",
      },
      {
        status: 400,
      }
    );
  }
}
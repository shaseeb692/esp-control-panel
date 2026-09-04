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
   ADMIN CLIENT
===================================================== */

const adminSupabase =
  createClient(
    supabaseUrl,
    serviceRoleKey
  );

/* =====================================================
   AUTH CLIENT
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
   VERIFY OWNER
===================================================== */

async function verifyOwner(
  deviceId: string,
  userId: string
) {
  const {
    data,
    error,
  } =
    await adminSupabase
      .from(
        "device_ownership"
      )
      .select(
        "id,device_id,owner_user_id,status"
      )
      .eq(
        "device_id",
        deviceId
      )
      .eq(
        "owner_user_id",
        userId
      )
      .eq(
        "status",
        "active"
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

/* =====================================================
   GET SECURITY STATE
===================================================== */

export async function GET(
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

    const url =
      new URL(request.url);

    const deviceId =
      url.searchParams.get(
        "device_id"
      );

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

    const owner =
      await verifyOwner(
        deviceId,
        user.id
      );

    if (!owner) {
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

    const {
      data,
      error,
    } =
      await adminSupabase
        .from(
          "device_security_state"
        )
        .select(
          `
            id,
            device_id,
            state,
            reason,
            changed_at,
            created_at,
            updated_at
          `
        )
        .eq(
          "device_id",
          deviceId
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      state:
        data?.state ??
        "active",
      data:
        data ?? {
          device_id:
            deviceId,
          state:
            "active",
        },
    });
  } catch (error) {
    console.error(
      "Security GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load security state.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =====================================================
   POST SECURITY ACTION
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

    const {
      device_id,
      action,
      reason,
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

    const allowedActions = [
      "lock",
      "unlock",
      "emergency_lock",
      "lost",
      "stolen",
    ];

    if (
      !allowedActions.includes(
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid security action.",
        },
        {
          status: 400,
        }
      );
    }

    const deviceId =
      device_id.trim();

    const owner =
      await verifyOwner(
        deviceId,
        user.id
      );

    if (!owner) {
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
       MAP ACTION → RPC
    =============================================== */

    const rpcMap: Record<
      string,
      string
    > = {
      lock:
        "lock_device",
      unlock:
        "unlock_device",
      emergency_lock:
        "emergency_lock_device",
      lost:
        "mark_device_lost",
      stolen:
        "mark_device_stolen",
    };

    const rpcName =
      rpcMap[action];

    const {
      data,
      error:
        rpcError,
    } =
      await supabase.rpc(
        rpcName,
        {
          p_device_id:
            deviceId,
          p_reason:
            typeof reason ===
            "string"
              ? reason.trim() ||
                null
              : null,
        }
      );

    if (rpcError) {
      console.error(
        "Security RPC error:",
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
       HIGH-RISK SESSION HANDLING
    =============================================== */

    if (
      action ===
        "emergency_lock" ||
      action === "stolen" ||
      action === "lost"
    ) {
      await adminSupabase
        .from(
          "device_sessions"
        )
        .update({
          status:
            "revoked",
          revoked_at:
            new Date().toISOString(),
        })
        .eq(
          "device_id",
          deviceId
        )
        .eq(
          "status",
          "active"
        );

      await adminSupabase
        .from(
          "ownership_transfers"
        )
        .update({
          status:
            "cancelled",
        })
        .eq(
          "device_id",
          deviceId
        )
        .eq(
          "status",
          "pending"
        );
    }

    /* ===============================================
       SECURITY EVENT
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
          `security_${action}`,
        metadata: {
          reason:
            reason ??
            null,
        },
      });

    return NextResponse.json({
      success: true,
      action,
      data,
    });
  } catch (error) {
    console.error(
      "Security POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to perform security action.",
      },
      {
        status: 500,
      }
    );
  }
}
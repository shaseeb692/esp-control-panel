import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* =====================================================
   ENV
===================================================== */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const deviceApiKey =
  process.env.DEVICE_API_KEY!;

/* =====================================================
   ADMIN SUPABASE
===================================================== */

const adminSupabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

/* =====================================================
   POST DEVICE HEARTBEAT / STATUS
===================================================== */

export async function POST(
  request: Request
) {
  try {
    /* ===============================================
       DEVICE AUTH
    =============================================== */

    const receivedKey =
      request.headers.get(
        "x-device-key"
      );

    if (
      !deviceApiKey ||
      !receivedKey ||
      receivedKey !== deviceApiKey
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid device key.",
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
      status_data,
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

    const cleanDeviceId =
      device_id.trim();

    /* ===============================================
       CHECK DEVICE EXISTS
    =============================================== */

    const {
      data: device,
      error: deviceError,
    } =
      await adminSupabase
        .from("devices")
        .select(
          "id,device_id"
        )
        .eq(
          "device_id",
          cleanDeviceId
        )
        .maybeSingle();

    if (deviceError) {
      console.error(
        "Device lookup error:",
        deviceError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify device.",
        },
        {
          status: 500,
        }
      );
    }

    if (!device) {
      return NextResponse.json(
        {
          error:
            "Device not found.",
        },
        {
          status: 404,
        }
      );
    }

    const now =
      new Date().toISOString();

    /* ===============================================
       FIND EXISTING STATUS ROW
    =============================================== */

    const {
      data: existingStatus,
      error: existingError,
    } =
      await adminSupabase
        .from("device_status")
        .select("id")
        .eq(
          "device_id",
          cleanDeviceId
        )
        .order(
          "updated_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (existingError) {
      console.error(
        "Status lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to read device status.",
        },
        {
          status: 500,
        }
      );
    }

    /* ===============================================
       UPDATE / INSERT
    =============================================== */

    if (existingStatus) {
      const {
        error: updateError,
      } =
        await adminSupabase
          .from(
            "device_status"
          )
          .update({
            online: true,

            last_seen_at:
              now,

            updated_at:
              now,

            ...(status_data &&
            typeof status_data ===
              "object"
              ? {
                  status_data,
                }
              : {}),
          })
          .eq(
            "id",
            existingStatus.id
          );

      if (updateError) {
        console.error(
          "Status update error:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              updateError.message,
          },
          {
            status: 500,
          }
        );
      }
    } else {
      const {
        error: insertError,
      } =
        await adminSupabase
          .from(
            "device_status"
          )
          .insert({
            device_id:
              cleanDeviceId,

            online: true,

            last_seen_at:
              now,

            updated_at:
              now,

            status_data:
              status_data &&
              typeof status_data ===
                "object"
                ? status_data
                : {},
          });

      if (insertError) {
        console.error(
          "Status insert error:",
          insertError
        );

        return NextResponse.json(
          {
            error:
              insertError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    /* ===============================================
       OPTIONAL DEVICES TABLE UPDATE
    =============================================== */

    await adminSupabase
      .from("devices")
      .update({
        is_online: true,
        last_seen_at: now,
      })
      .eq(
        "device_id",
        cleanDeviceId
      );

    /* ===============================================
       RESPONSE
    =============================================== */

    return NextResponse.json({
      success: true,

      device_id:
        cleanDeviceId,

      server_time:
        now,
    });
  } catch (error) {
    console.error(
      "Device status API error:",
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
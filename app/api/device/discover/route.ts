import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "SERVER_CONFIGURATION_ERROR" },
        { status: 500 }
      );
    }

    /*
     * Browser must be logged in.
     * We verify the user's Supabase access token before returning
     * any discovery information.
     */
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7).trim();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    /*
     * Expire stale sessions first.
     */
    const { error: expireError } = await supabase
      .from("device_discovery_sessions")
      .update({
        status: "expired",
      })
      .eq("status", "available")
      .lte("expires_at", now);

    if (expireError) {
      console.error("Discovery expiry error:", expireError);

      return NextResponse.json(
        { ok: false, error: "DISCOVERY_CLEANUP_FAILED" },
        { status: 500 }
      );
    }

    /*
     * Find currently available devices.
     */
    const { data: sessions, error: sessionsError } = await supabase
      .from("device_discovery_sessions")
      .select(`
        id,
        device_id,
        expires_at,
        created_at
      `)
      .eq("status", "available")
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (sessionsError) {
      console.error("Discovery lookup error:", sessionsError);

      return NextResponse.json(
        { ok: false, error: "DISCOVERY_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        ok: true,
        devices: [],
      });
    }

    /*
     * Double-check ownership.
     * Claimed devices must never appear in discovery.
     */
    const deviceIds = [...new Set(sessions.map((item) => item.device_id))];

    const { data: ownerships, error: ownershipError } = await supabase
      .from("device_ownership")
      .select("device_id")
      .in("device_id", deviceIds)
      .eq("status", "active");

    if (ownershipError) {
      console.error("Ownership lookup error:", ownershipError);

      return NextResponse.json(
        { ok: false, error: "OWNERSHIP_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    const claimed = new Set(
      (ownerships ?? []).map((item) => item.device_id)
    );

    const availableSessions = sessions.filter(
      (session) => !claimed.has(session.device_id)
    );

    if (availableSessions.length === 0) {
      return NextResponse.json({
        ok: true,
        devices: [],
      });
    }

    /*
     * Get safe device metadata.
     * No DEVICE_SECRET / DEVICE_SECRET_ID / hashes are returned.
     */
    const availableDeviceIds = [
      ...new Set(availableSessions.map((item) => item.device_id)),
    ];

    const { data: registry, error: registryError } = await supabase
      .from("device_registry")
      .select(`
        device_id,
        hardware_model,
        firmware_version,
        lifecycle_state,
        metadata
      `)
      .in("device_id", availableDeviceIds);

    if (registryError) {
      console.error("Registry lookup error:", registryError);

      return NextResponse.json(
        { ok: false, error: "REGISTRY_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    const registryMap = new Map(
      (registry ?? []).map((device) => [device.device_id, device])
    );

    const devices = availableSessions.map((session) => {
      const device = registryMap.get(session.device_id);

      return {
        discovery_session_id: session.id,
        device_id: session.device_id,

        hardware_model: device?.hardware_model ?? null,
        firmware_version: device?.firmware_version ?? null,
        lifecycle_state: device?.lifecycle_state ?? null,

        expires_at: session.expires_at,
      };
    });

    return NextResponse.json({
      ok: true,
      devices,
    });
  } catch (error) {
    console.error("DEVICE DISCOVER ERROR:", error);

    return NextResponse.json(
      { ok: false, error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { navigateWithTransition } from "@/lib/viewTransition";

import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Cpu,
  ChevronRight,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { GlobalHeaderActions } from "@/components/layout/GlobalHeaderActions";
import { DeviceControlPanel } from "@/components/devices/DeviceControlPanel";

/* =====================================================
   THEME
===================================================== */

const THEME_COLOR = "#42B8C5";
const ONLINE_TIMEOUT_MS = 90 * 1000;

/* =====================================================
   TYPES
===================================================== */

type Room = {
  id: string;
  house_id: string;
  name: string;
  slug: string;
};

type Device = {
  id: string;
  room_id: string;
  device_id: string;
  name: string;
  device_type: string;
  is_online: boolean;
  last_seen_at: string | null;
};

function withFreshOnlineState(
  device: Device,
  now = Date.now(),
): Device {
  const lastSeenTime = device.last_seen_at
    ? new Date(device.last_seen_at).getTime()
    : 0;

  const isFresh =
    Number.isFinite(lastSeenTime) &&
    lastSeenTime > 0 &&
    now - lastSeenTime <= ONLINE_TIMEOUT_MS;

  return {
    ...device,
    is_online: Boolean(device.is_online) && isFresh,
  };
}

/* =====================================================
   MAIN PAGE
===================================================== */

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const { darkMode, glass, glassSoft, muted } = useMasterTheme();

  const houseId =
    typeof params.houseId === "string"
      ? params.houseId
      : "";

  const roomId =
    typeof params.roomId === "string"
      ? params.roomId
      : "";

  /* =====================================================
     STATE
  ===================================================== */

  const [room, setRoom] =
    useState<Room | null>(null);

  const [devices, setDevices] =
    useState<Device[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showAddDevice, setShowAddDevice] = useState(false);

  const [error, setError] = useState("");

  const offlineTimersRef = useRef<
    Record<string, number>
  >({});

  /* =====================================================
     LOAD ROOM + DEVICES
  ===================================================== */

  useEffect(() => {
    async function loadRoom() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/auth/login");
          return;
        }

        /* ===============================================
           LOAD ROOM
        =============================================== */

        const {
          data: roomData,
          error: roomError,
        } = await supabase
          .from("rooms")
          .select(
            "id, house_id, name, slug"
          )
          .eq("id", roomId)
          .eq("house_id", houseId)
          .single();

        if (roomError) {
          throw roomError;
        }

        setRoom(roomData);

        /* ===============================================
           LOAD DEVICES
        =============================================== */

        const {
          data: devicesData,
          error: devicesError,
        } = await supabase
          .from("devices")
          .select(
            `
              id,
              room_id,
              device_id,
              name,
              device_type,
              is_online,
              last_seen_at
            `
          )
          .eq("room_id", roomId)
          .order("created_at", {
            ascending: true,
          });

        if (devicesError) {
          throw devicesError;
        }

        const now = Date.now();

        setDevices(
          ((devicesData || []) as Device[]).map(
            (device) =>
              withFreshOnlineState(device, now),
          ),
        );
      } catch (err: any) {
        console.error(err);

        setError(
          err?.message ||
            "Unable to load this room."
        );
      } finally {
        setLoading(false);
      }
    }

    if (roomId && houseId) {
      loadRoom();
    }
  }, [houseId, roomId, router]);

  /* =====================================================
     REALTIME HEARTBEAT → UPDATE ONLY THAT DEVICE
  ===================================================== */

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-summary-status-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_status",
        },
        (payload: any) => {
          const nextStatus = payload.new;

          if (!nextStatus?.device_id) {
            return;
          }

          const lastSeen =
            nextStatus.last_seen_at ??
            nextStatus.updated_at ??
            null;

          setDevices((current) => {
            let changed = false;

            const next = current.map((device) => {
              if (
                device.device_id !==
                nextStatus.device_id
              ) {
                return device;
              }

              changed = true;

              return {
                ...device,
                is_online: Boolean(
                  nextStatus.online,
                ),
                last_seen_at: lastSeen,
              };
            });

            return changed ? next : current;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  /* =====================================================
     EXACT OFFLINE TIMEOUTS — NO 5 SECOND POLLING
  ===================================================== */

  useEffect(() => {
    Object.values(offlineTimersRef.current).forEach(
      (timer) => window.clearTimeout(timer),
    );

    offlineTimersRef.current = {};

    const now = Date.now();

    devices.forEach((device) => {
      if (!device.is_online || !device.last_seen_at) {
        return;
      }

      const lastSeenTime = new Date(
        device.last_seen_at,
      ).getTime();

      if (!Number.isFinite(lastSeenTime)) {
        return;
      }

      const remaining =
        lastSeenTime +
        ONLINE_TIMEOUT_MS -
        now;

      if (remaining <= 0) {
        window.queueMicrotask(() => {
          setDevices((current) =>
            current.map((item) =>
              item.device_id === device.device_id &&
              item.is_online
                ? { ...item, is_online: false }
                : item,
            ),
          );
        });
        return;
      }

      offlineTimersRef.current[device.device_id] =
        window.setTimeout(() => {
          setDevices((current) =>
            current.map((item) =>
              item.device_id === device.device_id
                ? { ...item, is_online: false }
                : item,
            ),
          );
        }, remaining + 25);
    });

    return () => {
      Object.values(
        offlineTimersRef.current,
      ).forEach((timer) =>
        window.clearTimeout(timer),
      );
      offlineTimersRef.current = {};
    };
  }, [devices]);

  /* =====================================================
     ADD DEVICE / CLAIM FLOW
  ===================================================== */

  function openDeviceClaim() {
    setError("");
    setShowAddDevice(false);

    const params = new URLSearchParams({
      houseId,
      roomId,
    });

    router.push(`/claim?${params.toString()}`);
  }

  function closeAddModal() {
    setError("");
    setShowAddDevice(false);
  }

  /* =====================================================
     ROOM NOT FOUND
  ===================================================== */

  if (!room) {
    return (
      <main className={`smart-theme-page flex min-h-screen items-center justify-center px-4 ${darkMode ? "text-white" : "text-slate-600"}`}>
        <div className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: `${THEME_COLOR}12`,
              color: THEME_COLOR,
            }}
          >
            <Cpu size={30} />
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-600">
            Room not found
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            {error ||
              "This room does not exist."}
          </p>

          <button
            onClick={() =>
  navigateWithTransition(() => {
    router.push(`/house/${houseId}`);
  })
}
            className="mx-auto mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{
              backgroundColor:
                THEME_COLOR,
            }}
          >
            <ArrowLeft size={18} />
            Back to House
          </button>
        </div>
      </main>
    );
  }

  /* =====================================================
     COUNTS
  ===================================================== */

  const onlineDevices =
    devices.filter(
      (device) =>
        device.is_online
    ).length;

  const offlineDevices =
    devices.length -
    onlineDevices;

  /* =====================================================
     ROOM PAGE
  ===================================================== */

  return (
    <main className={`smart-theme-page min-h-screen ${darkMode ? "text-white" : "text-slate-600"}`}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">

        <AppHeader
          eyebrow="Room"
          title={room.name}
          subtitle={`/${room.slug}`}
          icon={<Cpu size={25} />}
          backHref={`/house/${houseId}`}
          backLabel="House"
          actions={
            <GlobalHeaderActions>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setShowAddDevice(true);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#42B8C5] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                <Plus size={18} />
                Add Device
              </button>
            </GlobalHeaderActions>
          }
        />

        {/* =================================================
            ERROR
        ================================================= */}

        {error &&
          !showAddDevice && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <span>
                {error}
              </span>
            </div>
          )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">

          {/* TOTAL */}

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-400">
                  Total Devices
                </p>

                <p className="mt-2 text-3xl font-semibold text-slate-600">
                  {devices.length}
                </p>
              </div>

              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{
                  backgroundColor:
                    `${THEME_COLOR}12`,
                  color:
                    THEME_COLOR,
                }}
              >
                <Cpu size={22} />
              </div>

            </div>

          </div>

          {/* ONLINE */}

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-400">
                  Online
                </p>

                <p className="mt-2 text-3xl font-semibold text-green-500">
                  {onlineDevices}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-500">
                <Wifi size={21} />
              </div>

            </div>

          </div>

          {/* OFFLINE */}

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-400">
                  Offline
                </p>

                <p className="mt-2 text-3xl font-semibold text-slate-500">
                  {offlineDevices}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <WifiOff size={21} />
              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            DEVICES
        ================================================= */}

        <section>

          <div className="mb-5 flex items-end justify-between">

            <div>
              <h2 className="text-xl font-semibold">
                Devices
              </h2>

              <p className={`mt-1 text-sm ${muted}`}>
                Control every ESP device in this room from one page.
              </p>
            </div>

            {devices.length > 0 && (
              <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-400 shadow-sm sm:block">
                {devices.length}{" "}
                {devices.length === 1
                  ? "device"
                  : "devices"}
              </span>
            )}

          </div>

          {/* EMPTY */}

          {devices.length === 0 ? (

            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">

              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor:
                    `${THEME_COLOR}12`,
                  color:
                    THEME_COLOR,
                }}
              >
                <Cpu size={30} />
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-600">
                No devices yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Add an ESP controller to start
                managing this room.
              </p>

              <button
                onClick={() => {
                  setError("");
                  setShowAddDevice(true);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{
                  backgroundColor:
                    THEME_COLOR,
                }}
              >
                <Plus size={18} />
                Add Your First Device
              </button>

            </div>

          ) : (

            /* ALL DEVICE CONTROLS */

            <div className="space-y-4">
              {devices.map((device, index) => (
                <div key={device.id}>
  <DeviceControlPanel
    device={device}
    defaultExpanded={index === 0}
  />
</div>
              ))}
            </div>

          )}

        </section>

      </div>

      {/* =====================================================
          ADD DEVICE MODAL
      ===================================================== */}

      {showAddDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-[28px] border p-6 shadow-2xl ${glass}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${glassSoft}`}
                  style={{ color: THEME_COLOR }}
                >
                  <Cpu size={22} />
                </div>

                <h2 className="text-xl font-semibold">
                  Add Device
                </h2>

                <p className={`mt-1 text-sm ${muted}`}>
                  Add a controller to {room.name} by scanning for available devices.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddModal}
                className={`rounded-xl p-2 transition ${muted} hover:opacity-70`}
                aria-label="Close add device"
              >
                <X size={19} />
              </button>
            </div>

            <div className={`mt-6 rounded-2xl border p-5 ${glassSoft}`}>
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${THEME_COLOR}14`,
                    color: THEME_COLOR,
                  }}
                >
                  <Cpu size={20} />
                </div>

                <div className="min-w-0">
                  <p className="font-medium">
                    Device identifies itself
                  </p>
                  <p className={`mt-1 text-sm leading-6 ${muted}`}>
                    Device ID, type and controls are detected automatically.
                    You do not need to enter technical details manually.
                  </p>
                </div>
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border p-4 text-sm ${glassSoft}`}>
              <p className="font-medium">
                Before adding
              </p>
              <p className={`mt-1 leading-6 ${muted}`}>
                Connect the ESP to Wi-Fi, open its local IP, then open the
                Connect the ESP to Wi-Fi and make sure the device is ready for discovery.
              </p>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeAddModal}
                className={`flex-1 rounded-xl border py-3 text-sm font-medium transition ${glassSoft}`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={openDeviceClaim}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: THEME_COLOR }}
              >
                <Plus size={18} />
                Scan Device
              </button>
            </div>
          </div>
        </div>
      )}


    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
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

  const [creatingDevice, setCreatingDevice] =
    useState(false);

  const [showAddDevice, setShowAddDevice] =
    useState(false);

  const [deviceName, setDeviceName] =
    useState("");

  const [deviceId, setDeviceId] =
    useState("");

  const [deviceType, setDeviceType] =
    useState("water_controller");

  const [error, setError] =
    useState("");

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

        setDevices(
          (devicesData || []) as Device[]
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
     ADD DEVICE
  ===================================================== */

  async function handleAddDevice() {
    setError("");

    const cleanName =
      deviceName.trim();

    const cleanDeviceId =
      deviceId.trim();

    if (!cleanName) {
      setError(
        "Please enter a device name."
      );
      return;
    }

    if (!cleanDeviceId) {
      setError(
        "Please enter the ESP Device ID."
      );
      return;
    }

    setCreatingDevice(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const {
        data,
        error: insertError,
      } = await supabase
        .from("devices")
        .insert({
          room_id: roomId,
          device_id: cleanDeviceId,
          name: cleanName,
          device_type: deviceType,
          is_online: false,
        })
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
        .single();

      if (insertError) {
        if (
          insertError.code === "23505"
        ) {
          setError(
            "This Device ID is already registered."
          );
        } else {
          setError(
            insertError.message
          );
        }

        return;
      }

      if (data) {
        setDevices(
          (current) => [
            ...current,
            data as Device,
          ]
        );
      }

      /* ===============================================
         RESET FORM
      =============================================== */

      setDeviceName("");
      setDeviceId("");
      setDeviceType(
        "water_controller"
      );

      setShowAddDevice(false);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Something went wrong while adding the device."
      );
    } finally {
      setCreatingDevice(false);
    }
  }


  /* =====================================================
     CLOSE ADD MODAL
  ===================================================== */

  function closeAddModal() {
    if (creatingDevice) {
      return;
    }

    setShowAddDevice(false);
    setDeviceName("");
    setDeviceId("");
    setDeviceType(
      "water_controller"
    );
    setError("");
  }


    /* =====================================================
     ROOM SKELETON
  ===================================================== */

  if (loading) {
    return (
      <main className={`smart-theme-page min-h-screen ${darkMode ? "text-white" : "text-slate-600"}`}>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">

          {/* HEADER SKELETON */}

          <header className="mb-7">

            {/* BACK BUTTON */}

            <div className="mb-6 h-5 w-32 animate-pulse rounded-lg bg-slate-200" />

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              {/* ROOM INFO */}

              <div className="flex items-center gap-4">

                <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-slate-200" />

                <div>

                  <div className="h-3 w-12 animate-pulse rounded bg-slate-200" />

                  <div className="mt-2 h-8 w-48 animate-pulse rounded-lg bg-slate-200 sm:w-64" />

                  <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />

                </div>

              </div>

              {/* ADD DEVICE */}

              <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200 sm:w-36" />

            </div>

          </header>


          {/* SUMMARY SKELETON */}

          <div className="mb-8 grid gap-4 sm:grid-cols-3">

            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
              >

                <div className="flex items-center justify-between">

                  <div>

                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />

                    <div className="mt-3 h-9 w-12 animate-pulse rounded-lg bg-slate-200" />

                  </div>

                  <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />

                </div>

              </div>
            ))}

          </div>


          {/* DEVICES HEADER SKELETON */}

          <section>

            <div className="mb-5 flex items-end justify-between">

              <div>

                <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-200" />

                <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-200" />

              </div>

              <div className="hidden h-7 w-20 animate-pulse rounded-full bg-slate-200 sm:block" />

            </div>


            {/* DEVICE CARDS SKELETON */}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm"
                >

                  {/* TOP */}

                  <div className="flex items-start justify-between">

                    <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />

                    <div className="flex items-center gap-2">

                      <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />

                      <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />

                      <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />

                    </div>

                  </div>


                  {/* DEVICE INFO */}

                  <div className="mt-5">

                    <div className="h-6 w-36 animate-pulse rounded-lg bg-slate-200" />

                    <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-200" />

                    <div className="mt-4 h-4 w-32 animate-pulse rounded bg-slate-200" />

                  </div>


                  {/* STATUS */}

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

                    <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />

                    <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />

                  </div>

                </div>
              ))}

            </div>

          </section>

        </div>
      </main>
    );
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

          <div className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex items-start justify-between">

              <div>

                <div
                  className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor:
                      `${THEME_COLOR}12`,
                    color:
                      THEME_COLOR,
                  }}
                >
                  <Cpu size={22} />
                </div>

                <h2 className="text-xl font-semibold">
                  Add Device
                </h2>

                <p className={`mt-1 text-sm ${muted}`}>
                  Connect an ESP controller to{" "}
                  {room.name}.
                </p>

              </div>

              <button
                onClick={
                  closeAddModal
                }
                disabled={
                  creatingDevice
                }
                className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-50 hover:text-slate-500 disabled:opacity-50"
              >
                <X size={19} />
              </button>

            </div>

            {/* DEVICE NAME */}

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-500">
                Device Name
              </label>

              <input
                type="text"
                value={
                  deviceName
                }
                onChange={(event) =>
                  setDeviceName(
                    event.target.value
                  )
                }
                placeholder="e.g. Roof Water Controller"
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-600 outline-none transition placeholder:text-slate-300 focus:border-[#42B8C5] focus:bg-white focus:ring-4 focus:ring-[#42B8C5]/10"
              />

            </div>

            {/* DEVICE ID */}

            <div className="mt-5">

              <label className="mb-2 block text-sm font-medium text-slate-500">
                ESP Device ID
              </label>

              <input
                type="text"
                value={
                  deviceId
                }
                onChange={(event) =>
                  setDeviceId(
                    event.target.value
                  )
                }
                placeholder="e.g. ESP001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-mono text-sm text-slate-600 outline-none transition placeholder:text-slate-300 focus:border-[#42B8C5] focus:bg-white focus:ring-4 focus:ring-[#42B8C5]/10"
              />

              <p className="mt-2 text-xs text-slate-400">
                This ID must match the ID programmed into the ESP.
              </p>

            </div>

            {/* DEVICE TYPE */}

            <div className="mt-5">

              <label className="mb-2 block text-sm font-medium text-slate-500">
                Device Type
              </label>

              <select
                value={
                  deviceType
                }
                onChange={(event) =>
                  setDeviceType(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-600 outline-none transition focus:border-[#42B8C5] focus:bg-white focus:ring-4 focus:ring-[#42B8C5]/10"
              >

                <option value="water_controller">
                  Water Controller
                </option>

                <option value="generic_esp">
                  Generic ESP
                </option>

              </select>

            </div>

            {/* ERROR */}

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {error}
                </span>
              </div>
            )}

            {/* BUTTONS */}

            <div className="mt-6 flex gap-3">

              <button
                onClick={
                  closeAddModal
                }
                disabled={
                  creatingDevice
                }
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={
                  handleAddDevice
                }
                disabled={
                  creatingDevice
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor:
                    THEME_COLOR,
                }}
              >

                {creatingDevice ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    Adding...
                  </>
                ) : (
                  <>
                    <Plus
                      size={18}
                    />

                    Add Device
                  </>
                )}

              </button>

            </div>

          </div>

        </div>
      )}


    </main>
  );
}
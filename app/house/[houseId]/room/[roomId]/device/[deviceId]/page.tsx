"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  Cpu,
  Wifi,
  WifiOff,
  Loader2,
  Settings,
  RefreshCw,
  Activity,
  Clock3,
  History,
  Zap,
  Power,
  Gauge,
  AlertTriangle,
  Send,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

/* =====================================================
   THEME
===================================================== */

const THEME_COLOR = "#42B8C5";

/* =====================================================
   STATUS REQUEST TIMEOUT
===================================================== */

const STATUS_TIMEOUT_MS = 50_000;

/* =====================================================
   TYPES
===================================================== */

type Device = {
  id: string;
  room_id: string;
  device_id: string;
  name: string;
  device_type: string;
  is_online: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

type Capability = {
  id: number;
  device_id: string;
  control_id: string;
  name: string;
  type: string;
  config: Record<string, any> | null;
  created_at: string;
  sort_order: number;
  enabled: boolean;
};

type DeviceStatus = {
  id: number;
  device_id: string;
  status_data: Record<string, any> | null;
  updated_at: string;
  online: boolean;
  last_seen_at: string | null;
};

type DeviceEvent = {
  id: number;
  device_id: string;
  control_id: string | null;
  event_type: string;
  value: Record<string, any> | null;
  created_at: string;
  source: string | null;
};

/* =====================================================
   MAIN PAGE
===================================================== */

export default function DevicePage() {
  const router = useRouter();
  const params = useParams();

  const houseId =
    typeof params.houseId === "string"
      ? params.houseId
      : "";

  const roomId =
    typeof params.roomId === "string"
      ? params.roomId
      : "";

  const deviceId =
    typeof params.deviceId === "string"
      ? params.deviceId
      : "";

  /* =====================================================
     STATE
  ===================================================== */

  const [device, setDevice] =
    useState<Device | null>(null);

  const [capabilities, setCapabilities] =
    useState<Capability[]>([]);

  const [status, setStatus] =
    useState<DeviceStatus | null>(null);

  const [events, setEvents] =
    useState<DeviceEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [sendingCommand, setSendingCommand] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [commandMessage, setCommandMessage] =
    useState("");

  const [controlValues, setControlValues] =
    useState<Record<string, number>>({});

  /* =====================================================
     STATUS REQUEST STATE
  ===================================================== */

  const [statusRequestWaiting, setStatusRequestWaiting] =
    useState(false);

  const [statusCountdown, setStatusCountdown] =
    useState(0);

  const [statusOfflineMessage, setStatusOfflineMessage] =
    useState(false);

  const statusTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusCountdownRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const statusRequestStartedAtRef =
    useRef<number | null>(null);

  const statusRequestStartedIsoRef =
    useRef<string | null>(null);

  /* =====================================================
     CLEAR STATUS WAIT
  ===================================================== */

  function clearStatusWaiting() {
    if (statusTimeoutRef.current) {
      clearTimeout(
        statusTimeoutRef.current
      );

      statusTimeoutRef.current = null;
    }

    if (statusCountdownRef.current) {
      clearInterval(
        statusCountdownRef.current
      );

      statusCountdownRef.current = null;
    }

    statusRequestStartedAtRef.current = null;
    statusRequestStartedIsoRef.current = null;

    setStatusRequestWaiting(false);
    setStatusCountdown(0);
    setSendingCommand((current) =>
      current === "__STATUS__"
        ? null
        : current
    );
  }

  /* =====================================================
     START 50 SECOND STATUS TIMER
  ===================================================== */

  function startStatusWaiting() {
    if (statusTimeoutRef.current) {
      clearTimeout(
        statusTimeoutRef.current
      );
    }

    if (statusCountdownRef.current) {
      clearInterval(
        statusCountdownRef.current
      );
    }

    const startedAt =
      Date.now();

    statusRequestStartedAtRef.current =
      startedAt;

    statusRequestStartedIsoRef.current =
      new Date(
        startedAt
      ).toISOString();

    setStatusRequestWaiting(true);
    setStatusCountdown(50);
    setStatusOfflineMessage(false);

    statusCountdownRef.current =
      setInterval(() => {
        const elapsed =
          Math.floor(
            (Date.now() - startedAt) /
              1000
          );

        const remaining =
          Math.max(
            0,
            50 - elapsed
          );

        setStatusCountdown(
          remaining
        );

        if (remaining <= 0) {
          if (
            statusCountdownRef.current
          ) {
            clearInterval(
              statusCountdownRef.current
            );

            statusCountdownRef.current =
              null;
          }
        }
      }, 1000);

    statusTimeoutRef.current =
      setTimeout(() => {
        setStatusRequestWaiting(false);
        setStatusCountdown(0);
        setSendingCommand((current) =>
          current === "__STATUS__"
            ? null
            : current
        );

        setStatusOfflineMessage(true);

        if (
          statusCountdownRef.current
        ) {
          clearInterval(
            statusCountdownRef.current
          );

          statusCountdownRef.current =
            null;
        }

        statusTimeoutRef.current =
          null;
      }, STATUS_TIMEOUT_MS);
  }

  /* =====================================================
     CHECK FRESH STATUS RESPONSE
  ===================================================== */

  function isFreshStatusResponse(
    incomingStatus: DeviceStatus
  ) {
    const requestStartedAt =
      statusRequestStartedAtRef.current;

    if (!requestStartedAt) {
      return false;
    }

    const updatedAt =
      new Date(
        incomingStatus.updated_at
      ).getTime();

    if (
      Number.isNaN(updatedAt)
    ) {
      return false;
    }

    return (
      updatedAt >=
      requestStartedAt
    );
  }

  /* =====================================================
     LOAD DEVICE
  ===================================================== */

  async function loadDevice(
    showRefresh = false
  ) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace(
          "/auth/login"
        );

        return;
      }

      /* ===============================================
         DEVICE
      =============================================== */

      const {
        data: deviceData,
        error: deviceError,
      } =
        await supabase
          .from("devices")
          .select(
            `
              id,
              room_id,
              device_id,
              name,
              device_type,
              is_online,
              last_seen_at,
              created_at,
              updated_at
            `
          )
          .eq(
            "id",
            deviceId
          )
          .eq(
            "room_id",
            roomId
          )
          .single();

      if (deviceError) {
        throw deviceError;
      }

      setDevice(
        deviceData as Device
      );

      /* ===============================================
         CAPABILITIES
      =============================================== */

      const {
        data: capabilitiesData,
        error: capabilitiesError,
      } =
        await supabase
          .from(
            "device_capabilities"
          )
          .select(
            `
              id,
              device_id,
              control_id,
              name,
              type,
              config,
              created_at,
              sort_order,
              enabled
            `
          )
          .eq(
            "device_id",
            deviceData.device_id
          )
          .eq(
            "enabled",
            true
          )
          .order(
            "sort_order",
            {
              ascending: true,
            }
          );

      if (capabilitiesError) {
        throw capabilitiesError;
      }

      const loadedCapabilities =
        (capabilitiesData ||
          []) as Capability[];

      setCapabilities(
        loadedCapabilities
      );

      /* ===============================================
         CONTROL VALUES
      =============================================== */

      setControlValues(
        (current) => {
          const next = {
            ...current,
          };

          loadedCapabilities.forEach(
            (capability) => {
              const config =
                capability.config ||
                {};

              if (
                capability.type ===
                  "range" ||
                capability.type ===
                  "slider" ||
                capability.type ===
                  "number" ||
                capability.type ===
                  "numeric"
              ) {
                if (
                  next[
                    capability
                      .control_id
                  ] ===
                  undefined
                ) {
                  next[
                    capability
                      .control_id
                  ] =
                    Number(
                      config.default ??
                        config.min ??
                        0
                    );
                }
              }
            }
          );

          return next;
        }
      );

      /* ===============================================
         STATUS
      =============================================== */

      const {
        data: statusData,
        error: statusError,
      } =
        await supabase
          .from(
            "device_status"
          )
          .select(
            `
              id,
              device_id,
              status_data,
              updated_at,
              online,
              last_seen_at
            `
          )
          .eq(
            "device_id",
            deviceData.device_id
          )
          .order(
            "updated_at",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

      if (statusError) {
        throw statusError;
      }

      setStatus(
        statusData
          ? (statusData as DeviceStatus)
          : null
      );

      /* ===============================================
         EVENTS
      =============================================== */

      const {
        data: eventsData,
        error: eventsError,
      } =
        await supabase
          .from(
            "device_events"
          )
          .select(
            `
              id,
              device_id,
              control_id,
              event_type,
              value,
              created_at,
              source
            `
          )
          .eq(
            "device_id",
            deviceData.device_id
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(20);

      if (eventsError) {
        throw eventsError;
      }

      setEvents(
        (eventsData ||
          []) as DeviceEvent[]
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to load device."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    if (
      deviceId &&
      roomId
    ) {
      loadDevice();
    }
  }, [
    deviceId,
    roomId,
  ]);

  /* =====================================================
     CLEANUP STATUS TIMER
  ===================================================== */

  useEffect(() => {
    return () => {
      if (
        statusTimeoutRef.current
      ) {
        clearTimeout(
          statusTimeoutRef.current
        );
      }

      if (
        statusCountdownRef.current
      ) {
        clearInterval(
          statusCountdownRef.current
        );
      }
    };
  }, []);

  /* =====================================================
     REALTIME
  ===================================================== */

  useEffect(() => {
    if (
      !device?.device_id
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `device-dashboard-${device.device_id}`
        )

        /* =============================================
           STATUS REALTIME
        ============================================= */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "device_status",
            filter:
              `device_id=eq.${device.device_id}`,
          },
          (payload) => {
            console.log(
              "REALTIME STATUS:",
              payload
            );

            if (
              payload.eventType ===
              "DELETE"
            ) {
              setStatus(null);

              return;
            }

            if (
              payload.new
            ) {
              const incomingStatus =
                payload.new as DeviceStatus;

              setStatus(
                incomingStatus
              );

              /* =========================================
                 FRESH RESPONSE FROM ESP
              ========================================= */

              if (
                statusRequestWaiting &&
                isFreshStatusResponse(
                  incomingStatus
                )
              ) {
                clearStatusWaiting();

                setStatusOfflineMessage(
                  false
                );

                setCommandMessage(
                  "Status updated from ESP."
                );
              }
            }
          }
        )

        /* =============================================
           EVENTS REALTIME
        ============================================= */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "device_events",
            filter:
              `device_id=eq.${device.device_id}`,
          },
          (payload) => {
            console.log(
              "REALTIME EVENT:",
              payload
            );

            if (
              payload.eventType ===
              "INSERT"
            ) {
              setEvents(
                (current) =>
                  [
                    payload.new as DeviceEvent,
                    ...current,
                  ].slice(
                    0,
                    20
                  )
              );
            }
          }
        )

        .subscribe(
          (subscriptionStatus) => {
            console.log(
              "Realtime:",
              subscriptionStatus
            );
          }
        );

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    device?.device_id,
    statusRequestWaiting,
  ]);

  /* =====================================================
     SEND COMMAND
  ===================================================== */

  async function sendCommand(
    capability: Capability,
    value: any = true
  ) {
    if (!device) {
      return;
    }

    setError("");
    setCommandMessage("");
    setStatusOfflineMessage(
      false
    );

    setSendingCommand(
      capability.control_id
    );

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace(
          "/auth/login"
        );

        return;
      }

      const commandPayload = {
        control_id:
          capability.control_id,
        value,
      };

      const commandText =
        JSON.stringify(
          commandPayload
        );

      const {
        error: commandError,
      } =
        await supabase
          .from(
            "device_commands"
          )
          .insert({
            device_id:
              device.device_id,
            command:
              commandText,
            status: "pending",
          });

      if (commandError) {
        throw commandError;
      }

      setCommandMessage(
        `${capability.name} command sent successfully.`
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to send command."
      );
    } finally {
      setSendingCommand(
        null
      );
    }
  }

  /* =====================================================
     GET CURRENT STATUS
  ===================================================== */

  async function requestCurrentStatus() {
    if (!device) {
      return;
    }

    setError("");
    setCommandMessage("");
    setStatusOfflineMessage(
      false
    );

    setSendingCommand(
      "__STATUS__"
    );

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace(
          "/auth/login"
        );

        return;
      }

      /* ===============================================
         START TIMER BEFORE INSERT
      =============================================== */

      startStatusWaiting();

      const commandText =
        "STATUS";

      const {
        error: commandError,
      } =
        await supabase
          .from(
            "device_commands"
          )
          .insert({
            device_id:
              device.device_id,
            command:
              commandText,
            status: "pending",
          });

      if (commandError) {
        clearStatusWaiting();

        throw commandError;
      }

      setCommandMessage(
        "Status request sent. Waiting for ESP response..."
      );
    } catch (err: any) {
      console.error(err);

      clearStatusWaiting();

      setError(
        err?.message ||
          "Unable to request device status."
      );
    }
  }

  /* =====================================================
     UPDATE CONTROL VALUE
  ===================================================== */

  function updateControlValue(
    controlId: string,
    value: number
  ) {
    setControlValues(
      (current) => ({
        ...current,
        [controlId]:
          value,
      })
    );
  }

  /* =====================================================
     FORMAT DATE
  ===================================================== */

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "Never";
    }

    try {
      return new Date(
        date
      ).toLocaleString(
        "en-PK",
        {
          dateStyle:
            "medium",
          timeStyle:
            "short",
        }
      );
    } catch {
      return date;
    }
  }

  /* =====================================================
     EVENT TEXT
  ===================================================== */

  function eventText(
    event: DeviceEvent
  ) {
    if (
      event.control_id
    ) {
      return `${event.control_id} • ${event.event_type}`;
    }

    return event.event_type;
  }

  /* =====================================================
     GET LIVE BOOLEAN STATUS
  ===================================================== */

  function getBooleanStatus(
    controlId: string
  ): boolean {
    const value =
      status?.status_data?.[
        controlId
      ];

    if (
      typeof value ===
      "boolean"
    ) {
      return value;
    }

    return false;
  }

  /* =====================================================
     RENDER CAPABILITY
  ===================================================== */

  function renderCapability(
    capability: Capability
  ) {
    const config =
      capability.config ||
      {};

    const type =
      capability.type.toLowerCase();

    const busy =
      sendingCommand ===
      capability.control_id;

    /* ===============================================
       SWITCH / TOGGLE / BUTTON
    =============================================== */

    if (
      type === "switch" ||
      type === "toggle" ||
      type === "button"
    ) {
      const currentState =
        getBooleanStatus(
          capability.control_id
        );

      const nextState =
        !currentState;

      return (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            sendCommand(
              capability,
              nextState
            )
          }
          className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                backgroundColor:
                  currentState
                    ? "#22c55e15"
                    : `${THEME_COLOR}12`,
                color:
                  currentState
                    ? "#22c55e"
                    : THEME_COLOR,
              }}
            >
              {busy ? (
                <Loader2
                  size={20}
                  className="animate-spin"
                />
              ) : (
                <Power
                  size={20}
                />
              )}
            </div>

            <div>
              <p className="font-semibold text-slate-600">
                {
                  capability.name
                }
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                {
                  config.description ||
                  "Control device"
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                currentState
                  ? "bg-green-50 text-green-500"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {currentState
                ? "ON"
                : "OFF"}
            </div>

            <div
              className="rounded-xl px-3 py-2 text-xs font-semibold text-white"
              style={{
                backgroundColor:
                  currentState
                    ? "#ef4444"
                    : THEME_COLOR,
              }}
            >
              {busy
                ? "Sending"
                : currentState
                ? "Turn OFF"
                : "Turn ON"}
            </div>
          </div>
        </button>
      );
    }

    /* ===============================================
       SLIDER / RANGE
    =============================================== */

    if (
      type === "range" ||
      type === "slider"
    ) {
      const min =
        Number(
          config.min ?? 0
        );

      const max =
        Number(
          config.max ?? 100
        );

      const step =
        Number(
          config.step ?? 1
        );

      const unit =
        config.unit || "";

      const value =
        controlValues[
          capability.control_id
        ] ??
        Number(
          config.default ??
            min
        );

      return (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-600">
                {
                  capability.name
                }
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {
                  config.description ||
                  "Adjust value"
                }
              </p>
            </div>

            <div
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{
                backgroundColor:
                  `${THEME_COLOR}12`,
                color:
                  THEME_COLOR,
              }}
            >
              {value}
              {unit}
            </div>
          </div>

          <div className="mt-5">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(
                event
              ) =>
                updateControlValue(
                  capability.control_id,
                  Number(
                    event.target
                      .value
                  )
                )
              }
              className="w-full"
              style={{
                accentColor:
                  THEME_COLOR,
              }}
            />

            <div className="mt-2 flex justify-between text-xs text-slate-300">
              <span>
                {min}
                {unit}
              </span>

              <span>
                {max}
                {unit}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              sendCommand(
                capability,
                value
              )
            }
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{
              backgroundColor:
                THEME_COLOR,
            }}
          >
            {busy ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                Sending...
              </>
            ) : (
              <>
                <Zap size={17} />
                Apply
              </>
            )}
          </button>
        </div>
      );
    }

    /* ===============================================
       NUMBER
    =============================================== */

    if (
      type === "number" ||
      type === "numeric"
    ) {
      const unit =
        config.unit || "";

      const value =
        controlValues[
          capability.control_id
        ] ??
        Number(
          config.default ?? 0
        );

      return (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-600">
                {
                  capability.name
                }
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {
                  config.description ||
                  "Set value"
                }
              </p>
            </div>

            <Gauge
              size={20}
              style={{
                color:
                  THEME_COLOR,
              }}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                value={value}
                onChange={(
                  event
                ) =>
                  updateControlValue(
                    capability.control_id,
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 outline-none transition focus:border-[#42B8C5] focus:bg-white focus:ring-4 focus:ring-[#42B8C5]/10"
              />

              {unit && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {unit}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                sendCommand(
                  capability,
                  value
                )
              }
              className="flex min-w-[80px] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
              style={{
                backgroundColor:
                  THEME_COLOR,
              }}
            >
              {busy ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                "Set"
              )}
            </button>
          </div>
        </div>
      );
    }

    /* ===============================================
       DEFAULT
    =============================================== */

    return (
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          sendCommand(
            capability,
            true
          )
        }
        className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-600">
              {
                capability.name
              }
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {
                capability.type
              }
            </p>
          </div>

          {busy ? (
            <Loader2
              size={19}
              className="animate-spin"
              style={{
                color:
                  THEME_COLOR,
              }}
            />
          ) : (
            <Activity
              size={20}
              style={{
                color:
                  THEME_COLOR,
              }}
            />
          )}
        </div>
      </button>
    );
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
  return (
    <main className="min-h-screen bg-[#f7fbfc] text-slate-600">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 animate-pulse">

        {/* HEADER */}
        <header className="mb-7">

          {/* Back to Room */}
          <div className="mb-6 h-5 w-28 rounded-lg bg-slate-200" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            {/* Device identity */}
            <div className="flex items-center gap-4">

              <div className="h-14 w-14 shrink-0 rounded-2xl bg-slate-200" />

              <div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-14 rounded bg-slate-200" />
                  <div className="h-5 w-16 rounded-full bg-slate-200" />
                </div>

                <div className="mt-2 h-8 w-52 rounded-lg bg-slate-200 sm:w-64" />

                <div className="mt-2 h-3 w-32 rounded bg-slate-200" />
              </div>

            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <div className="h-12 w-40 rounded-xl bg-slate-200" />
              <div className="h-12 w-24 rounded-xl bg-slate-200" />
            </div>

          </div>
        </header>


        {/* SUMMARY CARDS */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">

                <div>
                  <div className="h-4 w-16 rounded bg-slate-200" />
                  <div className="mt-3 h-8 w-24 rounded-lg bg-slate-200" />
                </div>

                <div className="h-11 w-11 rounded-xl bg-slate-200" />

              </div>
            </div>
          ))}

        </div>


        {/* LIVE STATUS */}
        <section className="mb-8">

          <div className="mb-5">
            <div className="h-6 w-28 rounded-lg bg-slate-200" />
            <div className="mt-2 h-4 w-72 max-w-full rounded bg-slate-200" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">

                  <div>
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="mt-4 h-7 w-20 rounded-lg bg-slate-200" />
                  </div>

                  <div className="h-10 w-10 rounded-xl bg-slate-200" />

                </div>
              </div>
            ))}

          </div>

        </section>


        {/* CONTROLS */}
        <section className="mb-8">

          <div className="mb-5">
            <div className="h-6 w-24 rounded-lg bg-slate-200" />
            <div className="mt-2 h-4 w-64 max-w-full rounded bg-slate-200" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">

            {[1, 2].map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm"
              >

                <div className="flex items-center justify-between">

                  <div>
                    <div className="h-4 w-28 rounded bg-slate-200" />
                    <div className="mt-3 h-3 w-40 rounded bg-slate-200" />
                  </div>

                  <div className="h-10 w-20 rounded-xl bg-slate-200" />

                </div>

                <div className="mt-6 h-12 w-full rounded-xl bg-slate-200" />

              </div>
            ))}

          </div>

        </section>


        {/* DEVICE INFORMATION */}
        <section className="mb-8">

          <div className="mb-5">
            <div className="h-6 w-40 rounded-lg bg-slate-200" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">

            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-24 rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-48 rounded bg-slate-200" />
              </div>
            ))}

          </div>

        </section>

      </div>
    </main>
  );
}

  /* =====================================================
     DEVICE NOT FOUND
  ===================================================== */

  if (!device) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fbfc] px-4">
        <div className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-8 text-center shadow-sm">
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

          <h1 className="mt-5 text-xl font-semibold text-slate-600">
            Device not found
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            {error ||
              "This device does not exist."}
          </p>

          <button
            onClick={() =>
              router.push(
                `/house/${houseId}/room/${roomId}`
              )
            }
            className="mx-auto mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
            style={{
              backgroundColor:
                THEME_COLOR,
            }}
          >
            <ArrowLeft
              size={18}
            />
            Back to Room
          </button>
        </div>
      </main>
    );
  }

  /* =====================================================
     ONLINE STATUS
  ===================================================== */

  const isOnline =
    status?.online ??
    device.is_online;

  const lastSeen =
    status?.last_seen_at ??
    device.last_seen_at;

  /* =====================================================
     MAIN PAGE
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#f7fbfc] text-slate-600">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="mb-7">
          <button
            onClick={() =>
              router.push(
                `/house/${houseId}/room/${roomId}`
              )
            }
            className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-600"
          >
            <ArrowLeft
              size={17}
            />
            Back to Room
          </button>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor:
                    `${THEME_COLOR}12`,
                  color:
                    THEME_COLOR,
                }}
              >
                <Cpu size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Device
                  </p>

                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      isOnline
                        ? "bg-green-50 text-green-500"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isOnline ? (
                      <Wifi
                        size={12}
                      />
                    ) : (
                      <WifiOff
                        size={12}
                      />
                    )}

                    {isOnline
                      ? "ONLINE"
                      : "OFFLINE"}
                  </span>
                </div>

                <h1 className="mt-1 text-2xl font-semibold text-slate-600 sm:text-3xl">
                  {device.name}
                </h1>

                <p className="mt-1 font-mono text-xs text-slate-400">
                  {device.device_id}
                </p>
              </div>
            </div>

            {/* =================================================
                SYSTEM ACTIONS
            ================================================= */}

            <div className="flex flex-wrap items-center gap-3">

              {/* =============================================
                  GET CURRENT STATUS
              ============================================= */}

              <button
                type="button"
                onClick={
                  requestCurrentStatus
                }
                disabled={
                  statusRequestWaiting
                }
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor:
                    THEME_COLOR,
                }}
              >
                {statusRequestWaiting ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                    Waiting{" "}
                    {statusCountdown}s
                  </>
                ) : (
                  <>
                    <Send
                      size={17}
                    />

                    Get Current
                    Status
                  </>
                )}
              </button>

              {/* =============================================
                  REFRESH
              ============================================= */}

              <button
                type="button"
                onClick={() =>
                  loadDevice(
                    true
                  )
                }
                disabled={
                  refreshing
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* =================================================
            OFFLINE AFTER 50 SECONDS
        ================================================= */}

        {statusOfflineMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-700">
            <WifiOff
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Device is offline
              </p>

              <p className="mt-0.5 text-xs text-amber-600">
                We'll update this when
                it comes online.
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
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
            SUCCESS
        ================================================= */}

        {commandMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-600">
            <Activity
              size={18}
            />

            {commandMessage}
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* STATUS */}

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Status
                </p>

                <p
                  className={`mt-2 text-2xl font-semibold ${
                    isOnline
                      ? "text-green-500"
                      : "text-slate-400"
                  }`}
                >
                  {isOnline
                    ? "Online"
                    : "Offline"}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  isOnline
                    ? "bg-green-50 text-green-500"
                    : "bg-slate-50 text-slate-400"
                }`}
              >
                {isOnline ? (
                  <Wifi size={21} />
                ) : (
                  <WifiOff
                    size={21}
                  />
                )}
              </div>
            </div>
          </div>

          {/* LAST SEEN */}

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Last Seen
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {lastSeen
                    ? formatDate(
                        lastSeen
                      )
                    : "Never"}
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
                <Clock3
                  size={21}
                />
              </div>
            </div>
          </div>

          {/* CONTROLS */}

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Controls
                </p>

                <p className="mt-2 text-3xl font-semibold text-slate-600">
                  {
                    capabilities.length
                  }
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
                <Settings
                  size={21}
                />
              </div>
            </div>
          </div>

          {/* EVENTS */}

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Recent Events
                </p>

                <p className="mt-2 text-3xl font-semibold text-slate-600">
                  {
                    events.length
                  }
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
                <History
                  size={21}
                />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            LIVE STATUS
        ================================================= */}

        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-600">
              Live Status
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Current data reported by
              the ESP controller.
            </p>
          </div>

          {status?.status_data &&
          Object.keys(
            status.status_data
          ).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(
                status.status_data
              ).map(
                ([key, value]) => {
                  const isBoolean =
                    typeof value ===
                    "boolean";

                  return (
                    <div
                      key={key}
                      className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                            {key.replace(
                              /_/g,
                              " "
                            )}
                          </p>

                          <p
                            className={`mt-3 text-2xl font-semibold ${
                              isBoolean
                                ? value
                                  ? "text-green-500"
                                  : "text-slate-400"
                                : "text-slate-600"
                            }`}
                          >
                            {isBoolean
                              ? value
                                ? "ON"
                                : "OFF"
                              : typeof value ===
                                "object"
                              ? JSON.stringify(
                                  value
                                )
                              : String(
                                  value
                                )}
                          </p>
                        </div>

                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor:
                              `${THEME_COLOR}12`,
                            color:
                              THEME_COLOR,
                          }}
                        >
                          <Gauge
                            size={19}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor:
                    `${THEME_COLOR}12`,
                  color:
                    THEME_COLOR,
                }}
              >
                <Activity
                  size={27}
                />
              </div>

              <h3 className="mt-4 font-semibold text-slate-600">
                No live data yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                The ESP has not reported
                any status data yet.
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            CONTROLS
        ================================================= */}

        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-600">
              Controls
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Control your ESP controller
              from here.
            </p>
          </div>

          {capabilities.length >
          0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {capabilities.map(
                (capability) => (
                  <div
                    key={
                      capability.id
                    }
                  >
                    {renderCapability(
                      capability
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor:
                    `${THEME_COLOR}12`,
                  color:
                    THEME_COLOR,
                }}
              >
                <Settings
                  size={27}
                />
              </div>

              <h3 className="mt-4 font-semibold text-slate-600">
                No controls configured
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                This device has no enabled
                capabilities yet.
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            DEVICE INFORMATION
        ================================================= */}

        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-600">
              Device Information
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor:
                      `${THEME_COLOR}12`,
                    color:
                      THEME_COLOR,
                  }}
                >
                  <Cpu
                    size={19}
                  />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Device ID
                  </p>

                  <p className="mt-1 font-mono text-sm font-medium text-slate-600">
                    {
                      device.device_id
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor:
                      `${THEME_COLOR}12`,
                    color:
                      THEME_COLOR,
                  }}
                >
                  <Settings
                    size={19}
                  />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Device Type
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {device.device_type ===
                    "water_controller"
                      ? "Water Controller"
                      : "Generic ESP"}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* =================================================
            RECENT ACTIVITY
        ================================================= */}

        <section>
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-600">
              Recent Activity
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Latest events reported by
              this device.
            </p>
          </div>

          {events.length >
          0 ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
              <div className="divide-y divide-slate-100">
                {events.map(
                  (event) => (
                    <div
                      key={
                        event.id
                      }
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor:
                              `${THEME_COLOR}12`,
                            color:
                              THEME_COLOR,
                          }}
                        >
                          <Activity
                            size={18}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-600">
                            {eventText(
                              event
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {event.source ||
                              "device"}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-slate-400">
                          {formatDate(
                            event.created_at
                          )}
                        </p>

                        {event.value && (
                          <p className="mt-1 max-w-[180px] truncate font-mono text-[10px] text-slate-300">
                            {JSON.stringify(
                              event.value
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor:
                    `${THEME_COLOR}12`,
                  color:
                    THEME_COLOR,
                }}
              >
                <History
                  size={27}
                />
              </div>

              <h3 className="mt-4 font-semibold text-slate-600">
                No activity yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Device events will appear
                here once your ESP starts
                communicating with Supabase.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
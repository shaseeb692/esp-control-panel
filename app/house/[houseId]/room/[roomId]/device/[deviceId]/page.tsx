"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

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
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  Siren,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

/* =====================================================
   THEME
===================================================== */

const THEME_COLOR =
  "#42B8C5";

const STATUS_TIMEOUT_MS =
  50_000;

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
  config: Record<
    string,
    any
  > | null;
  created_at: string;
  sort_order: number;
  enabled: boolean;
};

type DeviceStatus = {
  id: number;
  device_id: string;
  status_data: Record<
    string,
    any
  > | null;
  updated_at: string;
  online: boolean;
  last_seen_at: string | null;
};

type DeviceEvent = {
  id: number;
  device_id: string;
  control_id: string | null;
  event_type: string;
  value: Record<
    string,
    any
  > | null;
  created_at: string;
  source: string | null;
};

type SecurityState =
  | "active"
  | "locked"
  | "emergency_locked"
  | "stolen"
  | "lost";

type RecoveryResponse = {
  success?: boolean;
  codes?: string[] | {
    codes?: string[];
  };
  warning?: string;
  error?: string;
};

/* =====================================================
   MAIN
===================================================== */

export default function DevicePage() {
  const router =
    useRouter();

  const params =
    useParams();

  const houseId =
    typeof params.houseId ===
    "string"
      ? params.houseId
      : "";

  const roomId =
    typeof params.roomId ===
    "string"
      ? params.roomId
      : "";

  const deviceId =
    typeof params.deviceId ===
    "string"
      ? params.deviceId
      : "";

  /* ===================================================
     STATE
  =================================================== */

  const [device, setDevice] =
    useState<Device | null>(
      null
    );

  const [
    capabilities,
    setCapabilities,
  ] = useState<
    Capability[]
  >([]);

  const [status, setStatus] =
    useState<DeviceStatus | null>(
      null
    );

  const [events, setEvents] =
    useState<DeviceEvent[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    sendingCommand,
    setSendingCommand,
  ] = useState<string | null>(
    null
  );

  const [error, setError] =
    useState("");

  const [
    commandMessage,
    setCommandMessage,
  ] = useState("");

  const [
    controlValues,
    setControlValues,
  ] = useState<
    Record<string, number>
  >({});

  /* ===================================================
     STATUS TIMER
  =================================================== */

  const [
    statusRequestWaiting,
    setStatusRequestWaiting,
  ] = useState(false);

  const [
    statusCountdown,
    setStatusCountdown,
  ] = useState(0);

  const [
    statusOfflineMessage,
    setStatusOfflineMessage,
  ] = useState(false);

  const statusTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const statusCountdownRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  const statusRequestStartedAtRef =
    useRef<number | null>(
      null
    );

  /* ===================================================
     SECURITY
  =================================================== */

  const [
    securityState,
    setSecurityState,
  ] = useState<SecurityState>(
    "active"
  );

  const [
    securityReason,
    setSecurityReason,
  ] = useState<
    string | null
  >(null);

  const [
    securityLoading,
    setSecurityLoading,
  ] = useState(false);

  const [
    securityMessage,
    setSecurityMessage,
  ] = useState("");

  const [
    recoveryCodes,
    setRecoveryCodes,
  ] = useState<string[]>(
    []
  );

  const [
    recoveryLoading,
    setRecoveryLoading,
  ] = useState(false);

  const [
    copiedCode,
    setCopiedCode,
  ] = useState<
    string | null
  >(null);

  /* ===================================================
     CLEAR STATUS
  =================================================== */

  function clearStatusWaiting() {
    if (
      statusTimeoutRef.current
    ) {
      clearTimeout(
        statusTimeoutRef.current
      );

      statusTimeoutRef.current =
        null;
    }

    if (
      statusCountdownRef.current
    ) {
      clearInterval(
        statusCountdownRef.current
      );

      statusCountdownRef.current =
        null;
    }

    statusRequestStartedAtRef.current =
      null;

    setStatusRequestWaiting(
      false
    );

    setStatusCountdown(0);

    setSendingCommand(
      (current) =>
        current ===
        "__STATUS__"
          ? null
          : current
    );
  }

  /* ===================================================
     STATUS WAIT
  =================================================== */

  function startStatusWaiting() {
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

    const startedAt =
      Date.now();

    statusRequestStartedAtRef.current =
      startedAt;

    setStatusRequestWaiting(
      true
    );

    setStatusCountdown(50);

    setStatusOfflineMessage(
      false
    );

    statusCountdownRef.current =
      setInterval(() => {
        const elapsed =
          Math.floor(
            (Date.now() -
              startedAt) /
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

        if (
          remaining <= 0 &&
          statusCountdownRef.current
        ) {
          clearInterval(
            statusCountdownRef.current
          );

          statusCountdownRef.current =
            null;
        }
      }, 1000);

    statusTimeoutRef.current =
      setTimeout(() => {
        setStatusRequestWaiting(
          false
        );

        setStatusCountdown(0);

        setSendingCommand(
          (current) =>
            current ===
            "__STATUS__"
              ? null
              : current
        );

        setStatusOfflineMessage(
          true
        );

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

  /* ===================================================
     FRESH STATUS
  =================================================== */

  function isFreshStatusResponse(
    incoming: DeviceStatus
  ) {
    const started =
      statusRequestStartedAtRef.current;

    if (!started) {
      return false;
    }

    const updated =
      new Date(
        incoming.updated_at
      ).getTime();

    if (
      Number.isNaN(updated)
    ) {
      return false;
    }

    return updated >= started;
  }

  /* ===================================================
     LOAD SECURITY
  =================================================== */

  async function loadSecurity() {
    if (!deviceId) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/device/security?device_id=${encodeURIComponent(
            deviceId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load security state."
        );
      }

      setSecurityState(
        data?.state ||
          "active"
      );

      setSecurityReason(
        data?.data?.reason ??
          null
      );
    } catch (err: any) {
      console.error(err);
    }
  }

  /* ===================================================
     SECURITY ACTION
  =================================================== */

  async function securityAction(
    action:
      | "lock"
      | "unlock"
      | "emergency_lock"
      | "lost"
      | "stolen"
  ) {
    if (!device) {
      return;
    }

    const labels: Record<
      string,
      string
    > = {
      lock: "Lock",
      unlock: "Unlock",
      emergency_lock:
        "Emergency Lock",
      lost: "Lost",
      stolen: "Stolen",
    };

    const confirmed =
      window.confirm(
        `Are you sure you want to ${labels[action]} this device?`
      );

    if (!confirmed) {
      return;
    }

    setSecurityLoading(
      true
    );

    setSecurityMessage("");

    setError("");

    try {
      const response =
        await fetch(
          "/api/device/security",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              device_id:
                device.device_id,
              action,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Security action failed."
        );
      }

      setSecurityMessage(
        `Device ${labels[
          action
        ].toLowerCase()} action completed.`
      );

      await loadSecurity();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Security action failed."
      );
    } finally {
      setSecurityLoading(
        false
      );
    }
  }

  /* ===================================================
     GENERATE RECOVERY CODES
  =================================================== */

  async function generateRecoveryCodes() {
    if (!device) {
      return;
    }

    const confirmed =
      window.confirm(
        "Generate a new recovery-code set? The previous recovery codes will immediately become invalid."
      );

    if (!confirmed) {
      return;
    }

    setRecoveryLoading(
      true
    );

    setError("");

    setSecurityMessage("");

    setRecoveryCodes([]);

    try {
      const response =
        await fetch(
          "/api/device/recovery-codes",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              device_id:
                device.device_id,
            }),
          }
        );

      const data =
        (await response.json()) as RecoveryResponse;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to generate recovery codes."
        );
      }

      let codes: string[] =
        [];

      if (
        Array.isArray(
          data.codes
        )
      ) {
        codes =
          data.codes;
      } else if (
        data.codes &&
        typeof data.codes ===
          "object" &&
        Array.isArray(
          data.codes.codes
        )
      ) {
        codes =
          data.codes.codes;
      }

      setRecoveryCodes(
        codes
      );

      setSecurityMessage(
        "New recovery codes generated. Save them now — they cannot be retrieved later."
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to generate recovery codes."
      );
    } finally {
      setRecoveryLoading(
        false
      );
    }
  }

  /* ===================================================
     COPY
  =================================================== */

  async function copyCode(
    code: string
  ) {
    try {
      await navigator.clipboard.writeText(
        code
      );

      setCopiedCode(
        code
      );

      setTimeout(
        () =>
          setCopiedCode(
            null
          ),
        1500
      );
    } catch {
      setError(
        "Unable to copy code."
      );
    }
  }

  /* ===================================================
     LOAD DEVICE
  =================================================== */

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
        data: {
          session,
        },
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
        data:
          capabilitiesData,
        error:
          capabilitiesError,
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

      if (
        capabilitiesError
      ) {
        throw capabilitiesError;
      }

      const loadedCapabilities =
        (capabilitiesData ||
          []) as Capability[];

      setCapabilities(
        loadedCapabilities
      );

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
                [
                  "range",
                  "slider",
                  "number",
                  "numeric",
                ].includes(
                  capability.type
                )
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

      await loadSecurity();
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

  /* ===================================================
     INITIAL LOAD
  =================================================== */

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

  /* ===================================================
     CLEANUP
  =================================================== */

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

  /* ===================================================
     REALTIME
  =================================================== */

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
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "device_status",
            filter:
              `device_id=eq.${device.device_id}`,
          },
          (payload) => {
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
              const incoming =
                payload.new as DeviceStatus;

              setStatus(
                incoming
              );

              if (
                statusRequestWaiting &&
                isFreshStatusResponse(
                  incoming
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
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "device_events",
            filter:
              `device_id=eq.${device.device_id}`,
          },
          (payload) => {
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
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    device?.device_id,
    statusRequestWaiting,
  ]);

  /* ===================================================
     SEND COMMAND
  =================================================== */

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
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace(
          "/auth/login"
        );

        return;
      }

      const commandText =
        JSON.stringify({
          control_id:
            capability.control_id,
          value,
        });

      const response =
        await fetch(
          "/api/command",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              device_id:
                device.device_id,
              message:
                commandText,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to send command."
        );
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

  /* ===================================================
     STATUS REQUEST
  =================================================== */

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
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace(
          "/auth/login"
        );

        return;
      }

      startStatusWaiting();

      const response =
        await fetch(
          "/api/command",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              device_id:
                device.device_id,
              message:
                "STATUS",
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        clearStatusWaiting();

        throw new Error(
          data?.error ||
            "Unable to request device status."
        );
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

  /* ===================================================
     VALUE
  =================================================== */

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

  /* ===================================================
     DATE
  =================================================== */

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

  /* ===================================================
     EVENT
  =================================================== */

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

  /* ===================================================
     BOOLEAN STATUS
  =================================================== */

  function getBooleanStatus(
    controlId: string
  ) {
    const value =
      status?.status_data?.[
        controlId
      ];

    return typeof value ===
      "boolean"
      ? value
      : false;
  }

  /* ===================================================
     CAPABILITY
  =================================================== */

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

    if (
      [
        "switch",
        "toggle",
        "button",
      ].includes(type)
    ) {
      const currentState =
        getBooleanStatus(
          capability.control_id
        );

      return (
        <button
          type="button"
          disabled={
            busy ||
            securityState !==
              "active"
          }
          onClick={() =>
            sendCommand(
              capability,
              !currentState
            )
          }
          className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
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
                <Power size={20} />
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
              disabled={
                securityState !==
                "active"
              }
              onChange={(event) =>
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
            disabled={
              busy ||
              securityState !==
                "active"
            }
            onClick={() =>
              sendCommand(
                capability,
                value
              )
            }
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
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
                disabled={
                  securityState !==
                  "active"
                }
                onChange={(event) =>
                  updateControlValue(
                    capability.control_id,
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 outline-none"
              />

              {unit && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {unit}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={
                busy ||
                securityState !==
                  "active"
              }
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

    return (
      <button
        type="button"
        disabled={
          busy ||
          securityState !==
            "active"
        }
        onClick={() =>
          sendCommand(
            capability,
            true
          )
        }
        className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm disabled:opacity-60"
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

  /* ===================================================
     LOADING
  =================================================== */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7fbfc]">
        <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
          <div className="h-6 w-32 rounded bg-slate-200" />

          <div className="mt-8 h-20 w-80 rounded-2xl bg-slate-200" />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-28 rounded-[24px] bg-white shadow-sm"
                />
              )
            )}
          </div>

          <div className="mt-8 h-48 rounded-[28px] bg-white shadow-sm" />

          <div className="mt-8 h-48 rounded-[28px] bg-white shadow-sm" />
        </div>
      </main>
    );
  }

  /* ===================================================
     NOT FOUND
  =================================================== */

  if (!device) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fbfc] px-4">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-sm">
          <Cpu
            size={35}
            className="mx-auto"
            style={{
              color:
                THEME_COLOR,
            }}
          />

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

  /* ===================================================
     DERIVED
  =================================================== */

  const isOnline =
    status?.online ??
    device.is_online;

  const lastSeen =
    status?.last_seen_at ??
    device.last_seen_at;

  const commandsBlocked =
    securityState !==
    "active";

  const securityLabel =
    securityState
      .replace(
        "_",
        " "
      )
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase()
      );

  /* ===================================================
     MAIN
  =================================================== */

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
            className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft
              size={17}
            />
            Back to Room
          </button>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor:
                    `${THEME_COLOR}12`,
                  color:
                    THEME_COLOR,
                }}
              >
                <Cpu
                  size={28}
                />
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
                  {
                    device.device_id
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={
                  requestCurrentStatus
                }
                disabled={
                  statusRequestWaiting ||
                  commandsBlocked
                }
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
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
                    {
                      statusCountdown
                    }
                    s
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
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm disabled:opacity-60"
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
            SECURITY BANNER
        ================================================= */}

        {commandsBlocked && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-red-600">
            <ShieldAlert
              size={21}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Device is{" "}
                {securityLabel}
              </p>

              <p className="mt-1 text-xs text-red-500">
                Commands are blocked
                until the device is
                returned to an active
                security state.
              </p>

              {securityReason && (
                <p className="mt-1 text-xs text-red-400">
                  Reason:{" "}
                  {
                    securityReason
                  }
                </p>
              )}
            </div>
          </div>
        )}

        {/* =================================================
            OFFLINE
        ================================================= */}

        {statusOfflineMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-700">
            <WifiOff
              size={19}
              className="mt-0.5"
            />

            <div>
              <p className="font-semibold">
                Device is offline
              </p>

              <p className="mt-0.5 text-xs">
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

        {securityMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
            <Shield
              size={18}
            />

            {securityMessage}
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
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

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-400">
              Last Seen
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-600">
              {formatDate(
                lastSeen
              )}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-400">
              Controls
            </p>

            <p className="mt-2 text-3xl font-semibold text-slate-600">
              {
                capabilities.length
              }
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-400">
              Security
            </p>

            <p
              className={`mt-2 text-xl font-semibold ${
                securityState ===
                "active"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {securityLabel}
            </p>
          </div>
        </div>

        {/* =================================================
            SECURITY CENTER
        ================================================= */}

        <section className="mb-8">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Shield
                size={21}
                style={{
                  color:
                    THEME_COLOR,
                }}
              />

              <h2 className="text-xl font-semibold text-slate-600">
                Security Center
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-400">
              Protect, lock, recover and
              manage this device.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">

            {/* CURRENT SECURITY */}

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    Current State
                  </p>

                  <p
                    className={`mt-2 text-2xl font-semibold ${
                      securityState ===
                      "active"
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {
                      securityLabel
                    }
                  </p>
                </div>

                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    securityState ===
                    "active"
                      ? "bg-green-50 text-green-500"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {securityState ===
                  "active" ? (
                    <Shield
                      size={23}
                    />
                  ) : (
                    <ShieldAlert
                      size={23}
                    />
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">

                <button
                  type="button"
                  disabled={
                    securityLoading ||
                    securityState !==
                      "active"
                  }
                  onClick={() =>
                    securityAction(
                      "lock"
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"
                >
                  <Lock
                    size={17}
                  />
                  Lock
                </button>

                <button
                  type="button"
                  disabled={
                    securityLoading ||
                    securityState ===
                      "active"
                  }
                  onClick={() =>
                    securityAction(
                      "unlock"
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  style={{
                    backgroundColor:
                      THEME_COLOR,
                  }}
                >
                  {securityLoading ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Unlock
                      size={17}
                    />
                  )}
                  Unlock
                </button>

              </div>
            </div>

            {/* HIGH RISK */}

            <div className="rounded-[24px] border border-red-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
                  <Siren
                    size={22}
                  />
                </div>

                <div>
                  <p className="font-semibold text-slate-600">
                    Emergency Protection
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Immediately block device
                    access and revoke its
                    active sessions.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">

                <button
                  type="button"
                  disabled={
                    securityLoading
                  }
                  onClick={() =>
                    securityAction(
                      "emergency_lock"
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Siren
                    size={17}
                  />
                  Emergency Lock
                </button>

                <button
                  type="button"
                  disabled={
                    securityLoading
                  }
                  onClick={() =>
                    securityAction(
                      "lost"
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 disabled:opacity-50"
                >
                  <ShieldAlert
                    size={17}
                  />
                  Mark Lost
                </button>

                <button
                  type="button"
                  disabled={
                    securityLoading
                  }
                  onClick={() =>
                    securityAction(
                      "stolen"
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 disabled:opacity-50 sm:col-span-2"
                >
                  <AlertTriangle
                    size={17}
                  />
                  Mark Stolen
                </button>

              </div>
            </div>

            {/* RECOVERY */}

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor:
                        `${THEME_COLOR}12`,
                      color:
                        THEME_COLOR,
                    }}
                  >
                    <KeyRound
                      size={22}
                    />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-600">
                      Recovery Codes
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Generate three one-time
                      recovery codes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    recoveryLoading ||
                    securityState !==
                      "active"
                  }
                  onClick={
                    generateRecoveryCodes
                  }
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  style={{
                    backgroundColor:
                      THEME_COLOR,
                  }}
                >
                  {recoveryLoading ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <KeyRound
                      size={17}
                    />
                  )}

                  Generate New Codes
                </button>
              </div>

              {recoveryCodes.length >
                0 && (
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={19}
                      className="mt-0.5 shrink-0 text-amber-600"
                    />

                    <div>
                      <p className="font-semibold text-amber-700">
                        Save these codes now
                      </p>

                      <p className="mt-1 text-xs text-amber-600">
                        These codes are shown
                        only once. The database
                        stores hashes, not the
                        plaintext codes.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {recoveryCodes.map(
                      (code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() =>
                            copyCode(
                              code
                            )
                          }
                          className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3 font-mono text-sm font-bold tracking-wider text-slate-700"
                        >
                          <span>
                            {code}
                          </span>

                          {copiedCode ===
                          code ? (
                            <Check
                              size={16}
                              className="text-green-500"
                            />
                          ) : (
                            <Copy
                              size={16}
                              className="text-slate-400"
                            />
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

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

                        <Gauge
                          size={19}
                          style={{
                            color:
                              THEME_COLOR,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <Activity
                size={27}
                className="mx-auto"
                style={{
                  color:
                    THEME_COLOR,
                }}
              />

              <h3 className="mt-4 font-semibold text-slate-600">
                No live data yet
              </h3>

              <p className="mt-2 text-sm text-slate-400">
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
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <Settings
                size={27}
                className="mx-auto"
                style={{
                  color:
                    THEME_COLOR,
                }}
              />

              <h3 className="mt-4 font-semibold text-slate-600">
                No controls configured
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                This device has no enabled
                capabilities yet.
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            DEVICE INFO
        ================================================= */}

        <section className="mb-8">
          <h2 className="mb-5 text-xl font-semibold text-slate-600">
            Device Information
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Cpu
                  size={19}
                  style={{
                    color:
                      THEME_COLOR,
                  }}
                />

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
                <Settings
                  size={19}
                  style={{
                    color:
                      THEME_COLOR,
                  }}
                />

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
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <History
                size={27}
                className="mx-auto"
                style={{
                  color:
                    THEME_COLOR,
                }}
              />

              <h3 className="mt-4 font-semibold text-slate-600">
                No activity yet
              </h3>

              <p className="mt-2 text-sm text-slate-400">
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
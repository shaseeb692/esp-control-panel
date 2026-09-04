"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  Siren,
  Unlock,
  Wifi,
  WifiOff,
  Activity,
  Clock3,
  Cpu,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const THEME_COLOR = "#42B8C5";
const STATUS_TIMEOUT_MS = 50_000;

const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2400&q=85";

const SKY_STOPS = [
  { minute: 0, color: "#070B1A" },
  { minute: 240, color: "#10182E" },
  { minute: 300, color: "#263B63" },
  { minute: 330, color: "#E58A72" },
  { minute: 360, color: "#F4B47D" },
  { minute: 420, color: "#78B7D8" },
  { minute: 720, color: "#65B9E8" },
  { minute: 1020, color: "#F09A73" },
  { minute: 1080, color: "#51385E" },
  { minute: 1110, color: "#171B36" },
  { minute: 1440, color: "#070B1A" },
];

type Device = {
  id: string;
  room_id: string;
  device_id: string;
  name: string;
  device_type: string | null;
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
  sort_order: number | null;
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

type SecurityState =
  | "active"
  | "locked"
  | "emergency_locked"
  | "stolen"
  | "lost";

type RecoveryResponse = {
  success?: boolean;
  codes?: string[] | { codes?: string[] };
  warning?: string;
  error?: string;
};

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");

  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((value) =>
        Math.max(0, Math.min(255, Math.round(value)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function interpolateHex(a: string, b: string, amount: number) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);

  return rgbToHex(
    c1.r + (c2.r - c1.r) * amount,
    c1.g + (c2.g - c1.g) * amount,
    c1.b + (c2.b - c1.b) * amount
  );
}

function getSkyGradient(date: Date) {
  const minutes =
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60;

  let previous = SKY_STOPS[0];
  let next = SKY_STOPS[SKY_STOPS.length - 1];

  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (
      minutes >= SKY_STOPS[i].minute &&
      minutes <= SKY_STOPS[i + 1].minute
    ) {
      previous = SKY_STOPS[i];
      next = SKY_STOPS[i + 1];
      break;
    }
  }

  const range = next.minute - previous.minute;
  const amount =
    range <= 0 ? 0 : (minutes - previous.minute) / range;

  const color = interpolateHex(
    previous.color,
    next.color,
    amount
  );

  return {
    color,
    css: `linear-gradient(135deg, ${color} 0%, ${interpolateHex(
      color,
      "#ffffff",
      0.12
    )} 45%, ${interpolateHex(
      color,
      "#000000",
      0.18
    )} 100%)`,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Never";

  try {
    return new Date(value).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSecurityLabel(state: SecurityState) {
  switch (state) {
    case "active":
      return "Active";
    case "locked":
      return "Locked";
    case "emergency_locked":
      return "Emergency Locked";
    case "stolen":
      return "Stolen";
    case "lost":
      return "Lost";
    default:
      return "Unknown";
  }
}

function getSecurityDescription(state: SecurityState) {
  switch (state) {
    case "active":
      return "Device commands are enabled.";
    case "locked":
      return "Device commands are currently blocked.";
    case "emergency_locked":
      return "Emergency protection is enabled and device commands are blocked.";
    case "stolen":
      return "Device is marked as stolen and commands are blocked.";
    case "lost":
      return "Device is marked as lost and commands are blocked.";
    default:
      return "";
  }
}

function getSecurityBadgeClass(state: SecurityState) {
  switch (state) {
    case "active":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "locked":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "emergency_locked":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    case "stolen":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    case "lost":
      return "border-orange-400/30 bg-orange-400/10 text-orange-300";
    default:
      return "border-white/20 bg-white/10 text-white/70";
  }
}

export default function DevicePage() {
  const params = useParams();
  const router = useRouter();

  const houseId = String(params.houseId);
  const roomId = String(params.roomId);
  const deviceRowId = String(params.deviceId);

  const [device, setDevice] = useState<Device | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState("");

  const [securityState, setSecurityState] =
    useState<SecurityState>("active");
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securityOpen, setSecurityOpen] = useState(false);

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryWarning, setRecoveryWarning] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const sky = useMemo(
    () => getSkyGradient(currentTime),
    [currentTime]
  );

  const isNight =
    currentTime.getHours() < 6 ||
    currentTime.getHours() >= 18;

  const commandsBlocked = securityState !== "active";

  const sortedCapabilities = useMemo(() => {
    return [...capabilities].sort(
      (a, b) =>
        (a.sort_order ?? 0) -
        (b.sort_order ?? 0)
    );
  }, [capabilities]);

  const glass = isNight
    ? "border-white/15 bg-black/[0.30] text-white"
    : "border-black/10 bg-white/[0.55] text-black";

  const glassSoft = isNight
    ? "border-white/10 bg-white/[0.07]"
    : "border-black/10 bg-white/[0.42]";

  const muted = isNight
    ? "text-white/50"
    : "text-black/50";

  const loadDevice = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth/login");
        return;
      }

      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select(
            "id,room_id,device_id,name,device_type,is_online,last_seen_at,created_at,updated_at"
          )
          .eq("id", deviceRowId)
          .eq("room_id", roomId)
          .single();

      if (deviceError) throw deviceError;

      setDevice(deviceData);

      const {
        data: capabilityData,
        error: capabilityError,
      } = await supabase
        .from("device_capabilities")
        .select(
          "id,device_id,control_id,name,type,config,created_at,sort_order,enabled"
        )
        .eq("device_id", deviceData.device_id)
        .eq("enabled", true)
        .order("sort_order", { ascending: true });

      if (capabilityError) throw capabilityError;

      setCapabilities(capabilityData ?? []);

      const { data: statusData, error: statusError } =
        await supabase
          .from("device_status")
          .select(
            "id,device_id,status_data,updated_at,online,last_seen_at"
          )
          .eq("device_id", deviceData.device_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (statusError) throw statusError;

      setStatus(statusData);

      const { data: eventData, error: eventError } =
        await supabase
          .from("device_events")
          .select(
            "id,device_id,control_id,event_type,value,created_at,source"
          )
          .eq("device_id", deviceData.device_id)
          .order("created_at", { ascending: false })
          .limit(20);

      if (eventError) throw eventError;

      setEvents(eventData ?? []);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ?? "Failed to load device."
      );
    } finally {
      setLoading(false);
    }
  }, [deviceRowId, roomId, router]);

  const loadSecurity = useCallback(async () => {
    if (!device?.device_id) return;

    try {
      setSecurityLoading(true);
      setSecurityError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSecurityError("Please login again.");
        return;
      }

      const response = await fetch(
        `/api/device/security?device_id=${encodeURIComponent(
          device.device_id
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Failed to load security state."
        );
      }

      if (data?.state) {
        setSecurityState(
          data.state as SecurityState
        );
      }
    } catch (err: any) {
      console.error(err);
      setSecurityError(
        err?.message ??
          "Failed to load security state."
      );
    } finally {
      setSecurityLoading(false);
    }
  }, [device?.device_id]);

  useEffect(() => {
    loadDevice();
  }, [loadDevice]);

  useEffect(() => {
    if (!device?.device_id) return;

    loadSecurity();

    const statusChannel = supabase
      .channel(
        `device-status-${device.device_id}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_status",
          filter: `device_id=eq.${device.device_id}`,
        },
        (
          payload: RealtimePostgresChangesPayload<DeviceStatus>
        ) => {
          if (payload.eventType === "DELETE") {
            return;
          }

          if (payload.new) {
            setStatus(
              payload.new as DeviceStatus
            );
          }
        }
      )
      .subscribe();

    const eventChannel = supabase
      .channel(
        `device-events-${device.device_id}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_events",
          filter: `device_id=eq.${device.device_id}`,
        },
        (
          payload: RealtimePostgresChangesPayload<DeviceEvent>
        ) => {
          if (payload.eventType !== "INSERT")
            return;

          if (payload.new) {
            setEvents((current) =>
              [
                payload.new as DeviceEvent,
                ...current,
              ].slice(0, 20)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(eventChannel);
    };
  }, [device?.device_id, loadSecurity]);

  const sendCommand = async (
    controlId: string,
    value: any
  ): Promise<boolean> => {
    if (!device?.device_id) return false;

    if (commandsBlocked) {
      setError(
        `Commands are blocked because the device is ${getSecurityLabel(
          securityState
        ).toLowerCase()}.`
      );
      return false;
    }

    try {
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return false;
      }

      const response = await fetch(
        "/api/command",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            device_id: device.device_id,
            message: JSON.stringify({
              control_id: controlId,
              value,
            }),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Failed to send command."
        );
      }

      return true;
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ??
          "Failed to send command."
      );
      return false;
    }
  };

  const requestCurrentStatus = async () => {
    if (!device?.device_id) return;

    if (commandsBlocked) {
      setError(
        "Status request is blocked while the device is locked."
      );
      return;
    }

    try {
      setStatusLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const previousUpdatedAt = status?.updated_at
        ? new Date(
            status.updated_at
          ).getTime()
        : 0;

      const response = await fetch(
        "/api/command",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            device_id: device.device_id,
            message: "STATUS",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Failed to request status."
        );
      }

      const started = Date.now();

      while (
        Date.now() - started <
        STATUS_TIMEOUT_MS
      ) {
        const { data: latestStatus } =
          await supabase
            .from("device_status")
            .select(
              "id,device_id,status_data,updated_at,online,last_seen_at"
            )
            .eq(
              "device_id",
              device.device_id
            )
            .order("updated_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (latestStatus) {
          const updatedTime = new Date(
            latestStatus.updated_at
          ).getTime();

          if (updatedTime > previousUpdatedAt) {
            setStatus(latestStatus);
            break;
          }
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ??
          "Failed to request status."
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const securityAction = async (
    action:
      | "lock"
      | "unlock"
      | "emergency_lock"
      | "lost"
      | "stolen"
  ) => {
    if (!device?.device_id) return;

    const labels: Record<
      string,
      string
    > = {
      lock: "Lock this device?",
      unlock: "Unlock this device?",
      emergency_lock:
        "Enable emergency lock?",
      lost: "Mark this device as LOST?",
      stolen:
        "Mark this device as STOLEN?",
    };

    if (
      !window.confirm(
        labels[action] ?? "Continue?"
      )
    ) {
      return;
    }

    try {
      setSecurityLoading(true);
      setSecurityError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSecurityError(
          "Please login again."
        );
        return;
      }

      const response = await fetch(
        "/api/device/security",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            device_id: device.device_id,
            action,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Security action failed."
        );
      }

      if (data?.state) {
        setSecurityState(
          data.state as SecurityState
        );
      } else {
        await loadSecurity();
      }
    } catch (err: any) {
      console.error(err);
      setSecurityError(
        err?.message ??
          "Security action failed."
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const generateRecoveryCodes =
    async () => {
      if (!device?.device_id) return;

      if (
        !window.confirm(
          "Generate a new recovery-code set? Any previous recovery codes will be invalidated."
        )
      ) {
        return;
      }

      try {
        setRecoveryLoading(true);
        setSecurityError("");
        setRecoveryCodes([]);
        setRecoveryWarning("");
        setCopied(false);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setSecurityError(
            "Please login again."
          );
          return;
        }

        const response = await fetch(
          "/api/device/recovery-codes",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              device_id:
                device.device_id,
            }),
          }
        );

        const data: RecoveryResponse =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ??
              "Failed to generate recovery codes."
          );
        }

        let codes: string[] = [];

        if (Array.isArray(data.codes)) {
          codes = data.codes;
        } else if (data.codes?.codes) {
          codes = data.codes.codes;
        }

        setRecoveryCodes(codes);

        setRecoveryWarning(
          data.warning ??
            "Save these codes now. They cannot be retrieved later."
        );
      } catch (err: any) {
        console.error(err);
        setSecurityError(
          err?.message ??
            "Failed to generate recovery codes."
        );
      } finally {
        setRecoveryLoading(false);
      }
    };

  const copyRecoveryCodes =
    async () => {
      if (!recoveryCodes.length) return;

      try {
        await navigator.clipboard.writeText(
          recoveryCodes.join("\n")
        );

        setCopied(true);

        window.setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch {
        setSecurityError(
          "Could not copy recovery codes."
        );
      }
    };

  const renderControl = (
    capability: Capability
  ) => {
    const controlId =
      capability.control_id;

    const type =
      capability.type?.toLowerCase();

    const config =
      capability.config ?? {};

    const currentValue =
      status?.status_data?.[
        controlId
      ] ??
      config.default ??
      false;

    const disabled =
      commandsBlocked;

    if (
      type === "switch" ||
      type === "toggle" ||
      type === "boolean"
    ) {
      const checked =
        Boolean(currentValue);

      return (
        <button
          key={capability.id}
          type="button"
          disabled={disabled}
          onClick={() =>
            sendCommand(
              controlId,
              !checked
            )
          }
          className={`group relative overflow-hidden rounded-[26px] border p-5 text-left backdrop-blur-2xl shadow-xl transition duration-300 ${glass} ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : "hover:-translate-y-0.5 hover:shadow-2xl"
          }`}
        >
          <div
            className="absolute inset-0 opacity-0 transition group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at 90% 10%, ${THEME_COLOR}22, transparent 45%)`,
            }}
          />

          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate font-semibold">
                {capability.name}
              </div>

              <div
                className={`mt-1 text-xs ${
                  checked
                    ? "text-emerald-400"
                    : muted
                }`}
              >
                {checked ? "ON" : "OFF"}
              </div>
            </div>

            <div
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                checked
                  ? "bg-[var(--theme)]"
                  : isNight
                  ? "bg-white/15"
                  : "bg-black/10"
              }`}
              style={
                {
                  "--theme":
                    THEME_COLOR,
                } as React.CSSProperties
              }
            >
              <div
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition ${
                  checked
                    ? "left-6"
                    : "left-1"
                }`}
              />
            </div>
          </div>
        </button>
      );
    }

    if (
      type === "range" ||
      type === "slider"
    ) {
      const min = Number(
        config.min ?? 0
      );

      const max = Number(
        config.max ?? 100
      );

      const step = Number(
        config.step ?? 1
      );

      const value = Number(
        currentValue ?? min
      );

      return (
        <div
          key={capability.id}
          className={`rounded-[26px] border p-5 backdrop-blur-2xl shadow-xl ${glass}`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="font-semibold">
              {capability.name}
            </span>

            <span
              className="rounded-xl border px-3 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: `${THEME_COLOR}18`,
                borderColor: `${THEME_COLOR}35`,
                color: THEME_COLOR,
              }}
            >
              {value}
            </span>
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) =>
              sendCommand(
                controlId,
                Number(
                  e.target.value
                )
              )
            }
            className="w-full"
            style={{
              accentColor:
                THEME_COLOR,
            }}
          />

          <div
            className={`mt-2 flex justify-between text-[10px] ${muted}`}
          >
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>
      );
    }

    if (
      type === "number" ||
      type === "numeric"
    ) {
      return (
        <div
          key={capability.id}
          className={`rounded-[26px] border p-5 backdrop-blur-2xl shadow-xl ${glass}`}
        >
          <div className="mb-3 font-semibold">
            {capability.name}
          </div>

          <input
            type="number"
            value={currentValue ?? ""}
            min={config.min}
            max={config.max}
            step={config.step ?? 1}
            disabled={disabled}
            onChange={(e) =>
              sendCommand(
                controlId,
                Number(
                  e.target.value
                )
              )
            }
            className={`w-full rounded-2xl border px-4 py-3 outline-none backdrop-blur-xl ${
              isNight
                ? "border-white/10 bg-white/[0.07]"
                : "border-black/10 bg-white/40"
            }`}
          />
        </div>
      );
    }

    return (
      <button
        key={capability.id}
        type="button"
        disabled={disabled}
        onClick={() =>
          sendCommand(
            controlId,
            config.value ?? true
          )
        }
        className={`group relative overflow-hidden rounded-[26px] border p-5 text-left backdrop-blur-2xl shadow-xl transition duration-300 ${glass} ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:-translate-y-0.5 hover:shadow-2xl"
        }`}
      >
        <div
          className="absolute inset-0 opacity-0 transition group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at 90% 10%, ${THEME_COLOR}20, transparent 50%)`,
          }}
        />

        <div className="relative font-semibold">
          {capability.name}
        </div>

        {config.description && (
          <div
            className={`relative mt-1 text-xs ${muted}`}
          >
            {config.description}
          </div>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 text-white">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg,#080C1A,#18304A,#42B8C5)",
          }}
        />

        <div className="relative z-10 rounded-[30px] border border-white/15 bg-black/25 px-7 py-5 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">
              Loading device...
            </span>
          </div>
        </div>
      </main>
    );
  }

  if (!device) {
    return (
      <main className="relative min-h-screen overflow-hidden p-5 text-white">
        <div
          className="fixed inset-0"
          style={{
            backgroundImage: `url(${DEFAULT_BACKGROUND})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />

        <div
          className="fixed inset-0"
          style={{
            background: sky.css,
            opacity: 0.85,
            mixBlendMode: "normal",
          }}
        />

        <div className="relative z-10 mx-auto flex min-h-[90vh] max-w-4xl items-center justify-center">
          <div className="w-full rounded-[32px] border border-white/15 bg-black/30 p-7 shadow-2xl backdrop-blur-2xl">
            <h1 className="text-xl font-bold">
              Device not found
            </h1>

            <p className="mt-2 text-sm text-white/60">
              {error ||
                "The requested device could not be loaded."}
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/house/${houseId}/room/${roomId}`
                )
              }
              className="mt-5 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg"
              style={{
                backgroundColor:
                  THEME_COLOR,
              }}
            >
              Back to Room
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`relative min-h-screen overflow-x-hidden ${
        isNight
          ? "text-white"
          : "text-black"
      }`}
    >
      {/* BACKGROUND */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${DEFAULT_BACKGROUND})`,
        }}
      />

      {/* TIME BASED SKY */}
      <div
        className="fixed inset-0 transition-all duration-1000"
        style={{
          background: sky.css,
          opacity: isNight ? 0.88 : 0.82,
          mixBlendMode: isNight
            ? "normal"
            : "soft-light",
        }}
      />

      {/* GLASS OVERLAY */}
      <div
        className={`fixed inset-0 ${
          isNight
            ? "bg-slate-950/35"
            : "bg-white/30"
        }`}
      />

      {/* NIGHT ATMOSPHERE */}
      {isNight && (
        <>
          <div className="fixed left-[10%] top-[12%] h-2 w-2 animate-pulse rounded-full bg-white/70" />
          <div className="fixed left-[28%] top-[20%] h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
          <div className="fixed right-[20%] top-[15%] h-2 w-2 animate-pulse rounded-full bg-white/60" />
          <div className="fixed right-[8%] top-[30%] h-1 w-1 rounded-full bg-white/50" />
        </>
      )}

      <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        {/* HEADER */}
        <header
          className={`mb-5 flex items-center justify-between gap-3 rounded-[28px] border p-4 shadow-2xl backdrop-blur-2xl ${glass}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/house/${houseId}/room/${roomId}`
                )
              }
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-xl transition hover:-translate-y-0.5 ${
                isNight
                  ? "border-white/10 bg-white/[0.07] hover:bg-white/10"
                  : "border-black/10 bg-white/40 hover:bg-white/60"
              }`}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold sm:text-xl">
                  {device.name}
                </h1>

                <span
                  className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${
                    device.is_online
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                      : "border-red-400/30 bg-red-400/10 text-red-400"
                  }`}
                >
                  {device.is_online
                    ? "Online"
                    : "Offline"}
                </span>
              </div>

              <div
                className={`mt-0.5 flex items-center gap-2 text-xs ${muted}`}
              >
                <span className="truncate">
                  {device.device_id}
                </span>
                <span>•</span>
                <span>
                  {formatTime(currentTime)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={
                requestCurrentStatus
              }
              disabled={
                statusLoading ||
                commandsBlocked
              }
              className={`flex h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold backdrop-blur-xl transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${
                isNight
                  ? "border-white/10 bg-white/[0.07] hover:bg-white/10"
                  : "border-black/10 bg-white/40 hover:bg-white/60"
              }`}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  statusLoading
                    ? "animate-spin"
                    : ""
                }`}
              />

              <span className="hidden sm:inline">
                Status
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSecurityOpen(true)
              }
              className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-xl transition hover:-translate-y-0.5 ${
                isNight
                  ? "border-white/10 bg-white/[0.07] hover:bg-white/10"
                  : "border-black/10 bg-white/40 hover:bg-white/60"
              } ${
                securityState !== "active"
                  ? "border-red-400/40"
                  : ""
              }`}
              aria-label="Security Center"
              title="Security Center"
            >
              {securityState ===
              "active" ? (
                <Shield className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-red-400" />
              )}

              {securityState !==
                "active" && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg">
                  !
                </span>
              )}
            </button>
          </div>
        </header>

        {/* HERO */}
        <section
          className={`relative mb-5 overflow-hidden rounded-[34px] border p-6 shadow-2xl backdrop-blur-2xl sm:p-7 ${glass}`}
        >
          <div
            className="absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl"
            style={{
              background: `${THEME_COLOR}18`,
            }}
          />

          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div
                className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${glassSoft}`}
              >
                <Cpu
                  className="h-3.5 w-3.5"
                  style={{
                    color: THEME_COLOR,
                  }}
                />
                Device Control
              </div>

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {device.name}
              </h2>

              <p
                className={`mt-2 max-w-xl text-sm leading-6 ${muted}`}
              >
                Dynamic controls and live
                device status generated from
                this device&apos;s capabilities.
              </p>
            </div>

            <div
              className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 backdrop-blur-xl ${glassSoft}`}
            >
              {device.is_online ? (
                <Wifi className="h-5 w-5 text-emerald-400" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-400" />
              )}

              <div>
                <div className="text-sm font-semibold">
                  {device.is_online
                    ? "Device Online"
                    : "Device Offline"}
                </div>

                <div
                  className={`mt-0.5 text-xs ${muted}`}
                >
                  Last seen{" "}
                  {formatDate(
                    status?.last_seen_at ??
                      device.last_seen_at
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LOCKED BANNER */}
        {commandsBlocked && (
          <div
            className={`mb-5 rounded-[26px] border p-4 shadow-xl backdrop-blur-2xl ${getSecurityBadgeClass(
              securityState
            )}`}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  Device{" "}
                  {getSecurityLabel(
                    securityState
                  )}
                </div>

                <div className="mt-0.5 text-xs opacity-75">
                  {getSecurityDescription(
                    securityState
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSecurityOpen(true)
                }
                className="hidden rounded-xl border border-current/20 px-3 py-2 text-xs font-bold sm:block"
              >
                Security
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-[24px] border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-300 shadow-xl backdrop-blur-xl">
            {error}
          </div>
        )}

        {/* SUMMARY */}
        <section className="mb-7 grid gap-3 sm:grid-cols-3">
          <div
            className={`rounded-[26px] border p-5 shadow-xl backdrop-blur-2xl ${glass}`}
          >
            <div
              className={`mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] ${muted}`}
            >
              <Cpu className="h-3.5 w-3.5" />
              Device Type
            </div>

            <div className="text-lg font-bold">
              {device.device_type ||
                "Generic Device"}
            </div>
          </div>

          <div
            className={`rounded-[26px] border p-5 shadow-xl backdrop-blur-2xl ${glass}`}
          >
            <div
              className={`mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] ${muted}`}
            >
              <Clock3 className="h-3.5 w-3.5" />
              Last Seen
            </div>

            <div className="text-sm font-bold">
              {formatDate(
                status?.last_seen_at ??
                  device.last_seen_at
              )}
            </div>
          </div>

          <div
            className={`rounded-[26px] border p-5 shadow-xl backdrop-blur-2xl ${glass}`}
          >
            <div
              className={`mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] ${muted}`}
            >
              <Shield className="h-3.5 w-3.5" />
              Security
            </div>

            <span
              className={`inline-flex rounded-xl border px-3 py-1.5 text-xs font-bold ${getSecurityBadgeClass(
                securityState
              )}`}
            >
              {getSecurityLabel(
                securityState
              )}
            </span>
          </div>
        </section>

        {/* CONTROLS */}
        <section className="mb-7">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                Controls
              </h2>

              <p
                className={`mt-1 text-sm ${muted}`}
              >
                Automatically generated from
                device capabilities.
              </p>
            </div>

            <div
              className={`hidden rounded-xl border px-3 py-1.5 text-xs font-semibold sm:block ${glassSoft}`}
            >
              {sortedCapabilities.length}{" "}
              control
              {sortedCapabilities.length ===
              1
                ? ""
                : "s"}
            </div>
          </div>

          {sortedCapabilities.length ===
          0 ? (
            <div
              className={`rounded-[30px] border p-8 text-center shadow-xl backdrop-blur-2xl ${glass}`}
            >
              <Activity
                className="mx-auto h-8 w-8 opacity-40"
              />

              <div className="mt-3 font-semibold">
                No controls available
              </div>

              <div
                className={`mt-1 text-sm ${muted}`}
              >
                This device has not reported
                any enabled capabilities yet.
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedCapabilities.map(
                renderControl
              )}
            </div>
          )}
        </section>

        {/* CURRENT STATUS */}
        <section className="mb-7">
          <div className="mb-4">
            <h2 className="text-xl font-bold">
              Current Status
            </h2>

            <p
              className={`mt-1 text-sm ${muted}`}
            >
              Latest status reported by the
              device.
            </p>
          </div>

          <div
            className={`rounded-[30px] border p-5 shadow-xl backdrop-blur-2xl sm:p-6 ${glass}`}
          >
            {status?.status_data &&
            Object.keys(
              status.status_data
            ).length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(
                  status.status_data
                ).map(([key, value]) => (
                  <div
                    key={key}
                    className={`rounded-[22px] border p-4 backdrop-blur-xl ${glassSoft}`}
                  >
                    <div
                      className={`text-[10px] font-bold uppercase tracking-[0.15em] ${muted}`}
                    >
                      {key}
                    </div>

                    <div className="mt-2 break-words text-lg font-bold">
                      {typeof value ===
                      "object"
                        ? JSON.stringify(
                            value
                          )
                        : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`py-8 text-center text-sm ${muted}`}
              >
                No status data available.
              </div>
            )}

            <div
              className={`mt-5 flex items-center gap-2 border-t pt-4 text-xs ${muted}`}
            >
              <Clock3 className="h-3.5 w-3.5" />
              Updated:{" "}
              {formatDate(
                status?.updated_at ??
                  null
              )}
            </div>
          </div>
        </section>

        {/* EVENTS */}
        <section className="pb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold">
              Recent Events
            </h2>

            <p
              className={`mt-1 text-sm ${muted}`}
            >
              Latest activity reported by the
              device.
            </p>
          </div>

          <div
            className={`overflow-hidden rounded-[30px] border shadow-xl backdrop-blur-2xl ${glass}`}
          >
            {events.length === 0 ? (
              <div
                className={`p-8 text-center text-sm ${muted}`}
              >
                No events yet.
              </div>
            ) : (
              <div>
                {events.map(
                  (event, index) => (
                    <div
                      key={event.id}
                      className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${
                        index !==
                        events.length - 1
                          ? "border-b border-current/10"
                          : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${glassSoft}`}
                        >
                          <Activity className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {event.event_type}
                          </div>

                          <div
                            className={`mt-1 text-xs ${muted}`}
                          >
                            {event.control_id
                              ? `Control: ${event.control_id}`
                              : "Device event"}

                            {event.source
                              ? ` • ${event.source}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`shrink-0 text-xs ${muted}`}
                      >
                        {formatDate(
                          event.created_at
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* SECURITY CENTER */}
      {securityOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-3 py-5 backdrop-blur-md sm:px-5"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSecurityOpen(false);
            }
          }}
        >
          <div
            className={`flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border shadow-2xl backdrop-blur-2xl ${glass}`}
          >
            {/* SECURITY HEADER */}
            <div className="flex items-center justify-between border-b border-current/10 p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${glassSoft}`}
                  style={{
                    color:
                      securityState ===
                      "active"
                        ? THEME_COLOR
                        : undefined,
                  }}
                >
                  {securityState ===
                  "active" ? (
                    <Shield className="h-5 w-5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">
                    Security Center
                  </h2>

                  <p
                    className={`truncate text-xs ${muted}`}
                  >
                    {device.name} •{" "}
                    {device.device_id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSecurityOpen(false)
                }
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                  isNight
                    ? "border-white/10 bg-white/[0.06] hover:bg-white/10"
                    : "border-black/10 bg-white/40 hover:bg-white/60"
                }`}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* BODY */}
            <div className="overflow-y-auto p-4 sm:p-5">
              {/* CURRENT STATE */}
              <div
                className={`mb-4 rounded-[26px] border p-4 ${glassSoft}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div
                      className={`text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}
                    >
                      Current State
                    </div>

                    <div className="mt-1 text-xl font-bold">
                      {getSecurityLabel(
                        securityState
                      )}
                    </div>
                  </div>

                  {securityLoading && (
                    <RefreshCw className="h-4 w-4 animate-spin opacity-50" />
                  )}
                </div>

                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${getSecurityBadgeClass(
                    securityState
                  )}`}
                >
                  {
                    getSecurityDescription(
                      securityState
                    )
                  }
                </div>

                {securityError && (
                  <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">
                    {securityError}
                  </div>
                )}

                <div className="mt-3">
                  {securityState ===
                  "active" ? (
                    <button
                      type="button"
                      onClick={() =>
                        securityAction(
                          "lock"
                        )
                      }
                      disabled={
                        securityLoading
                      }
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-40 ${
                        isNight
                          ? "border-white/10 bg-white/[0.06] hover:bg-white/10"
                          : "border-black/10 bg-white/40 hover:bg-white/60"
                      }`}
                    >
                      <Lock className="h-4 w-4" />
                      Lock Device
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        securityAction(
                          "unlock"
                        )
                      }
                      disabled={
                        securityLoading
                      }
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-40 ${
                        isNight
                          ? "border-white/10 bg-white/[0.06] hover:bg-white/10"
                          : "border-black/10 bg-white/40 hover:bg-white/60"
                      }`}
                    >
                      <Unlock className="h-4 w-4" />
                      Unlock Device
                    </button>
                  )}
                </div>
              </div>

              {/* DANGER ACTIONS */}
              <div
                className={`mb-4 rounded-[26px] border border-red-400/20 p-4 ${glassSoft}`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Siren className="h-4 w-4 text-red-400" />

                  <div>
                    <div className="text-sm font-bold">
                      Emergency Protection
                    </div>

                    <div
                      className={`text-[11px] ${muted}`}
                    >
                      For compromised, missing
                      or stolen devices.
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-current/10 overflow-hidden rounded-2xl border border-current/10">
                  <button
                    type="button"
                    onClick={() =>
                      securityAction(
                        "emergency_lock"
                      )
                    }
                    disabled={
                      securityLoading
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                  >
                    <span className="flex items-center gap-3">
                      <Siren className="h-4 w-4" />
                      Emergency Lock
                    </span>

                    <span className="text-xs opacity-50">
                      →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      securityAction(
                        "lost"
                      )
                    }
                    disabled={
                      securityLoading
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
                  >
                    <span className="flex items-center gap-3">
                      <ShieldAlert className="h-4 w-4 text-orange-400" />
                      Mark Device Lost
                    </span>

                    <span className="text-xs opacity-50">
                      →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      securityAction(
                        "stolen"
                      )
                    }
                    disabled={
                      securityLoading
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                  >
                    <span className="flex items-center gap-3">
                      <ShieldAlert className="h-4 w-4" />
                      Mark Device Stolen
                    </span>

                    <span className="text-xs opacity-50">
                      →
                    </span>
                  </button>
                </div>
              </div>

              {/* RECOVERY */}
              <div
                className={`rounded-[26px] border p-4 ${glassSoft}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                    style={{
                      color:
                        THEME_COLOR,
                      borderColor: `${THEME_COLOR}35`,
                      backgroundColor: `${THEME_COLOR}10`,
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      Recovery Codes
                    </div>

                    <p
                      className={`mt-1 text-xs leading-5 ${muted}`}
                    >
                      Generate a fresh set of
                      one-time recovery codes.
                      Previous codes are
                      invalidated.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    generateRecoveryCodes
                  }
                  disabled={
                    recoveryLoading
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40"
                  style={{
                    backgroundColor:
                      THEME_COLOR,
                  }}
                >
                  {recoveryLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}

                  {recoveryLoading
                    ? "Generating..."
                    : "Generate New Codes"}
                </button>

                {recoveryCodes.length >
                  0 && (
                  <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-amber-300">
                          Save these now
                        </div>

                        <div className="mt-0.5 text-[11px] text-amber-200/60">
                          They cannot be
                          retrieved later.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={
                          copyRecoveryCodes
                        }
                        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-current/10 px-3 py-2 text-xs font-bold transition hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      {recoveryCodes.map(
                        (
                          code,
                          index
                        ) => (
                          <div
                            key={`${code}-${index}`}
                            className={`rounded-xl border px-3 py-3 text-center font-mono text-sm font-bold tracking-widest ${glass}`}
                          >
                            {code}
                          </div>
                        )
                      )}
                    </div>

                    {recoveryWarning && (
                      <div className="mt-3 text-[11px] font-medium text-amber-300/80">
                        {
                          recoveryWarning
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="border-t border-current/10 p-4">
              <button
                type="button"
                onClick={() =>
                  setSecurityOpen(false)
                }
                className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                  isNight
                    ? "border-white/10 bg-white/[0.06] hover:bg-white/10"
                    : "border-black/10 bg-white/40 hover:bg-white/60"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
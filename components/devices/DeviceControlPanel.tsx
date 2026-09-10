"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock3,
  Cpu,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

const THEME_COLOR = "#42B8C5";

type Device = {
  id: string;
  room_id: string;
  device_id: string;
  name: string;
  device_type: string;
  is_online: boolean;
  last_seen_at: string | null;
};

type Capability = {
  id: number;
  device_id: string;
  control_id: string;
  name: string;
  type: string;
  config: Record<string, any> | null;
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

type DeviceSchedule = {
  id: string;
  user_id: string;
  device_id: string;
  control_id: string;
  on_time: string;
  off_time: string;
  days_mask: number;
  timezone: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  device: Device;
  defaultExpanded?: boolean;
};

const DAYS = [
  { label: "Mon", bit: 1 },
  { label: "Tue", bit: 2 },
  { label: "Wed", bit: 4 },
  { label: "Thu", bit: 8 },
  { label: "Fri", bit: 16 },
  { label: "Sat", bit: 32 },
  { label: "Sun", bit: 64 },
];

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

function cleanTime(value: string) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

function formatDays(mask: number) {
  if (mask === 127) {
    return "Everyday";
  }

  const selected = DAYS.filter(
    (day) => (mask & day.bit) === day.bit,
  ).map((day) => day.label);

  return selected.join(" ");
}

function crossesMidnight(
  onTime: string,
  offTime: string,
) {
  return cleanTime(offTime) <= cleanTime(onTime);
}

export function DeviceControlPanel({
  device,
  defaultExpanded = true,
}: Props) {
  const {
    darkMode,
    glass,
    glassSoft,
    muted,
  } = useMasterTheme();

  const [expanded, setExpanded] =
    useState(defaultExpanded);

  const [capabilities, setCapabilities] =
    useState<Capability[]>([]);

  const [status, setStatus] =
    useState<DeviceStatus | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [statusLoading, setStatusLoading] =
    useState(false);

  const [error, setError] =
    useState("");
    useEffect(() => {
  if (!error) return;

  const timer = window.setTimeout(() => {
    setError("");
  }, 5000);

  return () => {
    window.clearTimeout(timer);
  };
}, [error]);

  const [pending, setPending] =
    useState<Record<string, boolean>>({});

  /* =====================================================
     DEVICE SETTINGS
  ===================================================== */

  const [showSettings, setShowSettings] =
    useState(false);

  const [deviceName, setDeviceName] =
    useState(device.name);

  const [savingDevice, setSavingDevice] =
    useState(false);

  const [deletingDevice, setDeletingDevice] =
    useState(false);

  const [settingsError, setSettingsError] =
    useState("");

  /* =====================================================
     SCHEDULE MODAL
  ===================================================== */

  const [
    scheduleCapability,
    setScheduleCapability,
  ] = useState<Capability | null>(null);

  const [schedules, setSchedules] =
    useState<DeviceSchedule[]>([]);

  const [
    loadingSchedules,
    setLoadingSchedules,
  ] = useState(false);

  const [scheduleError, setScheduleError] =
    useState("");

  const [editingScheduleId, setEditingScheduleId] =
    useState<string | null>(null);

  const [onTime, setOnTime] =
    useState("14:00");

  const [offTime, setOffTime] =
    useState("14:45");

  const [daysMask, setDaysMask] =
    useState(127);

  const [scheduleEnabled, setScheduleEnabled] =
    useState(true);

  const [savingSchedule, setSavingSchedule] =
    useState(false);

  const sortedCapabilities = useMemo(
    () =>
      [...capabilities].sort(
        (a, b) =>
          (a.sort_order ?? 0) -
          (b.sort_order ?? 0),
      ),
    [capabilities],
  );

  /* =====================================================
     LOAD DEVICE DATA
  ===================================================== */

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [capResult, statusResult] =
        await Promise.all([
          supabase
            .from("device_capabilities")
            .select(
              `
              id,
              device_id,
              control_id,
              name,
              type,
              config,
              sort_order,
              enabled
              `,
            )
            .eq(
              "device_id",
              device.device_id,
            )
            .eq("enabled", true)
            .order("sort_order", {
              ascending: true,
            }),

          supabase
            .from("device_status")
            .select(
              `
              id,
              device_id,
              status_data,
              updated_at,
              online,
              last_seen_at
              `,
            )
            .eq(
              "device_id",
              device.device_id,
            )
            .order("updated_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),
        ]);

      if (capResult.error) {
        throw capResult.error;
      }

      if (statusResult.error) {
        throw statusResult.error;
      }

      setCapabilities(
        (capResult.data ?? []) as Capability[],
      );

      setStatus(
        statusResult.data as DeviceStatus | null,
      );
    } catch (err: any) {
      setError(
        err?.message ??
          "Unable to load device controls.",
      );
    } finally {
      setLoading(false);
    }
  }, [device.device_id]);

  /* =====================================================
     REALTIME STATUS
  ===================================================== */

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(
        `room-device-status-${device.device_id}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_status",
          filter: `device_id=eq.${device.device_id}`,
        },
        (payload: any) => {
          if (
            payload.new?.device_id ===
            device.device_id
          ) {
            setStatus(
              payload.new as DeviceStatus,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [device.device_id, loadData]);

  /* =====================================================
     SEND DEVICE COMMAND
  ===================================================== */

  async function sendCommand(
    controlId: string,
    value: any,
  ) {
    try {
      setError("");

      setPending((current) => ({
        ...current,
        [controlId]: true,
      }));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "Please login again.",
        );
      }

      const response = await fetch(
        "/api/command",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            device_id:
              device.device_id,

            message: JSON.stringify({
              control_id: controlId,
              value,
            }),
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Failed to send command.",
        );
      }

      setStatus((current) =>
        current
          ? {
              ...current,

              status_data: {
                ...(current.status_data ??
                  {}),

                [controlId]: value,
              },
            }
          : current,
      );
    } catch (err: any) {
      setError(
        err?.message ??
          "Failed to send command.",
      );
    } finally {
      setPending((current) => ({
        ...current,
        [controlId]: false,
      }));
    }
  }

  /* =====================================================
     REQUEST STATUS
  ===================================================== */

  async function requestStatus() {
    try {
      setStatusLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "Please login again.",
        );
      }

      const response = await fetch(
        "/api/command",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            device_id:
              device.device_id,

            message: "STATUS",
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Failed to request status.",
        );
      }
    } catch (err: any) {
      setError(
        err?.message ??
          "Failed to request status.",
      );
    } finally {
      setStatusLoading(false);
    }
  }

  /* =====================================================
     DEVICE SETTINGS
  ===================================================== */

  function openDeviceSettings() {
    setDeviceName(device.name);
    setSettingsError("");
    setShowSettings(true);
  }

  async function saveDeviceSettings() {
    const cleanName =
      deviceName.trim();

    if (!cleanName) {
      setSettingsError(
        "Device name cannot be empty.",
      );

      return;
    }

    try {
      setSavingDevice(true);
      setSettingsError("");

      const { error } = await supabase
        .from("devices")
        .update({
          name: cleanName,
        })
        .eq("id", device.id);

      if (error) {
        throw error;
      }

      /*
        Current room holds device data in its own state.
        Reload once after rename so parent room receives
        latest name without adding extra callbacks yet.
      */

      window.location.reload();
    } catch (err: any) {
      setSettingsError(
        err?.message ??
          "Unable to update device.",
      );
    } finally {
      setSavingDevice(false);
    }
  }

  async function deleteDevice() {
    const confirmed =
      window.confirm(
        `Delete "${device.name}"?\n\nThis device will be removed from this room.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingDevice(true);
      setSettingsError("");

      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("id", device.id);

      if (error) {
        throw error;
      }

      window.location.reload();
    } catch (err: any) {
      setSettingsError(
        err?.message ??
          "Unable to delete device.",
      );

      setDeletingDevice(false);
    }
  }

  /* =====================================================
     SCHEDULES
  ===================================================== */

  function resetScheduleForm() {
    setEditingScheduleId(null);

    setOnTime("14:00");
    setOffTime("14:45");

    setDaysMask(127);
    setScheduleEnabled(true);
  }

  async function loadSchedules(
    capability: Capability,
  ) {
    try {
      setLoadingSchedules(true);
      setScheduleError("");

      const { data, error } =
        await supabase
          .from("device_schedules")
          .select(
            `
            id,
            user_id,
            device_id,
            control_id,
            on_time,
            off_time,
            days_mask,
            timezone,
            enabled,
            created_at,
            updated_at
            `,
          )
          .eq(
            "device_id",
            device.device_id,
          )
          .eq(
            "control_id",
            capability.control_id,
          )
          .order("on_time", {
            ascending: true,
          });

      if (error) {
        throw error;
      }

      setSchedules(
        (data ?? []) as DeviceSchedule[],
      );
    } catch (err: any) {
      setScheduleError(
        err?.message ??
          "Unable to load schedules.",
      );
    } finally {
      setLoadingSchedules(false);
    }
  }

  async function openScheduleModal(
    capability: Capability,
  ) {
    setScheduleCapability(
      capability,
    );

    resetScheduleForm();

    await loadSchedules(
      capability,
    );
  }

  function closeScheduleModal() {
    setScheduleCapability(null);
    setSchedules([]);
    setScheduleError("");

    resetScheduleForm();
  }

  function toggleDay(bit: number) {
    setDaysMask((current) => {
      const next =
        current ^ bit;

      /*
        We don't allow zero selected days.
        If user removes the final remaining day,
        simply keep the previous selection.
      */

      if (next === 0) {
        return current;
      }

      return next;
    });
  }

  function editSchedule(
    schedule: DeviceSchedule,
  ) {
    setEditingScheduleId(
      schedule.id,
    );

    setOnTime(
      cleanTime(schedule.on_time),
    );

    setOffTime(
      cleanTime(schedule.off_time),
    );

    setDaysMask(
      schedule.days_mask,
    );

    setScheduleEnabled(
      schedule.enabled,
    );
  }

  async function saveSchedule() {
    if (!scheduleCapability) {
      return;
    }

    if (!onTime || !offTime) {
      setScheduleError(
        "Please select ON and OFF time.",
      );

      return;
    }

    if (
      daysMask < 1 ||
      daysMask > 127
    ) {
      setScheduleError(
        "Please select at least one day.",
      );

      return;
    }

    try {
      setSavingSchedule(true);
      setScheduleError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Please login again.",
        );
      }

      const payload = {
        user_id: user.id,

        device_id:
          device.device_id,

        control_id:
          scheduleCapability.control_id,

        on_time: onTime,
        off_time: offTime,

        days_mask: daysMask,

        timezone:
          "Asia/Karachi",

        enabled:
          scheduleEnabled,
      };

      if (editingScheduleId) {
        const { error } =
          await supabase
            .from(
              "device_schedules",
            )
            .update(payload)
            .eq(
              "id",
              editingScheduleId,
            );

        if (error) {
          throw error;
        }
      } else {
        const { error } =
          await supabase
            .from(
              "device_schedules",
            )
            .insert(payload);

        if (error) {
          throw error;
        }
      }

      resetScheduleForm();

      await loadSchedules(
        scheduleCapability,
      );
    } catch (err: any) {
      setScheduleError(
        err?.message ??
          "Unable to save schedule.",
      );
    } finally {
      setSavingSchedule(false);
    }
  }

  async function toggleScheduleEnabled(
    schedule: DeviceSchedule,
  ) {
    try {
      setScheduleError("");

      const { error } =
        await supabase
          .from("device_schedules")
          .update({
            enabled:
              !schedule.enabled,
          })
          .eq("id", schedule.id);

      if (error) {
        throw error;
      }

      if (scheduleCapability) {
        await loadSchedules(
          scheduleCapability,
        );
      }
    } catch (err: any) {
      setScheduleError(
        err?.message ??
          "Unable to update schedule.",
      );
    }
  }

  async function deleteSchedule(
    schedule: DeviceSchedule,
  ) {
    try {
      setScheduleError("");

      const { error } =
        await supabase
          .from("device_schedules")
          .delete()
          .eq("id", schedule.id);

      if (error) {
        throw error;
      }

      if (
        editingScheduleId ===
        schedule.id
      ) {
        resetScheduleForm();
      }

      if (scheduleCapability) {
        await loadSchedules(
          scheduleCapability,
        );
      }
    } catch (err: any) {
      setScheduleError(
        err?.message ??
          "Unable to delete schedule.",
      );
    }
  }

  /* =====================================================
     CONTROL RENDERING
  ===================================================== */

  function renderControl(
    capability: Capability,
  ) {
    const type =
      capability.type?.toLowerCase();

    const config =
      capability.config ?? {};

    const currentValue =
      status?.status_data?.[
        capability.control_id
      ] ??
      config.default ??
      false;

    const busy = Boolean(
      pending[
        capability.control_id
      ],
    );

    /* =========================
       SWITCH / TOGGLE
    ========================= */

    if (
      [
        "switch",
        "toggle",
        "boolean",
      ].includes(type)
    ) {
      const checked =
        Boolean(currentValue);

      return (
        <div
          key={capability.id}
          className={`rounded-[22px] border p-4 ${glassSoft}`}
        >
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                sendCommand(
                  capability.control_id,
                  !checked,
                )
              }
              className="min-w-0 flex-1 text-left disabled:opacity-50"
            >
              <div className="truncate text-sm font-semibold">
                {capability.name}
              </div>

              <div
                className={`mt-1 text-xs ${
                  checked
                    ? "text-emerald-400"
                    : muted
                }`}
              >
                {busy
                  ? "SENDING..."
                  : checked
                    ? "ON"
                    : "OFF"}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              {/* TIMER */}

              <button
                type="button"
                onClick={() =>
                  openScheduleModal(
                    capability,
                  )
                }
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition hover:scale-105 ${glassSoft}`}
                title="Timer & schedules"
                aria-label={`Schedules for ${capability.name}`}
              >
                <Clock3 size={16} />
              </button>

              {/* SWITCH */}

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  sendCommand(
                    capability.control_id,
                    !checked,
                  )
                }
                className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${
                  checked
                    ? "bg-[#42B8C5]"
                    : darkMode
                      ? "bg-white/15"
                      : "bg-black/10"
                }`}
                aria-label={`Toggle ${capability.name}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    checked
                      ? "left-6"
                      : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      );
    }

    /* =========================
       RANGE / SLIDER
    ========================= */

    if (
      ["range", "slider"].includes(
        type,
      )
    ) {
      const min = Number(
        config.min ?? 0,
      );

      const max = Number(
        config.max ?? 100,
      );

      const step = Number(
        config.step ?? 1,
      );

      const value = Number(
        currentValue ?? min,
      );

      return (
        <div
          key={capability.id}
          className={`rounded-[22px] border p-4 ${glassSoft}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {capability.name}
            </span>

            <span
              className="text-xs font-bold"
              style={{
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
            disabled={busy}
            onChange={(event) =>
              sendCommand(
                capability.control_id,
                Number(
                  event.target.value,
                ),
              )
            }
            className="w-full"
            style={{
              accentColor:
                THEME_COLOR,
            }}
          />

          <div
            className={`mt-1 flex justify-between text-[10px] ${muted}`}
          >
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>
      );
    }

    /* =========================
       NUMBER
    ========================= */

    if (
      ["number", "numeric"].includes(
        type,
      )
    ) {
      return (
        <label
          key={capability.id}
          className={`rounded-[22px] border p-4 ${glassSoft}`}
        >
          <span className="mb-2 block text-sm font-semibold">
            {capability.name}
          </span>

          <input
            type="number"
            value={
              currentValue ?? ""
            }
            min={config.min}
            max={config.max}
            step={
              config.step ?? 1
            }
            disabled={busy}
            onChange={(event) =>
              sendCommand(
                capability.control_id,
                Number(
                  event.target.value,
                ),
              )
            }
            className={`w-full rounded-xl border px-3 py-2 outline-none ${
              darkMode
                ? "border-white/10 bg-white/[0.07]"
                : "border-black/10 bg-white/50"
            }`}
          />
        </label>
      );
    }

    /* =========================
       GENERIC COMMAND
    ========================= */

    return (
      <button
        key={capability.id}
        type="button"
        disabled={busy}
        onClick={() =>
          sendCommand(
            capability.control_id,
            config.value ?? true,
          )
        }
        className={`rounded-[22px] border p-4 text-left transition disabled:opacity-50 ${glassSoft}`}
      >
        <div className="text-sm font-semibold">
          {capability.name}
        </div>

        {config.description && (
          <div
            className={`mt-1 text-xs ${muted}`}
          >
            {config.description}
          </div>
        )}
      </button>
    );
  }

  const lastSeen =
  status?.last_seen_at ??
  status?.updated_at ??
  device.last_seen_at;

const ONLINE_TIMEOUT_MS = 90 * 1000;

const lastSeenTime = lastSeen
  ? new Date(lastSeen).getTime()
  : 0;

const isFresh =
  lastSeenTime > 0 &&
  Date.now() - lastSeenTime <= ONLINE_TIMEOUT_MS;

const online =
  Boolean(status?.online ?? device.is_online) &&
  isFresh;

  return (
    <>
      {/* =================================================
          DEVICE CARD
      ================================================= */}

      <article
        className={`overflow-hidden rounded-[30px] border shadow-xl backdrop-blur-2xl ${glass}`}
      >
        <div className="flex items-center gap-2 p-4 sm:gap-3 sm:p-5">
          {/* DEVICE ICON */}

          <div
  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${glassSoft}`}
  style={{
    color: online ? THEME_COLOR : "#ef4444",
  }}
>
  <Cpu size={21} />

  {!online && (
    <span
      className="pointer-events-none absolute h-[2px] w-7 rotate-45 rounded-full bg-red-500"
      aria-hidden="true"
    />
  )}
</div>

          {/* DEVICE NAME */}

          <button
            type="button"
            onClick={() =>
              setExpanded(
                (value) => !value,
              )
            }
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-2">
              <h3 className="truncate font-bold sm:text-lg">
                {device.name}
              </h3>
            </div>

            <div
              className={`mt-0.5 truncate font-mono text-[11px] ${muted}`}
            >
              {device.device_id} •{" "}
              {online
                ? "ONLINE"
                : "OFFLINE"}
            </div>
          </button>

          {/* REFRESH */}

          <button
            type="button"
            onClick={requestStatus}
            disabled={statusLoading}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${glassSoft}`}
            title="Request status"
          >
            <RefreshCw
              size={16}
              className={
                statusLoading
                  ? "animate-spin"
                  : ""
              }
            />
          </button>

          {/* SETTINGS */}

          <button
            type="button"
            onClick={
              openDeviceSettings
            }
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${glassSoft}`}
            title="Device settings"
          >
            <Settings size={17} />
          </button>

          {/* EXPAND */}

          <button
            type="button"
            onClick={() =>
              setExpanded(
                (value) => !value,
              )
            }
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${glassSoft}`}
            aria-label={
              expanded
                ? "Collapse device"
                : "Expand device"
            }
          >
            {expanded ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown
                size={18}
              />
            )}
          </button>
        </div>

        {/* DEVICE CONTROLS */}

        {expanded && (
          <div className="border-t border-current/10 p-4 sm:p-5">
            {error && (
              <div className="mb-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div
                className={`flex items-center gap-2 py-6 text-sm ${muted}`}
              >
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />

                Loading controls...
              </div>
            ) : sortedCapabilities.length ===
              0 ? (
              <div
                className={`flex items-center gap-2 rounded-2xl border p-4 text-sm ${glassSoft} ${muted}`}
              >
                <Activity
                  size={17}
                />

                No enabled capabilities
                reported yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedCapabilities.map(
                  renderControl,
                )}
              </div>
            )}

            <div
              className={`mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-3 text-[11px] ${muted}`}
            >
              <span>
                Last seen:{" "}
                {formatDate(lastSeen)}
              </span>

              <span>
                {
                  sortedCapabilities.length
                }{" "}
                control
                {sortedCapabilities.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>
        )}
      </article>

      {/* =================================================
          DEVICE SETTINGS MODAL
      ================================================= */}

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-[28px] border p-5 shadow-2xl backdrop-blur-2xl sm:p-6 ${glass}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${glassSoft}`}
              >
                <Settings size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-bold sm:text-lg">
                  Device Settings
                </h2>

                <div
                  className={`truncate font-mono text-[11px] ${muted}`}
                >
                  {device.device_id}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowSettings(
                    false,
                  )
                }
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${glassSoft}`}
              >
                <X size={18} />
              </button>
            </div>

            {settingsError && (
              <div className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-300">
                {settingsError}
              </div>
            )}

            {/* NAME */}

            <div className="mt-5">
              <label className="mb-2 block text-xs font-semibold">
                Device Name
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Pencil
                    size={15}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`}
                  />

                  <input
                    value={deviceName}
                    onChange={(event) =>
                      setDeviceName(
                        event.target
                          .value,
                      )
                    }
                    className={`w-full rounded-xl border py-3 pl-10 pr-3 outline-none ${glassSoft}`}
                  />
                </div>

                <button
                  type="button"
                  disabled={
                    savingDevice
                  }
                  onClick={
                    saveDeviceSettings
                  }
                  className="flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-black disabled:opacity-50"
                  style={{
                    backgroundColor:
                      THEME_COLOR,
                  }}
                >
                  <Save size={16} />

                  {savingDevice
                    ? "Saving"
                    : "Save"}
                </button>
              </div>
            </div>

            {/* DEVICE INFO */}

            <div
              className={`mt-4 rounded-2xl border p-4 ${glassSoft}`}
            >
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <div
                    className={muted}
                  >
                    Device ID
                  </div>

                  <div className="mt-1 break-all font-mono">
                    {
                      device.device_id
                    }
                  </div>
                </div>

                <div>
                  <div
                    className={muted}
                  >
                    Device Type
                  </div>

                  <div className="mt-1">
                    {
                      device.device_type
                    }
                  </div>
                </div>

                <div>
                  <div
                    className={muted}
                  >
                    Status
                  </div>

                  <div
                    className={`mt-1 font-semibold ${
                      online
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {online
                      ? "ONLINE"
                      : "OFFLINE"}
                  </div>
                </div>

                <div>
                  <div
                    className={muted}
                  >
                    Last Seen
                  </div>

                  <div className="mt-1">
                    {formatDate(
                      lastSeen,
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* DELETE */}

            <div className="mt-6 border-t border-current/10 pt-5">
              <div className="mb-3">
                <div className="text-sm font-semibold text-red-400">
                  Danger Zone
                </div>

                <div
                  className={`mt-1 text-xs ${muted}`}
                >
                  Remove this device
                  from the room and
                  database.
                </div>
              </div>

              <button
                type="button"
                disabled={
                  deletingDevice
                }
                onClick={deleteDevice}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                <Trash2 size={17} />

                {deletingDevice
                  ? "Deleting..."
                  : "Delete Device"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          SCHEDULE MODAL
      ================================================= */}

      {scheduleCapability && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border p-5 shadow-2xl backdrop-blur-2xl sm:p-6 ${glass}`}
          >
            {/* HEADER */}

            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${glassSoft}`}
                style={{
                  color:
                    THEME_COLOR,
                }}
              >
                <Clock3 size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-bold sm:text-lg">
                  Timer & Schedule
                </h2>

                <div
                  className={`truncate text-xs ${muted}`}
                >
                  {
                    scheduleCapability.name
                  }{" "}
                  •{" "}
                  {
                    scheduleCapability.control_id
                  }
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeScheduleModal
                }
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${glassSoft}`}
              >
                <X size={18} />
              </button>
            </div>

            {scheduleError && (
              <div className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-300">
                {scheduleError}
              </div>
            )}

            {/* EDITOR */}

            <div
              className={`mt-5 rounded-[22px] border p-4 ${glassSoft}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="font-semibold">
                  {editingScheduleId
                    ? "Edit Timer"
                    : "Add Timer"}
                </div>

                {editingScheduleId && (
                  <button
                    type="button"
                    onClick={
                      resetScheduleForm
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs ${glassSoft}`}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* TIMES */}

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span
                    className={`mb-2 block text-xs ${muted}`}
                  >
                    ON Time
                  </span>

                  <input
                    type="time"
                    value={onTime}
                    onChange={(event) =>
                      setOnTime(
                        event.target
                          .value,
                      )
                    }
                    className={`w-full rounded-xl border px-3 py-3 outline-none ${glassSoft}`}
                  />
                </label>

                <label>
                  <span
                    className={`mb-2 block text-xs ${muted}`}
                  >
                    OFF Time
                  </span>

                  <input
                    type="time"
                    value={offTime}
                    onChange={(event) =>
                      setOffTime(
                        event.target
                          .value,
                      )
                    }
                    className={`w-full rounded-xl border px-3 py-3 outline-none ${glassSoft}`}
                  />
                </label>
              </div>

              {crossesMidnight(
                onTime,
                offTime,
              ) && (
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${glassSoft}`}
                >
                  🌙 OFF happens on
                  the next calendar
                  day.
                </div>
              )}

              {/* DAYS */}

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`text-xs ${muted}`}
                  >
                    Repeat Days
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setDaysMask(127)
                    }
                    className="text-xs font-semibold"
                    style={{
                      color:
                        THEME_COLOR,
                    }}
                  >
                    Everyday
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map(
                    (day) => {
                      const selected =
                        (daysMask &
                          day.bit) ===
                        day.bit;

                      return (
                        <button
                          key={
                            day.label
                          }
                          type="button"
                          onClick={() =>
                            toggleDay(
                              day.bit,
                            )
                          }
                          className={`rounded-xl border py-2 text-[11px] font-semibold transition ${
                            selected
                              ? "text-black"
                              : glassSoft
                          }`}
                          style={
                            selected
                              ? {
                                  backgroundColor:
                                    THEME_COLOR,
                                  borderColor:
                                    THEME_COLOR,
                                }
                              : undefined
                          }
                        >
                          {
                            day.label
                          }
                        </button>
                      );
                    },
                  )}
                </div>

                <div
                  className={`mt-2 text-[11px] ${muted}`}
                >
                  {formatDays(
                    daysMask,
                  )}
                </div>
              </div>

              {/* ENABLED */}

              <div
                className={`mt-5 flex items-center justify-between rounded-xl border p-3 ${glassSoft}`}
              >
                <div>
                  <div className="text-sm font-semibold">
                    Enabled
                  </div>

                  <div
                    className={`text-[11px] ${muted}`}
                  >
                    Timer will run
                    automatically.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setScheduleEnabled(
                      (value) =>
                        !value,
                    )
                  }
                  className={`relative h-7 w-12 rounded-full transition ${
                    scheduleEnabled
                      ? "bg-[#42B8C5]"
                      : darkMode
                        ? "bg-white/15"
                        : "bg-black/10"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      scheduleEnabled
                        ? "left-6"
                        : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* SAVE */}

              <button
                type="button"
                disabled={
                  savingSchedule
                }
                onClick={saveSchedule}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
                style={{
                  backgroundColor:
                    THEME_COLOR,
                }}
              >
                {editingScheduleId ? (
                  <Save size={17} />
                ) : (
                  <Plus size={17} />
                )}

                {savingSchedule
                  ? "Saving..."
                  : editingScheduleId
                    ? "Update Timer"
                    : "Add Timer"}
              </button>
            </div>

            {/* EXISTING TIMERS */}

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">
                  Existing Timers
                </h3>

                <span
                  className={`text-xs ${muted}`}
                >
                  {schedules.length}{" "}
                  timer
                  {schedules.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {loadingSchedules ? (
                <div
                  className={`flex items-center gap-2 py-5 text-sm ${muted}`}
                >
                  <RefreshCw
                    size={15}
                    className="animate-spin"
                  />

                  Loading timers...
                </div>
              ) : schedules.length ===
                0 ? (
                <div
                  className={`rounded-2xl border p-4 text-sm ${glassSoft} ${muted}`}
                >
                  No timers created
                  yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map(
                    (schedule) => (
                      <div
                        key={
                          schedule.id
                        }
                        className={`rounded-2xl border p-4 ${glassSoft}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              toggleScheduleEnabled(
                                schedule,
                              )
                            }
                            className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition ${
                              schedule.enabled
                                ? "bg-[#42B8C5]"
                                : darkMode
                                  ? "bg-white/15"
                                  : "bg-black/10"
                            }`}
                            title={
                              schedule.enabled
                                ? "Disable timer"
                                : "Enable timer"
                            }
                          >
                            <span
                              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                                schedule.enabled
                                  ? "left-5"
                                  : "left-1"
                              }`}
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-bold">
                                {cleanTime(
                                  schedule.on_time,
                                )}
                              </span>

                              <span
                                className={
                                  muted
                                }
                              >
                                →
                              </span>

                              <span className="font-mono text-sm font-bold">
                                {cleanTime(
                                  schedule.off_time,
                                )}
                              </span>

                              {crossesMidnight(
                                schedule.on_time,
                                schedule.off_time,
                              ) && (
                                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                                  +1 day
                                </span>
                              )}
                            </div>

                            <div
                              className={`mt-1 text-xs ${muted}`}
                            >
                              {formatDays(
                                schedule.days_mask,
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                editSchedule(
                                  schedule,
                                )
                              }
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${glassSoft}`}
                              title="Edit timer"
                            >
                              <Pencil
                                size={
                                  14
                                }
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteSchedule(
                                  schedule,
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-300"
                              title="Delete timer"
                            >
                              <Trash2
                                size={
                                  14
                                }
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
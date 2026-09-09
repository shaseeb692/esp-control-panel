"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronUp, Cpu, RefreshCw, Wifi, WifiOff } from "lucide-react";
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

type Props = {
  device: Device;
  defaultExpanded?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export function DeviceControlPanel({ device, defaultExpanded = true }: Props) {
  const { darkMode, glass, glassSoft, muted } = useMasterTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const sortedCapabilities = useMemo(
    () => [...capabilities].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [capabilities]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [capResult, statusResult] = await Promise.all([
        supabase
          .from("device_capabilities")
          .select("id,device_id,control_id,name,type,config,sort_order,enabled")
          .eq("device_id", device.device_id)
          .eq("enabled", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("device_status")
          .select("id,device_id,status_data,updated_at,online,last_seen_at")
          .eq("device_id", device.device_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (capResult.error) throw capResult.error;
      if (statusResult.error) throw statusResult.error;
      setCapabilities((capResult.data ?? []) as Capability[]);
      setStatus(statusResult.data as DeviceStatus | null);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load device controls.");
    } finally {
      setLoading(false);
    }
  }, [device.device_id]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel(`room-device-status-${device.device_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_status", filter: `device_id=eq.${device.device_id}` },
        (payload: any) => {
          if (payload.new?.device_id === device.device_id) setStatus(payload.new as DeviceStatus);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [device.device_id, loadData]);

  async function sendCommand(controlId: string, value: any) {
    try {
      setError("");
      setPending((p) => ({ ...p, [controlId]: true }));
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please login again.");
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          device_id: device.device_id,
          message: JSON.stringify({ control_id: controlId, value }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to send command.");
      // Optimistic UI; the realtime device report remains authoritative afterwards.
      setStatus((current) => current ? {
        ...current,
        status_data: { ...(current.status_data ?? {}), [controlId]: value },
      } : current);
    } catch (err: any) {
      setError(err?.message ?? "Failed to send command.");
    } finally {
      setPending((p) => ({ ...p, [controlId]: false }));
    }
  }

  async function requestStatus() {
    try {
      setStatusLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please login again.");
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ device_id: device.device_id, message: "STATUS" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to request status.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to request status.");
    } finally {
      setStatusLoading(false);
    }
  }

  function renderControl(capability: Capability) {
    const type = capability.type?.toLowerCase();
    const config = capability.config ?? {};
    const currentValue = status?.status_data?.[capability.control_id] ?? config.default ?? false;
    const busy = Boolean(pending[capability.control_id]);

    if (["switch", "toggle", "boolean"].includes(type)) {
      const checked = Boolean(currentValue);
      return (
        <button key={capability.id} type="button" disabled={busy} onClick={() => sendCommand(capability.control_id, !checked)}
          className={`rounded-[22px] border p-4 text-left transition disabled:opacity-50 ${glassSoft}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{capability.name}</div><div className={`mt-1 text-xs ${checked ? "text-emerald-400" : muted}`}>{busy ? "SENDING..." : checked ? "ON" : "OFF"}</div></div>
            <div className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#42B8C5]" : darkMode ? "bg-white/15" : "bg-black/10"}`}>
              <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
            </div>
          </div>
        </button>
      );
    }

    if (["range", "slider"].includes(type)) {
      const min = Number(config.min ?? 0), max = Number(config.max ?? 100), step = Number(config.step ?? 1), value = Number(currentValue ?? min);
      return (
        <div key={capability.id} className={`rounded-[22px] border p-4 ${glassSoft}`}>
          <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">{capability.name}</span><span className="text-xs font-bold" style={{ color: THEME_COLOR }}>{value}</span></div>
          <input type="range" min={min} max={max} step={step} value={value} disabled={busy}
            onChange={(e) => sendCommand(capability.control_id, Number(e.target.value))} className="w-full" style={{ accentColor: THEME_COLOR }} />
          <div className={`mt-1 flex justify-between text-[10px] ${muted}`}><span>{min}</span><span>{max}</span></div>
        </div>
      );
    }

    if (["number", "numeric"].includes(type)) {
      return (
        <label key={capability.id} className={`rounded-[22px] border p-4 ${glassSoft}`}>
          <span className="mb-2 block text-sm font-semibold">{capability.name}</span>
          <input type="number" value={currentValue ?? ""} min={config.min} max={config.max} step={config.step ?? 1} disabled={busy}
            onChange={(e) => sendCommand(capability.control_id, Number(e.target.value))}
            className={`w-full rounded-xl border px-3 py-2 outline-none ${darkMode ? "border-white/10 bg-white/[0.07]" : "border-black/10 bg-white/50"}`} />
        </label>
      );
    }

    return (
      <button key={capability.id} type="button" disabled={busy} onClick={() => sendCommand(capability.control_id, config.value ?? true)}
        className={`rounded-[22px] border p-4 text-left transition disabled:opacity-50 ${glassSoft}`}>
        <div className="text-sm font-semibold">{capability.name}</div>
        {config.description && <div className={`mt-1 text-xs ${muted}`}>{config.description}</div>}
      </button>
    );
  }

  const online = status?.online ?? device.is_online;
  const lastSeen = status?.last_seen_at ?? device.last_seen_at;

  return (
    <article className={`overflow-hidden rounded-[30px] border shadow-xl backdrop-blur-2xl ${glass}`}>
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${glassSoft}`} style={{ color: THEME_COLOR }}><Cpu size={21} /></div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2"><h3 className="truncate font-bold sm:text-lg">{device.name}</h3>{online ? <Wifi size={15} className="text-emerald-400" /> : <WifiOff size={15} className="text-red-400" />}</div>
          <div className={`mt-0.5 truncate font-mono text-[11px] ${muted}`}>{device.device_id} • {online ? "ONLINE" : "OFFLINE"}</div>
        </button>
        <button type="button" onClick={requestStatus} disabled={statusLoading} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${glassSoft}`} title="Request status"><RefreshCw size={16} className={statusLoading ? "animate-spin" : ""} /></button>
        <button type="button" onClick={() => setExpanded((v) => !v)} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${glassSoft}`} aria-label={expanded ? "Collapse device" : "Expand device"}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
      </div>

      {expanded && (
        <div className="border-t border-current/10 p-4 sm:p-5">
          {error && <div className="mb-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
          {loading ? (
            <div className={`flex items-center gap-2 py-6 text-sm ${muted}`}><RefreshCw size={16} className="animate-spin" /> Loading controls...</div>
          ) : sortedCapabilities.length === 0 ? (
            <div className={`flex items-center gap-2 rounded-2xl border p-4 text-sm ${glassSoft} ${muted}`}><Activity size={17} /> No enabled capabilities reported yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sortedCapabilities.map(renderControl)}</div>
          )}
          <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-3 text-[11px] ${muted}`}>
            <span>Last seen: {formatDate(lastSeen)}</span>
            <span>{sortedCapabilities.length} control{sortedCapabilities.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      )}
    </article>
  );
}

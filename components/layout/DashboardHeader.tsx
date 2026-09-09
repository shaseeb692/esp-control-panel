"use client";

import {
  Camera,
  Clock3,
  Globe2,
  Image as ImageIcon,
  LogOut,
  User,
} from "lucide-react";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

export function DashboardHeader({
  email,
  profileImage,
  clockTime,
  clockDate,
  gmtLabel,
  locationName,
  onProfile,
  onWeatherSettings,
  onBackground,
  onLogout,
}: {
  email: string;
  profileImage: string | null;
  clockTime: string;
  clockDate: string;
  gmtLabel: string;
  locationName: string;
  onProfile: () => void;
  onWeatherSettings: () => void;
  onBackground: () => void;
  onLogout: () => void;
}) {
  const { darkMode, glass, muted } = useMasterTheme();

  const actionClass = `flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold backdrop-blur-xl transition ${
    darkMode
      ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
      : "border-black/10 bg-black/10 text-black hover:bg-black/15"
  }`;

  return (
    <header
      className={`mb-5 flex flex-col gap-4 rounded-[28px] border p-4 shadow-2xl backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between ${glass}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onProfile}
          className={`group relative h-12 w-12 overflow-hidden rounded-2xl border ${
            darkMode ? "border-white/20 bg-white/10" : "border-black/10 bg-black/5"
          }`}
        >
          {profileImage ? (
            <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center ${
                darkMode ? "text-white/80" : "text-black/70"
              }`}
            >
              <User size={22} />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Camera size={17} className="text-white" />
          </div>
        </button>

        <div>
          <p className="text-sm font-semibold">Welcome</p>
          <p className={`max-w-[220px] truncate text-xs ${muted}`}>{email}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div
          className={`flex items-center gap-3 rounded-2xl border px-3 py-2 backdrop-blur-xl ${
            darkMode ? "border-white/15 bg-white/5" : "border-black/10 bg-black/5"
          }`}
        >
          <Clock3 size={17} className={darkMode ? "text-cyan-200" : "text-cyan-600"} />
          <div className="leading-none">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tabular-nums">{clockTime}</span>
              <span className={`text-[10px] font-semibold ${muted}`}>{gmtLabel}</span>
            </div>
            <p className={`mt-1 text-[9px] ${muted}`}>{clockDate}</p>
          </div>
          <button
            type="button"
            onClick={onWeatherSettings}
            className={`flex h-8 items-center gap-1 rounded-xl border px-2 text-[10px] font-semibold transition ${
              darkMode
                ? "border-white/15 bg-slate-900/80 text-white hover:bg-slate-800"
                : "border-black/10 bg-white/80 text-black hover:bg-white"
            }`}
            title="Weather location and settings"
          >
            <Globe2 size={13} />
            <span className="max-w-[90px] truncate">{locationName}</span>
          </button>
        </div>

        <button type="button" onClick={onBackground} className={actionClass}>
          <ImageIcon size={16} />
          <span className="hidden sm:inline">Background</span>
        </button>

        <button type="button" onClick={onLogout} className={actionClass}>
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { GlobalBackground } from "@/components/layout/GlobalBackground";

export type WeatherLocation = {
  id?: number;
  name: string;
  country?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  auto?: boolean;
};

export type MasterWeather = {
  location: WeatherLocation;
  timezone: string;
  currentLocalTime: string;
  sunrise: string;
  sunset: string;
  weatherCode: number;
  cloudCover: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  isDay: boolean;
  utcOffsetSeconds: number;
};

export type SunPhase =
  | "night"
  | "dawn"
  | "sunrise"
  | "day"
  | "golden-hour"
  | "sunset"
  | "dusk";

type ThemeColors = {
  top: string;
  middle: string;
  bottom: string;
  css: string;
};

type MasterThemeContextValue = {
  weather: MasterWeather | null;
  location: WeatherLocation;
  currentTime: Date;
  currentLocalTime: string;
  timezone: string;
  sunrise: string;
  sunset: string;
  sunProgress: number;
  daylightProgress: number;
  sunPhase: SunPhase;
  isNight: boolean;
  isDay: boolean;
  darkMode: boolean;
  weatherType: "clear" | "cloudy" | "rain" | "storm" | "snow";
  sky: ThemeColors;
  glass: string;
  glassSoft: string;
  muted: string;
  backgroundOverlay: string;
  background: string;
  backgroundUploadedAt: string | null;
  uploadingBackground: boolean;
  uploadBackground: (file: File) => Promise<void>;
  removeBackground: () => Promise<void>;
  refreshBackground: () => Promise<void>;
  loading: boolean;
};

const LOCATION_KEY = "smart-home-weather-location";
const BACKGROUND_TABLE = "dashboard_backgrounds";
const BACKGROUND_BUCKET = "dashboard-backgrounds";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&q=85";

const DEFAULT_LOCATION: WeatherLocation = {
  id: 1174872,
  name: "Karachi",
  latitude: 24.8607,
  longitude: 67.0011,
  country: "Pakistan",
  country_code: "PK",
  timezone: "Asia/Karachi",
};

const MasterThemeContext = createContext<MasterThemeContextValue | null>(null);

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const toHex = (value: number) =>
    Math.round(Math.max(0, Math.min(255, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateHex(from: string, to: string, amount: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

function getMinutesFromLocalTime(value: string) {
  const timePart = value.includes("T") ? value.split("T")[1] : value;
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getLocalMinutes(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "00";
  return Number(get("hour")) * 60 + Number(get("minute"));
}

function getSunriseAwareSky(
  now: Date,
  weather: MasterWeather | null,
  timezone: string,
): ThemeColors & { isNight: boolean } {
  if (!weather) {
    return {
      top: "#020617",
      middle: "#020617",
      bottom: "#020617",
      css: "linear-gradient(180deg, #020617 0%, #020617 100%)",
      isNight: true,
    };
  }

  const current = getLocalMinutes(now, timezone);
  const sunrise = getMinutesFromLocalTime(weather.sunrise);
  const sunset = getMinutesFromLocalTime(weather.sunset);

  if (sunrise === null || sunset === null) {
    return {
      top: "#020617",
      middle: "#020617",
      bottom: "#020617",
      css: "linear-gradient(180deg, #020617 0%, #020617 100%)",
      isNight: true,
    };
  }

  if (current < sunrise - 45 || current > sunset + 60) {
    return {
      top: "#020617",
      middle: "#020617",
      bottom: "#020617",
      css: "linear-gradient(180deg, #020617 0%, #020617 100%)",
      isNight: true,
    };
  }

  let top: string;
  let bottom: string;

  if (current < sunrise) {
    const t = Math.max(0, Math.min(1, (current - sunrise + 45) / 45));
    top = interpolateHex("#020617", "#312E81", t);
    bottom = interpolateHex("#020617", "#FF7A45", t);
  } else if (current <= sunset) {
    const t = Math.max(0, Math.min(1, (current - sunrise) / Math.max(1, sunset - sunrise)));
    top =
      t < 0.82
        ? interpolateHex("#87CEFA", "#FFD27F", t / 0.82)
        : interpolateHex("#FFD27F", "#FF7043", (t - 0.82) / 0.18);
    bottom =
      t < 0.65
        ? interpolateHex("#BDEBFF", "#FFD27F", t / 0.65)
        : interpolateHex("#FFD27F", "#FF8A65", (t - 0.65) / 0.35);
  } else {
    const t = Math.max(0, Math.min(1, (current - sunset) / 60));
    top = interpolateHex("#FF7043", "#020617", t);
    bottom = interpolateHex("#FF8A65", "#020617", t);
  }

  const middle = interpolateHex(top, bottom, 0.45);
  return {
    top,
    middle,
    bottom,
    css: `linear-gradient(180deg, ${top} 0%, ${middle} 45%, ${bottom} 100%)`,
    isNight: false,
  };
}

function getWeatherType(weatherCode: number): MasterThemeContextValue["weatherType"] {
  if ([95, 96, 99].includes(weatherCode)) return "storm";
  if (weatherCode >= 71 && weatherCode <= 86) return "snow";
  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return "rain";
  }
  if ([1, 2, 3, 45, 48].includes(weatherCode)) return "cloudy";
  return "clear";
}

function getSunPhase(now: Date, timezone: string, sunriseValue: string, sunsetValue: string): SunPhase {
  const current = getLocalMinutes(now, timezone);
  const sunrise = getMinutesFromLocalTime(sunriseValue);
  const sunset = getMinutesFromLocalTime(sunsetValue);
  if (sunrise === null || sunset === null) return "night";
  if (current < sunrise - 45) return "night";
  if (current < sunrise - 15) return "dawn";
  if (current < sunrise + 30) return "sunrise";
  if (current < sunset - 90) return "day";
  if (current < sunset) return "golden-hour";
  if (current < sunset + 20) return "sunset";
  if (current <= sunset + 60) return "dusk";
  return "night";
}

async function fetchWeather(location: WeatherLocation): Promise<MasterWeather> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "weather_code,cloud_cover,precipitation,rain,snowfall,is_day",
    daily: "sunrise,sunset",
    forecast_days: "1",
    timezone: "auto",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Weather API request failed.");
  const data = await response.json();

  return {
    location,
    timezone: data.timezone ?? location.timezone ?? "UTC",
    currentLocalTime: data.current?.time ?? "",
    sunrise: data.daily?.sunrise?.[0] ?? "",
    sunset: data.daily?.sunset?.[0] ?? "",
    weatherCode: Number(data.current?.weather_code ?? 0),
    cloudCover: Number(data.current?.cloud_cover ?? 0),
    precipitation: Number(data.current?.precipitation ?? 0),
    rain: Number(data.current?.rain ?? 0),
    snowfall: Number(data.current?.snowfall ?? 0),
    isDay: Boolean(data.current?.is_day),
    utcOffsetSeconds: Number(data.utc_offset_seconds ?? 0),
  };
}

export function MasterThemeProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<WeatherLocation>(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<MasterWeather | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);
  const [backgroundUploadedAt, setBackgroundUploadedAt] = useState<string | null>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const locationKeyRef = useRef("");

  const readLocation = useCallback((): WeatherLocation => {
    try {
      const raw = localStorage.getItem(LOCATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WeatherLocation;
        if (parsed?.name && Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_LOCATION;
  }, []);

  const refreshWeather = useCallback(async () => {
    const nextLocation = readLocation();
    setLocation(nextLocation);
    locationKeyRef.current = JSON.stringify(nextLocation);
    try {
      setWeather(await fetchWeather(nextLocation));
    } catch (error) {
      console.error("Master weather error:", error);
    } finally {
      setLoading(false);
    }
  }, [readLocation]);

  const refreshBackground = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBackground(DEFAULT_BACKGROUND);
        setBackgroundUploadedAt(null);
        return;
      }

      const { data } = await supabase
        .from(BACKGROUND_TABLE)
        .select("file_path, uploaded_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) {
        setBackground(DEFAULT_BACKGROUND);
        setBackgroundUploadedAt(null);
        return;
      }

      const uploadedAt = new Date(data.uploaded_at);
      if (Date.now() - uploadedAt.getTime() >= THIRTY_DAYS) {
        await supabase.storage.from(BACKGROUND_BUCKET).remove([data.file_path]);
        await supabase.from(BACKGROUND_TABLE).delete().eq("user_id", user.id);
        setBackground(DEFAULT_BACKGROUND);
        setBackgroundUploadedAt(null);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(BACKGROUND_BUCKET)
        .getPublicUrl(data.file_path);

      setBackground(
        publicUrlData?.publicUrl
          ? `${publicUrlData.publicUrl}?v=${uploadedAt.getTime()}`
          : DEFAULT_BACKGROUND,
      );
      setBackgroundUploadedAt(data.uploaded_at);
    } catch (error) {
      console.error("Global background load error:", error);
      setBackground(DEFAULT_BACKGROUND);
    }
  }, []);

  const uploadBackground = useCallback(async (file: File) => {
    setUploadingBackground(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in again.");

      const filePath = `${user.id}/background.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(BACKGROUND_BUCKET)
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const uploadedAt = new Date().toISOString();
      const { error: dbError } = await supabase
        .from(BACKGROUND_TABLE)
        .upsert(
          { user_id: user.id, file_path: filePath, uploaded_at: uploadedAt },
          { onConflict: "user_id" },
        );
      if (dbError) throw dbError;

      const { data: publicUrlData } = supabase.storage
        .from(BACKGROUND_BUCKET)
        .getPublicUrl(filePath);
      setBackground(
        publicUrlData?.publicUrl
          ? `${publicUrlData.publicUrl}?v=${Date.now()}`
          : DEFAULT_BACKGROUND,
      );
      setBackgroundUploadedAt(uploadedAt);
    } finally {
      setUploadingBackground(false);
    }
  }, []);

  const removeBackground = useCallback(async () => {
    setUploadingBackground(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const filePath = `${user.id}/background.jpg`;
        await supabase.storage.from(BACKGROUND_BUCKET).remove([filePath]);
        await supabase.from(BACKGROUND_TABLE).delete().eq("user_id", user.id);
      }
      setBackground(DEFAULT_BACKGROUND);
      setBackgroundUploadedAt(null);
    } finally {
      setUploadingBackground(false);
    }
  }, []);

  useEffect(() => {
    refreshWeather();
    refreshBackground();

    const clock = window.setInterval(() => setCurrentTime(new Date()), 1000);
    const weatherTimer = window.setInterval(refreshWeather, 60_000);
    const settingsTimer = window.setInterval(() => {
      const next = JSON.stringify(readLocation());
      if (next !== locationKeyRef.current) refreshWeather();
    }, 3000);

    const handleLocationChanged = () => {
      void refreshWeather();
    };
    window.addEventListener("smart-home-weather-location-changed", handleLocationChanged);

    const handleAuth = supabase.auth.onAuthStateChange(() => {
      void refreshBackground();
    });

    return () => {
      window.clearInterval(clock);
      window.clearInterval(weatherTimer);
      window.clearInterval(settingsTimer);
      window.removeEventListener("smart-home-weather-location-changed", handleLocationChanged);
      handleAuth.data.subscription.unsubscribe();
    };
  }, [readLocation, refreshBackground, refreshWeather]);

  const timezone = weather?.timezone || location.timezone || "UTC";
  const skyWithNight = useMemo(
    () => getSunriseAwareSky(currentTime, weather, timezone),
    [currentTime, timezone, weather],
  );

  const darkMode = useMemo(() => {
    const localHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }).format(currentTime),
    );
    return localHour < 6 || localHour >= 18;
  }, [currentTime, timezone]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.classList.toggle("light", !darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const weatherType = getWeatherType(weather?.weatherCode ?? 3);
  const sunPhase = getSunPhase(currentTime, timezone, weather?.sunrise ?? "", weather?.sunset ?? "");
  const currentMinutes = getLocalMinutes(currentTime, timezone);
  const sunriseMinutes = getMinutesFromLocalTime(weather?.sunrise ?? "");
  const sunsetMinutes = getMinutesFromLocalTime(weather?.sunset ?? "");
  const daylightProgress =
    sunriseMinutes !== null && sunsetMinutes !== null && sunsetMinutes > sunriseMinutes
      ? Math.max(0, Math.min(1, (currentMinutes - sunriseMinutes) / (sunsetMinutes - sunriseMinutes)))
      : 0;

  const glass = darkMode
    ? "border-white/15 bg-black/[0.30] text-white"
    : "border-black/10 bg-white/[0.55] text-black";
  const glassSoft = darkMode
    ? "border-white/10 bg-white/[0.07]"
    : "border-black/10 bg-white/[0.45]";
  const muted = darkMode ? "text-white/50" : "text-black/50";
  const backgroundOverlay = !darkMode
    ? "bg-white/65"
    : skyWithNight.isNight
      ? "bg-slate-950/25"
      : weatherType === "rain"
        ? "bg-slate-900/60"
        : weatherType === "storm"
          ? "bg-slate-950/75"
          : "bg-slate-900/45";

  const value = useMemo<MasterThemeContextValue>(
    () => ({
      weather,
      location,
      currentTime,
      currentLocalTime: weather?.currentLocalTime ?? "",
      timezone,
      sunrise: weather?.sunrise ?? "",
      sunset: weather?.sunset ?? "",
      sunProgress: daylightProgress,
      daylightProgress,
      sunPhase,
      isNight: skyWithNight.isNight,
      isDay: !skyWithNight.isNight,
      darkMode,
      weatherType,
      sky: skyWithNight,
      glass,
      glassSoft,
      muted,
      backgroundOverlay,
      background,
      backgroundUploadedAt,
      uploadingBackground,
      uploadBackground,
      removeBackground,
      refreshBackground,
      loading,
    }),
    [
      weather,
      location,
      currentTime,
      timezone,
      daylightProgress,
      sunPhase,
      skyWithNight,
      darkMode,
      weatherType,
      glass,
      glassSoft,
      muted,
      backgroundOverlay,
      background,
      backgroundUploadedAt,
      uploadingBackground,
      uploadBackground,
      removeBackground,
      refreshBackground,
      loading,
    ],
  );

  return (
    <MasterThemeContext.Provider value={value}>
      <GlobalBackground
        background={background}
        skyCss={skyWithNight.css}
        darkMode={darkMode}
        isNight={skyWithNight.isNight}
        weatherType={weatherType}
        backgroundOverlay={backgroundOverlay}
      />
      <div className="relative z-10 min-h-screen">{children}</div>
    </MasterThemeContext.Provider>
  );
}

export function useMasterTheme() {
  const context = useContext(MasterThemeContext);
  if (!context) throw new Error("useMasterTheme must be used inside MasterThemeProvider.");
  return context;
}

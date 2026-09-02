"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { navigateWithTransition } from "@/lib/viewTransition";
import { supabase } from "@/lib/supabase";

import {
  Home,
  Plus,
  LogOut,
  Loader2,
  X,
  AlertCircle,
  ArrowUpRight,
  Upload,
  Image as ImageIcon,
  Trash2,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  Wind,
  Droplets,
  MapPin,
  Zap,
  BarChart3,
  TrendingUp,
  TrendingDown,
  User,
  Camera,
  MoonStar,
  SunMedium,
  Clock3,
  Settings2,
  RefreshCw,
} from "lucide-react";

type House = {
  id: string;
  name: string;
  created_at: string;
};

type WeatherData = {
  temperature: number;
  apparentTemperature: number;
  highTemperature: number;
  lowTemperature: number;
  dewPoint: number;
  humidity: number;

  precipitation: number;
  rainfallAmount: number;
  snowfallDepthCm: number;
  precipitationRateMmH: number;
  precipitationChance: number;

  weatherCode: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  pressureHpa: number;

  visibilityMeters: number;
  cloudCover: number;
  uvIndex: number;

  isDay: boolean;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: number | null;

  city: string;
  country: string;
  timezone: string;

  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozoneUgM3: number | null;
  no2UgM3: number | null;
  coUgM3: number | null;
  so2UgM3: number | null;
};

type RoomLoad = {
  room: string;
  watts: number;
};

type TemperatureUnit = "C" | "F";
type WindUnit = "km/h" | "mph" | "m/s" | "knots";
type PrecipitationUnit = "mm" | "in";
type SnowUnit = "cm" | "in";
type PressureUnit = "hPa" | "mb" | "inHg";
type VisibilityUnit = "km" | "mi";
type TimeFormat = "12h" | "24h";
type OzoneUnit = "ppb" | "ug/m3";
type COUnit = "ppm" | "mg/m3";

type WeatherLocation = {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  auto?: boolean;
};

type CitySearchResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type ThemeMode = "manual-dark" | "manual-light" | "auto";

const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&q=85";

function convertTemperature(value: number, unit: TemperatureUnit) {
  return unit === "F" ? (value * 9) / 5 + 32 : value;
}

function convertWindSpeed(valueKmh: number, unit: WindUnit) {
  switch (unit) {
    case "mph":
      return valueKmh * 0.621371;
    case "m/s":
      return valueKmh / 3.6;
    case "knots":
      return valueKmh * 0.539957;
    default:
      return valueKmh;
  }
}

function convertPrecipitation(valueMm: number, unit: PrecipitationUnit) {
  return unit === "in" ? valueMm / 25.4 : valueMm;
}

function convertSnow(valueCm: number, unit: SnowUnit) {
  return unit === "in" ? valueCm / 2.54 : valueCm;
}

function convertPressure(valueHpa: number, unit: PressureUnit) {
  if (unit === "inHg") return valueHpa * 0.0295299830714;
  return valueHpa;
}

function convertVisibility(valueMeters: number, unit: VisibilityUnit) {
  return unit === "mi" ? valueMeters / 1609.344 : valueMeters / 1000;
}

function windDirectionLabel(degrees: number) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((degrees % 360) + 360) % 360;
  return labels[Math.round(normalized / 45) % 8];
}

function aqiLabel(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Unavailable";
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for sensitive groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}

function ozoneToPpb(ugM3: number) {
  return ugM3 * (24.45 / 48);
}

function no2ToPpb(ugM3: number) {
  return ugM3 * (24.45 / 46.0055);
}

function so2ToPpb(ugM3: number) {
  return ugM3 * (24.45 / 64.066);
}

function coToMgM3(ugM3: number) {
  return ugM3 / 1000;
}

function coToPpm(ugM3: number) {
  const mgM3 = coToMgM3(ugM3);
  return mgM3 * (24.45 / 28.01);
}

function formatWeatherTime(value: string, format: TimeFormat) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const timePart = value.includes("T") ? value.split("T")[1] : value;
    if (format === "24h") return timePart?.slice(0, 5) || "—";

    const [hoursRaw, minutes = "00"] = (timePart || "").split(":");
    const hours = Number(hoursRaw);

    if (!Number.isFinite(hours)) return value;

    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return `${hour12}:${minutes} ${period}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: format === "12h",
  }).format(date);
}

function moonPhaseLabel(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Unavailable";

  let phase = value;

  if (phase > 1) {
    phase = phase <= 100 ? phase / 100 : phase / 360;
  }

  phase = ((phase % 1) + 1) % 1;

  if (phase < 0.03 || phase >= 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

function formatMetric(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number(value).toFixed(digits);
}

function formatShortWeatherTime(value: string) {
  if (!value) return "—";

  const timePart = value.includes("T") ? value.split("T")[1] : value;
  const [hoursRaw, minutes = "00"] = timePart.split(":");
  const hours = Number(hoursRaw);

  if (!Number.isFinite(hours)) return "—";

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${minutes} ${period}`;
}

function getDayDuration(sunrise: string, sunset: string) {
  if (!sunrise || !sunset) return "—";

  const parseMinutes = (value: string) => {
    const timePart = value.includes("T") ? value.split("T")[1] : value;
    const [hoursRaw, minutesRaw = "0"] = timePart.split(":");
    return Number(hoursRaw) * 60 + Number(minutesRaw);
  };

  const start = parseMinutes(sunrise);
  const end = parseMinutes(sunset);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const total = end - start;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return `${hours}h ${minutes}m`;
}

function getWeatherInfo(code: number) {
  if (code === 0) {
    return {
      label: "Clear sky",
      type: "clear",
    };
  }

  if ([1, 2, 3].includes(code)) {
    return {
      label: code === 3 ? "Overcast" : "Partly cloudy",
      type: "cloudy",
    };
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return {
      label: "Drizzle",
      type: "rain",
    };
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return {
      label: "Rain",
      type: "rain",
    };
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return {
      label: "Snow",
      type: "snow",
    };
  }

  if ([95, 96, 99].includes(code)) {
    return {
      label: "Thunderstorm",
      type: "storm",
    };
  }

  return {
    label: "Cloudy",
    type: "cloudy",
  };
}

function WeatherIcon({
  code,
  size = 42,
  isDay = true,
}: {
  code: number;
  size?: number;
  isDay?: boolean;
}) {
  const info = getWeatherInfo(code);

  if (info.type === "rain") {
    return <CloudRain size={size} />;
  }

  if (info.type === "snow") {
    return <CloudSnow size={size} />;
  }

  if (info.type === "storm") {
    return <CloudRain size={size} />;
  }

  if (info.type === "clear") {
    return isDay ? <Sun size={size} /> : <MoonStar size={size} />;
  }

  return <CloudSun size={size} />;
}

// =====================================================
// MINUTE-WISE SKY ENGINE
// =====================================================

type SkyStop = {
  minute: number;
  top: string;
  bottom: string;
};

const SKY_STOPS: SkyStop[] = [
  // 🌙 Deep Night
  {
    minute: 0,
    top: "#020617",
    bottom: "#020617",
  },

  // 🌌 Pre Sunrise / Blue Hour
  {
    minute: 240,
    top: "#020617",
    bottom: "#111827",
  },
  {
    minute: 270,
    top: "#111827",
    bottom: "#312E81",
  },
  {
    minute: 300,
    top: "#312E81",
    bottom: "#6B5B95",
  },

  // 🌅 Sunrise
{
  minute: 330,
  top: "#4B3B78",
  bottom: "#FF7A45",
},

{
  minute: 360,
  top: "#FF7A45",
  bottom: "#FFD166",
},

{
  minute: 390,
  top: "#FFD166",
  bottom: "#B8E3FF",
},


// 🌤 Morning
{
  minute: 420,
  top: "#B8E3FF",
  bottom: "#4FA3FF",
},

{
  minute: 480,
  top: "#4FA3FF",
  bottom: "#1687FF",
},

{
  minute: 540,
  top: "#1687FF",
  bottom: "#0077E6",
},


// ☀️ Late Morning
{
  minute: 600,
  top: "#0077E6",
  bottom: "#0066CC",
},


// 🌞 Noon
{
  minute: 660,
  top: "#0066CC",
  bottom: "#0055AA",
},

{
  minute: 720,
  top: "#0055AA",
  bottom: "#0088FF",
},


// 🌤 Afternoon
{
  minute: 780,
  top: "#0088FF",
  bottom: "#3399FF",
},

{
  minute: 840,
  top: "#3399FF",
  bottom: "#87CEFA",
},


// 🌇 Late Afternoon
{
  minute: 900,
  top: "#87CEFA",
  bottom: "#FFD27F",
},


// 🌇 Golden Hour
{
  minute: 960,
  top: "#FFD27F",
  bottom: "#FFB347",
},

{
  minute: 1020,
  top: "#FFB347",
  bottom: "#FF7043",
},

  // 🌅 Sunset
  {
    minute: 1050,
    top: "#FFB347",
    bottom: "#FF8A65",
  },
  {
    minute: 1080,
    top: "#FF8A65",
    bottom: "#FF7043",
  },
  {
    minute: 1110,
    top: "#FF7043",
    bottom: "#FF6F91",
  },

  // 🌆 Twilight
  {
    minute: 1140,
    top: "#FF6F91",
    bottom: "#9C5C9E",
  },
  {
    minute: 1170,
    top: "#9C5C9E",
    bottom: "#6A4C93",
  },
  {
    minute: 1200,
    top: "#6A4C93",
    bottom: "#283593",
  },

  // 🌙 Night
  {
    minute: 1260,
    top: "#283593",
    bottom: "#020617",
  },
  {
    minute: 1380,
    top: "#020617",
    bottom: "#020617",
  },

  {
    minute: 1440,
    top: "#020617",
    bottom: "#020617",
  },
];

const GMT_OFFSETS = Array.from({ length: 27 }, (_, index) => index - 12);

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;

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

function getSkyGradient(date: Date, gmtOffset: number) {
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;

  let minute = utcMinutes + gmtOffset * 60;

  // Normalize to 0–1439.99
  minute = ((minute % 1440) + 1440) % 1440;

  // -----------------------------------------------------
  // Find the two surrounding sky stops
  // -----------------------------------------------------

  let previous = SKY_STOPS[0];
  let next = SKY_STOPS[1];

  for (let index = 1; index < SKY_STOPS.length; index += 1) {
    if (minute < SKY_STOPS[index].minute) {
      previous = SKY_STOPS[index - 1];

      next = SKY_STOPS[index];

      break;
    }
  }

  // -----------------------------------------------------
  // Handle 00:00 → 04:00 correctly
  // -----------------------------------------------------

  if (minute >= SKY_STOPS[SKY_STOPS.length - 1].minute) {
    previous = SKY_STOPS[SKY_STOPS.length - 2];

    next = SKY_STOPS[SKY_STOPS.length - 1];
  }

  // -----------------------------------------------------
  // Interpolation
  // -----------------------------------------------------

  const range = Math.max(1, next.minute - previous.minute);

  const progress = Math.max(0, Math.min(1, (minute - previous.minute) / range));

  const top = interpolateHex(previous.top, next.top, progress);

  const bottom = interpolateHex(previous.bottom, next.bottom, progress);

  return {
    minute,
    top,
    bottom,
    css:
`linear-gradient(
180deg,
${top} 0%,
${interpolateHex(top,bottom,0.35)} 45%,
${bottom} 100%
)`,
  };
}

function formatGmtOffset(offset: number) {
  return `GMT${offset >= 0 ? "+" : "-"}${String(Math.abs(offset)).padStart(2, "0")}:00`;
}

function formatClockTime(date: Date, gmtOffset: number) {
  const totalMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + gmtOffset * 60;

  const normalized = ((totalMinutes % 1440) + 1440) % 1440;

  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const seconds = date.getUTCSeconds();

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}

function getClockDateParts(date: Date, gmtOffset: number) {
  const shifted = new Date(date.getTime() + gmtOffset * 60 * 60 * 1000);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(shifted);
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(shifted);

  return `${weekday}, ${month}`;
}

function HumidityGauge({
  value,
  darkMode,
}: {
  value: number;
  darkMode: boolean;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  const radius = 39;
  const circumference = 2 * Math.PI * radius;

  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className={darkMode ? "text-white/10" : "text-black/10"}
        />

        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={darkMode ? "text-cyan-300" : "text-cyan-600"}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Droplets
          size={14}
          className={darkMode ? "text-cyan-200" : "text-cyan-600"}
        />

        <span
          className={`mt-0.5 text-lg font-semibold ${
            darkMode ? "text-white" : "text-black"
          }`}
        >
          {Math.round(safeValue)}%
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profileInputRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState("");
  const [houses, setHouses] = useState<House[]>([]);

  const [showCreateHouse, setShowCreateHouse] = useState(false);

  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);

  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const [houseName, setHouseName] = useState("");

  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);

  const [background, setBackground] = useState(DEFAULT_BACKGROUND);

  const [uploadingBackground, setUploadingBackground] = useState(false);

  const [backgroundUploadedAt, setBackgroundUploadedAt] = useState<
    string | null
  >(null);

  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [uploadingProfile, setUploadingProfile] = useState(false);

  const [weather, setWeather] = useState<WeatherData | null>(null);

  const [weatherLoading, setWeatherLoading] = useState(true);

  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("C");
  const [windUnit, setWindUnit] = useState<WindUnit>("km/h");
  const [precipitationUnit, setPrecipitationUnit] =
    useState<PrecipitationUnit>("mm");
  const [snowUnit, setSnowUnit] = useState<SnowUnit>("cm");
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>("hPa");
  const [visibilityUnit, setVisibilityUnit] =
    useState<VisibilityUnit>("km");
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("24h");
  const [ozoneUnit, setOzoneUnit] = useState<OzoneUnit>("ppb");
  const [coUnit, setCoUnit] = useState<COUnit>("ppm");

  const [showWeatherSettings, setShowWeatherSettings] = useState(false);
  const [rainEffectsEnabled, setRainEffectsEnabled] = useState(true);
  const [snowEffectsEnabled, setSnowEffectsEnabled] = useState(true);

  const AUTO_WEATHER_LOCATION: WeatherLocation = {
    name: "Auto Location",
    latitude: 24.8607,
    longitude: 67.0011,
    auto: true,
  };

  const [weatherLocation, setWeatherLocation] =
    useState<WeatherLocation>(AUTO_WEATHER_LOCATION);
  const [pendingWeatherLocation, setPendingWeatherLocation] =
    useState<WeatherLocation>(AUTO_WEATHER_LOCATION);

  const [weatherCitySearch, setWeatherCitySearch] = useState("");
  const [citySearchResults, setCitySearchResults] =
    useState<CitySearchResult[]>([]);
  const [citySearchLoading, setCitySearchLoading] = useState(false);

  const [roomLoads, setRoomLoads] = useState<RoomLoad[]>([]);

  const [thisMonthKwh, setThisMonthKwh] = useState(0);

  const [lastMonthKwh, setLastMonthKwh] = useState(0);

  const [error, setError] = useState("");

  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");

  const [darkMode, setDarkMode] = useState(true);

  const [themeReady, setThemeReady] = useState(false);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  const [gmtOffset, setGmtOffset] = useState(5);

  // =====================================================
  // DIGITAL CLOCK + GMT SETTING
  // =====================================================

  useEffect(() => {
    const savedGmt = localStorage.getItem("smart-home-gmt-offset");

    if (savedGmt !== null) {
      const parsed = Number(savedGmt);

      if (Number.isInteger(parsed) && parsed >= -12 && parsed <= 14) {
        setGmtOffset(parsed);
      }
    }

    const tick = () => {
      setCurrentTime(new Date());
    };

    tick();

    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // =====================================================
  // THEME MODE — LOAD SAVED SETTING
  // =====================================================

  useEffect(() => {
    const savedMode = localStorage.getItem("smart-home-theme-mode");

    let mode: ThemeMode = "auto";

    if (
      savedMode === "manual-dark" ||
      savedMode === "manual-light" ||
      savedMode === "auto"
    ) {
      mode = savedMode;
    } else {
      const oldTheme = localStorage.getItem("smart-home-theme");

      if (oldTheme === "light") {
        mode = "manual-light";
      } else if (oldTheme === "dark") {
        mode = "manual-dark";
      }
    }

    setThemeMode(mode);
    setThemeReady(true);
  }, []);

  // =====================================================
  // THEME ENGINE
  // =====================================================

  useEffect(() => {
    if (!themeReady) return;

    function getAutomaticDarkState() {
      const utcMinutes =
        currentTime.getUTCHours() * 60 +
        currentTime.getUTCMinutes() +
        currentTime.getUTCSeconds() / 60;

      let localMinutes = utcMinutes + gmtOffset * 60;

      localMinutes = ((localMinutes % 1440) + 1440) % 1440;

      /*
       * -----------------------------------------------
       * AUTO THEME — SAME 24-HOUR SKY CLOCK
       * -----------------------------------------------
       *
       * 00:00 - 05:59 = DARK
       * 06:00 - 18:29 = LIGHT
       * 18:30 - 23:59 = DARK
       *
       * This follows the same GMT-selected
       * 24-hour clock used by the sky engine.
       */

      const sunriseMinutes = 6 * 60;
      const sunsetMinutes = 18 * 60 + 30;

      if (localMinutes < sunriseMinutes || localMinutes >= sunsetMinutes) {
        return true;
      }

      return false;
    }

    function applyTheme() {
      let nextDark: boolean;

      if (themeMode === "manual-dark") {
        nextDark = true;
      } else if (themeMode === "manual-light") {
        nextDark = false;
      } else {
        nextDark = getAutomaticDarkState();
      }

      setDarkMode(nextDark);

      const html = document.documentElement;

      // Main Tailwind class
      html.classList.toggle("dark", nextDark);

      // Explicit light class too
      html.classList.toggle("light", !nextDark);

      // Browser native UI / inputs
      html.style.colorScheme = nextDark ? "dark" : "light";

      localStorage.setItem("smart-home-theme-mode", themeMode);
    }

    applyTheme();

    const interval = window.setInterval(applyTheme, 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [themeMode, gmtOffset, currentTime, themeReady]);

  // =====================================================
  // THEME BUTTON
  // =====================================================

  function cycleThemeMode() {
    /*
     * AUTO -> opposite of CURRENT AUTO state
     *
     * If currently automatic LIGHT:
     *     next = Manual Dark
     *
     * If currently automatic DARK:
     *     next = Manual Light
     *
     * Manual -> AUTO
     */

    if (themeMode === "auto") {
      setThemeMode(darkMode ? "manual-light" : "manual-dark");

      return;
    }

    setThemeMode("auto");
  }

  function getThemeButtonText() {
    if (themeMode === "auto") {
      return darkMode ? "Light" : "Dark";
    }

    return "Auto";
  }

  const isAutoMode = themeMode === "auto";

  // =====================================================
  // WEATHER SETTINGS + GLOBAL CITY SEARCH
  // =====================================================

  useEffect(() => {
    const raw =
      localStorage.getItem("smart-weather-settings-v3") ||
      localStorage.getItem("weather-settings");

    if (!raw) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const america = timezone.startsWith("America/");

      if (america) {
        setTemperatureUnit("F");
        setWindUnit("mph");
        setPrecipitationUnit("in");
        setSnowUnit("in");
        setPressureUnit("inHg");
        setVisibilityUnit("mi");
        setTimeFormat("12h");
      }

      return;
    }

    try {
      const saved = JSON.parse(raw);

      if (saved.temperatureUnit === "C" || saved.temperatureUnit === "F") {
        setTemperatureUnit(saved.temperatureUnit);
      }

      if (
        saved.windUnit === "km/h" ||
        saved.windUnit === "mph" ||
        saved.windUnit === "m/s" ||
        saved.windUnit === "knots"
      ) {
        setWindUnit(saved.windUnit);
      }

      if (saved.precipitationUnit === "mm" || saved.precipitationUnit === "in") {
        setPrecipitationUnit(saved.precipitationUnit);
      }

      if (saved.snowUnit === "cm" || saved.snowUnit === "in") {
        setSnowUnit(saved.snowUnit);
      }

      if (
        saved.pressureUnit === "hPa" ||
        saved.pressureUnit === "mb" ||
        saved.pressureUnit === "inHg"
      ) {
        setPressureUnit(saved.pressureUnit);
      }

      if (saved.visibilityUnit === "km" || saved.visibilityUnit === "mi") {
        setVisibilityUnit(saved.visibilityUnit);
      }

      if (saved.timeFormat === "12h" || saved.timeFormat === "24h") {
        setTimeFormat(saved.timeFormat);
      }

      if (saved.ozoneUnit === "ppb" || saved.ozoneUnit === "ug/m3") {
        setOzoneUnit(saved.ozoneUnit);
      }

      if (saved.coUnit === "ppm" || saved.coUnit === "mg/m3") {
        setCoUnit(saved.coUnit);
      }

      if (typeof saved.rainEffectsEnabled === "boolean") {
        setRainEffectsEnabled(saved.rainEffectsEnabled);
      }

      if (typeof saved.snowEffectsEnabled === "boolean") {
        setSnowEffectsEnabled(saved.snowEffectsEnabled);
      }

      if (
        saved.location &&
        typeof saved.location.name === "string" &&
        typeof saved.location.latitude === "number" &&
        typeof saved.location.longitude === "number"
      ) {
        setWeatherLocation(saved.location);
        setPendingWeatherLocation(saved.location);

        window.setTimeout(() => {
          loadWeather(saved.location);
        }, 0);
      }
    } catch (error) {
      console.error("Could not read weather settings", error);
    }
  }, []);

  useEffect(() => {
    if (!showWeatherSettings) return;

    const query = weatherCitySearch.trim();

    if (query.length < 2) {
      setCitySearchResults([]);
      return;
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      try {
        setCitySearchLoading(true);

        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            query,
          )}&count=10&language=en&format=json`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("City search failed");
        }

        const data = await response.json();

        setCitySearchResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("City search error:", error);
          setCitySearchResults([]);
        }
      } finally {
        setCitySearchLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [weatherCitySearch, showWeatherSettings]);

  function openWeatherSettings() {
    setPendingWeatherLocation(weatherLocation);
    setWeatherCitySearch("");
    setCitySearchResults([]);
    setShowWeatherSettings(true);
  }

  async function applyWeatherSettings() {
    setWeatherLocation(pendingWeatherLocation);

    localStorage.setItem(
      "smart-weather-settings-v3",
      JSON.stringify({
        location: pendingWeatherLocation,
        temperatureUnit,
        windUnit,
        precipitationUnit,
        snowUnit,
        pressureUnit,
        visibilityUnit,
        timeFormat,
        ozoneUnit,
        coUnit,
        rainEffectsEnabled,
        snowEffectsEnabled,
      }),
    );

    setShowWeatherSettings(false);

    await loadWeather(pendingWeatherLocation);
  }

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/auth/login");
          return;
        }

        setEmail(user.email ?? "");

        // =================================================
        // HOUSES
        // =================================================

        const { data: housesData, error: housesError } = await supabase
          .from("houses")
          .select("id, name, created_at")
          .eq("owner_id", user.id)
          .order("created_at", {
            ascending: true,
          });

        if (housesError) {
          setError(`Could not load houses: ${housesError.message}`);
        } else {
          setHouses(housesData ?? []);
        }

        // =================================================
        // BACKGROUND
        // =================================================

        const { data: backgroundData } = await supabase
          .from("dashboard_backgrounds")
          .select("file_path, uploaded_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (backgroundData) {
          const uploadedAt = new Date(backgroundData.uploaded_at);

          const age = Date.now() - uploadedAt.getTime();

          const thirtyDays = 30 * 24 * 60 * 60 * 1000;

          if (age >= thirtyDays) {
            await supabase.storage
              .from("dashboard-backgrounds")
              .remove([backgroundData.file_path]);

            await supabase
              .from("dashboard_backgrounds")
              .delete()
              .eq("user_id", user.id);

            setBackground(DEFAULT_BACKGROUND);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from("dashboard-backgrounds")
              .getPublicUrl(backgroundData.file_path);

            if (publicUrlData?.publicUrl) {
              setBackground(
                `${publicUrlData.publicUrl}?v=${uploadedAt.getTime()}`,
              );
            }

            setBackgroundUploadedAt(backgroundData.uploaded_at);
          }
        }

        // =================================================
        // PROFILE IMAGE
        // =================================================

        const { data: avatarData } = await supabase
          .from("profile_avatars")
          .select("file_path")
          .eq("user_id", user.id)
          .maybeSingle();

        if (avatarData) {
          const { data: avatarUrlData } = supabase.storage
            .from("profile-avatars")
            .getPublicUrl(avatarData.file_path);

          if (avatarUrlData?.publicUrl) {
            setProfileImage(`${avatarUrlData.publicUrl}?v=${Date.now()}`);
          }
        }

        // =================================================
        // WEATHER
        // =================================================

        await loadWeather();

        // =================================================
        // ENERGY
        // =================================================

        await loadEnergy(user.id);
      } catch (err) {
        console.error(err);

        setError("Something went wrong while loading the dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  // =====================================================
  // WEATHER
  // =====================================================

  async function loadWeather(locationOverride?: WeatherLocation) {
    try {
      setWeatherLoading(true);

      const target = locationOverride ?? weatherLocation;

      let latitude = target.latitude;
      let longitude = target.longitude;
      let city = target.name;
      let country = target.country ?? "";

      if (target.auto && typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 7000,
                maximumAge: 15 * 60 * 1000,
              });
            },
          );

          latitude = position.coords.latitude;
          longitude = position.coords.longitude;

          city = "Current Location";
          country = "";
        } catch {
          city = "Karachi";
          country = "Pakistan";
          latitude = 24.8607;
          longitude = 67.0011;
        }
      }

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,precipitation,precipitation_probability,rain,snowfall,snow_depth,weather_code,cloud_cover,surface_pressure,visibility,uv_index,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day` +
        `&daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum,precipitation_probability_max,uv_index_max,sunrise,sunset,moonrise,moonset,moon_phase` +
        `&forecast_days=1&timezone=auto`;

      const airQualityUrl =
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide` +
        `&timezone=auto`;

      const [weatherResponse, airResponse] = await Promise.all([
        fetch(weatherUrl),
        fetch(airQualityUrl),
      ]);

      if (!weatherResponse.ok) {
        throw new Error("Weather request failed");
      }

      const data = await weatherResponse.json();

      let airData: any = null;

      if (airResponse.ok) {
        try {
          airData = await airResponse.json();
        } catch {
          airData = null;
        }
      }

      const intervalSeconds = Number(data.current?.interval ?? 3600);
      const currentPrecipitation = Number(data.current?.precipitation ?? 0);
      const precipitationRateMmH =
        intervalSeconds > 0
          ? currentPrecipitation * (3600 / intervalSeconds)
          : currentPrecipitation;

      const snowDepthMeters = Number(data.current?.snow_depth ?? 0);

      setWeather({
        temperature: Number(data.current?.temperature_2m ?? 0),
        apparentTemperature: Number(data.current?.apparent_temperature ?? 0),
        highTemperature: Number(data.daily?.temperature_2m_max?.[0] ?? 0),
        lowTemperature: Number(data.daily?.temperature_2m_min?.[0] ?? 0),
        dewPoint: Number(data.current?.dew_point_2m ?? 0),
        humidity: Number(data.current?.relative_humidity_2m ?? 0),

        precipitation: currentPrecipitation,
        rainfallAmount: Number(data.daily?.rain_sum?.[0] ?? data.current?.rain ?? 0),
        snowfallDepthCm: snowDepthMeters * 100,
        precipitationRateMmH,
        precipitationChance: Number(
          data.current?.precipitation_probability ??
            data.daily?.precipitation_probability_max?.[0] ??
            0,
        ),

        weatherCode: Number(data.current?.weather_code ?? 0),
        windSpeed: Number(data.current?.wind_speed_10m ?? 0),
        windGusts: Number(data.current?.wind_gusts_10m ?? 0),
        windDirection: Number(data.current?.wind_direction_10m ?? 0),
        pressureHpa: Number(data.current?.surface_pressure ?? 0),

        visibilityMeters: Number(data.current?.visibility ?? 0),
        cloudCover: Number(data.current?.cloud_cover ?? 0),
        uvIndex: Number(
          data.current?.uv_index ?? data.daily?.uv_index_max?.[0] ?? 0,
        ),

        isDay: Number(data.current?.is_day ?? 1) === 1,
        sunrise: data.daily?.sunrise?.[0] ?? "",
        sunset: data.daily?.sunset?.[0] ?? "",
        moonrise: data.daily?.moonrise?.[0] ?? "",
        moonset: data.daily?.moonset?.[0] ?? "",
        moonPhase:
          data.daily?.moon_phase?.[0] == null
            ? null
            : Number(data.daily.moon_phase[0]),

        city,
        country,
        timezone: data.timezone ?? target.timezone ?? "",

        aqi:
          airData?.current?.us_aqi == null
            ? null
            : Number(airData.current.us_aqi),
        pm25:
          airData?.current?.pm2_5 == null
            ? null
            : Number(airData.current.pm2_5),
        pm10:
          airData?.current?.pm10 == null
            ? null
            : Number(airData.current.pm10),
        ozoneUgM3:
          airData?.current?.ozone == null
            ? null
            : Number(airData.current.ozone),
        no2UgM3:
          airData?.current?.nitrogen_dioxide == null
            ? null
            : Number(airData.current.nitrogen_dioxide),
        coUgM3:
          airData?.current?.carbon_monoxide == null
            ? null
            : Number(airData.current.carbon_monoxide),
        so2UgM3:
          airData?.current?.sulphur_dioxide == null
            ? null
            : Number(airData.current.sulphur_dioxide),
      });
    } catch (err) {
      console.error("Weather error:", err);
      setError("Could not load weather for the selected location.");
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadWeather(weatherLocation);
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [weatherLocation]);

  // =====================================================
  // ENERGY
  // =====================================================

  async function loadEnergy(userId: string) {
    try {
      const now = new Date();

      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const { data, error } = await supabase
        .from("energy_readings")
        .select("room_name, watts, kwh, recorded_at")
        .eq("user_id", userId)
        .gte("recorded_at", lastMonthStart.toISOString());

      if (error) {
        console.error("Energy error:", error);
        return;
      }

      const currentRoomMap = new Map<string, number>();

      let currentKwh = 0;
      let previousKwh = 0;

      for (const reading of data ?? []) {
        const recorded = new Date(reading.recorded_at);

        const watts = Number(reading.watts ?? 0);

        const kwh = Number(reading.kwh ?? 0);

        if (recorded >= currentMonthStart) {
          currentKwh += kwh;

          currentRoomMap.set(
            reading.room_name,
            Math.max(currentRoomMap.get(reading.room_name) ?? 0, watts),
          );
        } else {
          previousKwh += kwh;
        }
      }

      setThisMonthKwh(currentKwh);

      setLastMonthKwh(previousKwh);

      setRoomLoads(
        Array.from(currentRoomMap.entries())
          .map(([room, watts]) => ({
            room,
            watts,
          }))
          .sort((a, b) => b.watts - a.watts),
      );
    } catch (err) {
      console.error(err);
    }
  }

  // =====================================================
  // PROFILE UPLOAD
  // =====================================================

  async function uploadProfile(file: File) {
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select an image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be smaller than 5MB.");
      return;
    }

    setUploadingProfile(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const filePath = `${user.id}/profile.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: dbError } = await supabase.from("profile_avatars").upsert(
        {
          user_id: user.id,
          file_path: filePath,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

      if (dbError) {
        throw dbError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setProfileImage(`${publicUrlData.publicUrl}?v=${Date.now()}`);
      }

      setShowProfileSettings(false);
    } catch (err) {
      console.error(err);

      setError("Could not upload profile image.");
    } finally {
      setUploadingProfile(false);

      if (profileInputRef.current) {
        profileInputRef.current.value = "";
      }
    }
  }

  // =====================================================
  // BACKGROUND UPLOAD
  // =====================================================

  async function uploadBackground(file: File) {
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be smaller than 8MB.");
      return;
    }

    setUploadingBackground(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const filePath = `${user.id}/background.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("dashboard-backgrounds")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const uploadedAt = new Date().toISOString();

      const { error: dbError } = await supabase
        .from("dashboard_backgrounds")
        .upsert(
          {
            user_id: user.id,
            file_path: filePath,
            uploaded_at: uploadedAt,
          },
          {
            onConflict: "user_id",
          },
        );

      if (dbError) {
        throw dbError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("dashboard-backgrounds")
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setBackground(`${publicUrlData.publicUrl}?v=${Date.now()}`);
      }

      setBackgroundUploadedAt(uploadedAt);

      setShowBackgroundSettings(false);
    } catch (err) {
      console.error(err);

      setError("Could not upload background image.");
    } finally {
      setUploadingBackground(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // =====================================================
  // REMOVE BACKGROUND
  // =====================================================

  async function removeBackground() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const filePath = `${user.id}/background.jpg`;

      await supabase.storage.from("dashboard-backgrounds").remove([filePath]);

      await supabase
        .from("dashboard_backgrounds")
        .delete()
        .eq("user_id", user.id);

      setBackground(DEFAULT_BACKGROUND);

      setBackgroundUploadedAt(null);
    } catch (err) {
      console.error(err);
    }
  }

  // =====================================================
  // CREATE HOUSE
  // =====================================================

  function openCreateHouse() {
    setError("");
    setHouseName("");
    setShowCreateHouse(true);
  }

  function closeCreateHouse() {
    if (creating) return;

    setShowCreateHouse(false);

    setHouseName("");
  }

  async function createHouse() {
    setError("");

    const name = houseName.trim();

    if (!name) {
      setError("Please enter a house name.");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const { data, error: insertError } = await supabase
        .from("houses")
        .insert({
          owner_id: user.id,
          name,
          slug,
        })
        .select("id, name, created_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setHouses((current) => [...current, data]);

      setShowCreateHouse(false);

      setHouseName("");
    } catch (err) {
      console.error(err);

      setError("Could not create house.");
    } finally {
      setCreating(false);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/auth/login");
    }
  }

  // =====================================================
  // WEATHER / ENERGY
  // =====================================================

  const weatherType = weather
    ? getWeatherInfo(weather.weatherCode).type
    : "cloudy";

  const night = weather ? !weather.isDay : false;

  const energyChange =
    lastMonthKwh > 0 ? ((thisMonthKwh - lastMonthKwh) / lastMonthKwh) * 100 : 0;

  const sky = getSkyGradient(currentTime, gmtOffset);
  const clockTime = formatClockTime(currentTime, gmtOffset);
  const clockDate = getClockDateParts(currentTime, gmtOffset);

  const displayTemperature = weather
    ? convertTemperature(weather.temperature, temperatureUnit)
    : 0;

  const displayFeelsLike = weather
    ? convertTemperature(weather.apparentTemperature, temperatureUnit)
    : 0;

  const displayWindSpeed = weather
    ? convertWindSpeed(weather.windSpeed, windUnit)
    : 0;

  const displayWindGust = weather
    ? convertWindSpeed(weather.windGusts, windUnit)
    : 0;

  const displayRainfall = weather
    ? convertPrecipitation(weather.rainfallAmount, precipitationUnit)
    : 0;

  const displayPrecipitationRate = weather
    ? convertPrecipitation(weather.precipitationRateMmH, precipitationUnit)
    : 0;

  const displaySnowDepth = weather
    ? convertSnow(weather.snowfallDepthCm, snowUnit)
    : 0;

  const displayPressure = weather
    ? convertPressure(weather.pressureHpa, pressureUnit)
    : 0;

  const displayVisibility = weather
    ? convertVisibility(weather.visibilityMeters, visibilityUnit)
    : 0;

  const displayHighTemperature = weather
    ? convertTemperature(weather.highTemperature, temperatureUnit)
    : 0;

  const displayLowTemperature = weather
    ? convertTemperature(weather.lowTemperature, temperatureUnit)
    : 0;

  const displayDewPoint = weather
    ? convertTemperature(weather.dewPoint, temperatureUnit)
    : 0;

  const displayOzone =
    weather?.ozoneUgM3 == null
      ? null
      : ozoneUnit === "ppb"
        ? ozoneToPpb(weather.ozoneUgM3)
        : weather.ozoneUgM3;

  const displayNo2 =
    weather?.no2UgM3 == null ? null : no2ToPpb(weather.no2UgM3);

  const displaySo2 =
    weather?.so2UgM3 == null ? null : so2ToPpb(weather.so2UgM3);

  const displayCO =
    weather?.coUgM3 == null
      ? null
      : coUnit === "ppm"
        ? coToPpm(weather.coUgM3)
        : coToMgM3(weather.coUgM3);

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="h-20 animate-pulse rounded-[28px] bg-white/10" />

          <div className="h-64 animate-pulse rounded-[34px] bg-white/10" />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-52 animate-pulse rounded-[30px] bg-white/10"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // =====================================================
  // GLASS COLORS
  // =====================================================

  const glass = darkMode
    ? "border-white/15 bg-black/[0.30] text-white"
    : "border-black/10 bg-white/[0.55] text-black";

  const glassSoft = darkMode
    ? "border-white/10 bg-white/[0.07]"
    : "border-black/10 bg-white/[0.45]";

  const muted = darkMode ? "text-white/50" : "text-black/50";

  return (
    <main
      className={`relative min-h-screen overflow-hidden transition-colors duration-700 ${
        darkMode ? "bg-slate-950 text-white" : "bg-white text-black"
      }`}
    >
      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div
        className="fixed inset-0 bg-cover bg-center transition-all duration-1000"
        style={{
          backgroundImage: `url("${background}")`,
        }}
      />

      {/* TIME-DRIVEN SKY COLOR */}
      <div
        className="pointer-events-none fixed inset-0 transition-[background] duration-1000 ease-linear"
        style={{
          background: sky.css,
          opacity: darkMode
 ? 0.85
 : 0.90,
          mixBlendMode: "normal",
        }}
      />

      <div
        className={`fixed inset-0 transition-all duration-1000 ${
          !darkMode
            ? "bg-white/65"
            : night
              ? "bg-slate-950/25"
              : weatherType === "rain"
                ? "bg-slate-900/60"
                : weatherType === "storm"
                  ? "bg-slate-950/75"
                  : "bg-slate-900/45"
        }`}
      />

      {/* =================================================
          NIGHT
      ================================================= */}

      {night && darkMode && (
        <>
          <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950/10 to-black/20" />

          <SunMoonIcon />

          <div className="pointer-events-none fixed inset-0">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
              <span
                key={star}
                className="absolute h-1 w-1 animate-pulse rounded-full bg-white"
                style={{
                  left: `${8 + star * 8}%`,
                  top: `${7 + (star % 5) * 12}%`,
                  animationDelay: `${star * 300}ms`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* =================================================
          CLOUDS
      ================================================= */}

      {["cloudy", "rain", "storm"].includes(weatherType) && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <Cloud
            className={`absolute -left-40 top-[12%] animate-[cloudMove_38s_linear_infinite] ${
              darkMode ? "text-white/20" : "text-black/10"
            }`}
            size={180}
          />

          <Cloud
            className={`absolute -left-52 top-[32%] animate-[cloudMove_55s_linear_infinite] ${
              darkMode ? "text-white/15" : "text-black/10"
            }`}
            size={250}
          />

          <Cloud
            className={`absolute -right-52 top-[8%] animate-[cloudMoveReverse_46s_linear_infinite] ${
              darkMode ? "text-white/15" : "text-black/10"
            }`}
            size={210}
          />
        </div>
      )}

      {/* =================================================
          RAIN
      ================================================= */}

      {rainEffectsEnabled && ["rain", "storm"].includes(weatherType) && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-45">
          {Array.from({
            length: 90,
          }).map((_, index) => (
            <span
              key={index}
              className={`absolute top-[-30px] h-20 w-px rotate-[15deg] animate-[rainFall_800ms_linear_infinite] ${
                darkMode ? "bg-white/60" : "bg-black/20"
              }`}
              style={{
                left: `${(index * 19) % 100}%`,
                animationDelay: `${(index * 43) % 1000}ms`,
              }}
            />
          ))}
        </div>
      )}


      {snowEffectsEnabled && weatherType === "snow" && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-70">
          {Array.from({ length: 55 }).map((_, index) => (
            <span
              key={index}
              className="absolute -top-4 animate-[snowFall_7s_linear_infinite] text-white/80"
              style={{
                left: `${(index * 37) % 100}%`,
                animationDelay: `${(index * 173) % 7000}ms`,
                fontSize: `${8 + (index % 5) * 2}px`,
              }}
            >
              •
            </span>
          ))}
        </div>
      )}

      {/* =================================================
          CONTENT
      ================================================= */}

      <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6">
        {/* =================================================
            NAVBAR
        ================================================= */}

        <header
          className={`mb-5 flex flex-col gap-4 rounded-[28px] border p-4 shadow-2xl backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between ${glass}`}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowProfileSettings(true)}
              className={`group relative h-12 w-12 overflow-hidden rounded-2xl border ${
                darkMode
                  ? "border-white/20 bg-white/10"
                  : "border-black/10 bg-black/5"
              }`}
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
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

              <p className={`max-w-[220px] truncate text-xs ${muted}`}>
                {email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* DIGITAL CLOCK */}
            <div
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 backdrop-blur-xl ${
                darkMode
                  ? "border-white/15 bg-white/5"
                  : "border-black/10 bg-black/5"
              }`}
            >
              <Clock3
                size={17}
                className={darkMode ? "text-cyan-200" : "text-cyan-600"}
              />

              <div className="leading-none">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {clockTime}
                  </span>
                  <span className={`text-[10px] font-semibold ${muted}`}>
                    {formatGmtOffset(gmtOffset)}
                  </span>
                </div>
                <p className={`mt-1 text-[9px] ${muted}`}>{clockDate}</p>
              </div>

              <Settings2
                size={14}
                className={darkMode ? "text-white/35" : "text-black/35"}
              />

              <select
                aria-label="GMT setting"
                value={gmtOffset}
                onChange={(e) => {
                  const nextGmt = Number(e.target.value);

                  setGmtOffset(nextGmt);

                  localStorage.setItem(
                    "smart-home-gmt-offset",
                    String(nextGmt),
                  );
                }}
                className={`h-8 min-w-[82px] cursor-pointer appearance-none rounded-xl border px-2 text-[10px] font-semibold outline-none transition-all ${
                  darkMode
                    ? "border-white/15 bg-slate-900/90 text-white shadow-inner shadow-white/5 hover:bg-slate-800/90 focus:border-cyan-300/40"
                    : "border-black/10 bg-white/80 text-black shadow-inner hover:bg-white focus:border-cyan-600/30"
                }`}
              >
                {GMT_OFFSETS.map((offset) => (
                  <option
                    key={offset}
                    value={offset}
                    className={
                      darkMode
                        ? "bg-slate-900 text-white"
                        : "bg-white text-black"
                    }
                  >
                    {formatGmtOffset(offset)}
                  </option>
                ))}
              </select>
            </div>

            {/* BACKGROUND */}

            <button
              type="button"
              onClick={() => setShowBackgroundSettings(true)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold backdrop-blur-xl transition ${
                darkMode
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/10 text-black hover:bg-black/15"
              }`}
            >
              <ImageIcon size={16} />

              <span className="hidden sm:inline">Background</span>
            </button>

            {/* LOGOUT */}

            <button
              type="button"
              onClick={logout}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold backdrop-blur-xl transition ${
                darkMode
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/10 text-black hover:bg-black/15"
              }`}
            >
              <LogOut size={16} />

              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* =================================================
            WEATHER + CONNECTED HOMES
        ================================================= */}

        <section className="mb-7 grid gap-5 lg:grid-cols-3">
          {/* WEATHER */}

          <div
            className={`rounded-[34px] border p-5 shadow-2xl backdrop-blur-2xl lg:col-span-2 ${glass}`}
          >
            <div className={`rounded-[26px] border p-5 ${glassSoft}`}>
              <div className="flex items-center justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${muted} ${
                        darkMode
                          ? "border-white/10 bg-white/5"
                          : "border-black/10 bg-black/5"
                      }`}
                    >
                      Current weather
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigateWithTransition(() => router.push("/weather"))
                      }
                      title="Open weather details"
                      className={`inline-flex h-8 items-center justify-center gap-1 rounded-xl border px-3 text-[10px] font-semibold transition ${
                        darkMode
                          ? "border-white/10 bg-white/5 hover:bg-white/10"
                          : "border-black/10 bg-white/40 hover:bg-white/70"
                      }`}
                    >
                      <Settings2 size={13} />
                      Details
                    </button>

                    <button
                      type="button"
                      onClick={() => loadWeather(weatherLocation)}
                      disabled={weatherLoading}
                      title="Refresh weather"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-50 ${
                        darkMode
                          ? "border-white/10 bg-white/5 hover:bg-white/10"
                          : "border-black/10 bg-white/40 hover:bg-white/70"
                      }`}
                    >
                      <RefreshCw
                        size={13}
                        className={weatherLoading ? "animate-spin" : ""}
                      />
                    </button>
                  </div>

                  {weatherLoading ? (
                    <div className="mt-4 flex items-center gap-2">
                      <Loader2 size={20} className="animate-spin" />
                      <span className={muted}>Loading weather...</span>
                    </div>
                  ) : weather ? (
                    <>
                      <div className="mt-4">
                        <span className="text-6xl font-semibold tracking-tight sm:text-7xl">
                          {Math.round(displayTemperature)}°{temperatureUnit}
                        </span>
                      </div>

                      <p className={`mt-2 text-sm ${muted}`}>
                        {getWeatherInfo(weather.weatherCode).label}
                      </p>

                      <div
                        className={`mt-2 flex items-center gap-1 text-xs ${muted}`}
                      >
                        <MapPin size={12} />
                        {weather.city}
                        {weather.country ? `, ${weather.country}` : ""}
                      </div>
                    </>
                  ) : (
                    <p className={`mt-4 text-sm ${muted}`}>
                      Weather unavailable
                    </p>
                  )}
                </div>

                {weather && (
                  <div
                    className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-[30px] border shadow-xl backdrop-blur-xl sm:h-36 sm:w-36 ${
                      darkMode
                        ? "border-white/10 bg-white/[0.06]"
                        : "border-black/10 bg-white/50"
                    } ${
                      weatherType === "clear"
                        ? weather.isDay
                          ? "text-amber-300"
                          : "text-indigo-200"
                        : weatherType === "rain"
                          ? "text-sky-300"
                          : weatherType === "storm"
                            ? "text-violet-300"
                            : weatherType === "snow"
                              ? "text-cyan-100"
                              : "text-sky-200"
                    }`}
                  >
                    <WeatherIcon
                      code={weather.weatherCode}
                      size={82}
                      isDay={weather.isDay}
                    />
                  </div>
                )}
              </div>
            </div>

            {weather && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {/* B1 — FEELS LIKE + WIND + AQI */}
                <div className={`rounded-[22px] border p-4 ${glassSoft}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CloudSun
                          size={17}
                          className={darkMode ? "text-cyan-200" : "text-cyan-600"}
                        />
                        <span className={`text-[11px] ${muted}`}>Feels Like</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {formatMetric(displayFeelsLike, 1)}°{temperatureUnit}
                      </span>
                    </div>

                    <div
                      className={`h-px ${
                        darkMode ? "bg-white/10" : "bg-black/10"
                      }`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Wind
                          size={17}
                          className={darkMode ? "text-cyan-200" : "text-cyan-600"}
                        />
                        <span className={`text-[11px] ${muted}`}>Wind</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {formatMetric(displayWindSpeed, 1)}{" "}
                        <span className={`text-[10px] font-normal ${muted}`}>
                          {windUnit === "knots" ? "kt" : windUnit}
                        </span>
                      </span>
                    </div>

                    <div
                      className={`h-px ${
                        darkMode ? "bg-white/10" : "bg-black/10"
                      }`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BarChart3
                          size={17}
                          className={darkMode ? "text-cyan-200" : "text-cyan-600"}
                        />
                        <span className={`text-[11px] ${muted}`}>AQI</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {weather.aqi == null ? "—" : Math.round(weather.aqi)}
                        <span className={`ml-1 text-[10px] font-normal ${muted}`}>
                          {aqiLabel(weather.aqi)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* B2 — HUMIDITY + HI/LOW + RAIN/SNOW */}
                <div className={`rounded-[22px] border p-4 ${glassSoft}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Droplets
                          size={17}
                          className={darkMode ? "text-cyan-200" : "text-cyan-600"}
                        />
                        <span className={`text-[11px] ${muted}`}>Humidity</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {Math.round(weather.humidity)}%
                      </span>
                    </div>

                    <div
                      className={`h-px ${
                        darkMode ? "bg-white/10" : "bg-black/10"
                      }`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sun
                          size={17}
                          className={darkMode ? "text-amber-200" : "text-amber-600"}
                        />
                        <span className={`text-[11px] ${muted}`}>High / Low</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {Math.round(displayHighTemperature)}°
                        <span className={`mx-1 ${muted}`}>/</span>
                        {Math.round(displayLowTemperature)}°
                      </span>
                    </div>

                    <div
                      className={`h-px ${
                        darkMode ? "bg-white/10" : "bg-black/10"
                      }`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {weatherType === "snow" ? (
                          <CloudSnow
                            size={17}
                            className={darkMode ? "text-cyan-200" : "text-cyan-600"}
                          />
                        ) : (
                          <CloudRain
                            size={17}
                            className={darkMode ? "text-cyan-200" : "text-cyan-600"}
                          />
                        )}

                        <span className={`text-[11px] ${muted}`}>Rain / Snow</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {weatherType === "snow"
                          ? `${formatMetric(displaySnowDepth, 1)} ${snowUnit}`
                          : `${formatMetric(displayRainfall, 1)} ${precipitationUnit}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* B3 — DAY DURATION + SUNRISE + SUNSET */}
                <div className={`rounded-[22px] border p-4 ${glassSoft}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {weather.isDay ? (
                          <Sun
                            size={17}
                            className={darkMode ? "text-amber-200" : "text-amber-600"}
                          />
                        ) : (
                          <MoonStar
                            size={17}
                            className={darkMode ? "text-indigo-200" : "text-indigo-600"}
                          />
                        )}

                        <span className={`text-[11px] ${muted}`}>Day Duration</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {getDayDuration(weather.sunrise, weather.sunset)}
                      </span>
                    </div>

                    <div
                      className={`h-px ${
                        darkMode ? "bg-white/10" : "bg-black/10"
                      }`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sun
                          size={17}
                          className={darkMode ? "text-yellow-200" : "text-yellow-600"}
                        />
                        <span className={`text-[11px] ${muted}`}>Sunrise</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {formatShortWeatherTime(weather.sunrise)}
                      </span>
                    </div>

                    <div
                      className={`h-px ${
                        darkMode ? "bg-white/10" : "bg-black/10"
                      }`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <MoonStar
                          size={17}
                          className={darkMode ? "text-orange-200" : "text-orange-600"}
                        />
                        <span className={`text-[11px] ${muted}`}>Sunset</span>
                      </div>

                      <span className="text-sm font-semibold">
                        {formatShortWeatherTime(weather.sunset)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CONNECTED HOMES */}

          <div
            className={`rounded-[34px] border p-6 shadow-2xl backdrop-blur-2xl ${glass}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs uppercase tracking-[0.18em] ${muted}`}>
                  Smart Home
                </p>

                <h2 className="mt-1 text-xl font-semibold">Connected Homes</h2>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                  darkMode
                    ? "border-white/10 bg-white/10"
                    : "border-black/10 bg-black/5"
                }`}
              >
                <Home size={21} />
              </div>
            </div>

            <div className="mt-8">
              <p className="text-5xl font-semibold">{houses.length}</p>

              <p className={`mt-2 text-sm ${muted}`}>
                {houses.length === 1 ? "home connected" : "homes connected"}
              </p>
            </div>

            <div
              className={`mt-8 flex items-center justify-between border-t pt-4 ${
                darkMode ? "border-white/10" : "border-black/10"
              }`}
            >
              <span className={`text-xs ${muted}`}>Connected</span>

              <span className="flex items-center gap-2 text-xs font-semibold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                Online
              </span>
            </div>
          </div>
        </section>

        {/* =================================================
            WELCOME
        ================================================= */}

        <section
          className={`relative mb-7 overflow-hidden rounded-[34px] border p-6 shadow-2xl backdrop-blur-2xl sm:p-8 ${glass}`}
        >
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back
            </h1>

            <p className={`mt-2 max-w-xl text-sm leading-6 ${muted}`}>
              Manage your homes, rooms and connected devices from one place.
            </p>
          </div>
        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm backdrop-blur-xl ${
              darkMode
                ? "border-red-300/20 bg-red-500/15 text-white"
                : "border-red-500/20 bg-red-500/10 text-red-900"
            }`}
          >
            <AlertCircle size={18} />

            <p>{error}</p>
          </div>
        )}

        {/* =================================================
            ENERGY
        ================================================= */}

        <section className="mb-7 grid gap-5 lg:grid-cols-3">
          <div
            className={`rounded-[30px] border p-6 shadow-xl backdrop-blur-2xl lg:col-span-2 ${glass}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs uppercase tracking-[0.18em] ${muted}`}>
                  Live energy
                </p>

                <h2 className="mt-1 text-xl font-semibold">Current Load</h2>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                  darkMode
                    ? "border-white/10 bg-white/10 text-yellow-200"
                    : "border-black/10 bg-black/5 text-yellow-600"
                }`}
              >
                <Zap size={21} />
              </div>
            </div>

            {roomLoads.length === 0 ? (
              <div
                className={`mt-6 rounded-2xl border p-5 text-sm ${glassSoft} ${muted}`}
              >
                Waiting for device energy sensors...
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {roomLoads.map((room) => (
                  <div
                    key={room.room}
                    className={`flex items-center justify-between rounded-2xl border p-4 ${glassSoft}`}
                  >
                    <div>
                      <p className="font-medium">{room.room}</p>

                      <p className={`mt-1 text-xs ${muted}`}>Current load</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-semibold">
                        {Math.round(room.watts)}W
                      </p>

                      <div className="mt-1 flex items-center justify-end gap-1 text-xs text-green-500 dark:text-green-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        Live
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigateWithTransition(() => router.push("/energy"))}
            className={`group rounded-[30px] border p-6 text-left shadow-xl backdrop-blur-2xl transition hover:-translate-y-1 ${glass}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs uppercase tracking-[0.18em] ${muted}`}>
                  Energy
                </p>

                <h2 className="mt-1 text-xl font-semibold">This Month</h2>
              </div>

              <BarChart3
                size={22}
                className={darkMode ? "text-cyan-200" : "text-cyan-600"}
              />
            </div>

            <p className="mt-7 text-4xl font-semibold">
              {thisMonthKwh.toFixed(1)}

              <span className={`ml-1 text-lg ${muted}`}>kWh</span>
            </p>

            <div className="mt-5 flex items-center justify-between">
              <div
                className={`flex items-center gap-1 text-sm ${
                  energyChange > 0
                    ? "text-red-500 dark:text-red-300"
                    : "text-green-500 dark:text-green-300"
                }`}
              >
                {energyChange > 0 ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                {Math.abs(energyChange).toFixed(1)}%
              </div>

              <span className={`text-xs ${muted}`}>vs last month</span>
            </div>

            <div
              className={`mt-6 border-t pt-4 text-xs ${muted} ${
                darkMode ? "border-white/10" : "border-black/10"
              }`}
            >
              Open detailed energy analytics →
            </div>
          </button>
        </section>

        {/* =================================================
            HOUSE HEADER
        ================================================= */}

        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Your Houses</h2>

            <p className={`mt-1 text-sm ${muted}`}>Manage your smart homes</p>
          </div>

          <button
            type="button"
            onClick={openCreateHouse}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-lg backdrop-blur-xl transition ${
              darkMode
                ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                : "border-black/10 bg-white/50 text-black hover:bg-white/70"
            }`}
          >
            <Plus size={18} />

            <span className="hidden sm:inline">Create House</span>
          </button>
        </div>

        {/* =================================================
            HOUSES
        ================================================= */}

        {houses.length === 0 ? (
          <div
            className={`rounded-[32px] border p-12 text-center shadow-2xl backdrop-blur-2xl ${glass}`}
          >
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${
                darkMode
                  ? "border-white/15 bg-white/10"
                  : "border-black/10 bg-black/5"
              }`}
            >
              <Home size={30} />
            </div>

            <h3 className="mt-5 text-lg font-semibold">No houses yet</h3>

            <p className={`mx-auto mt-2 max-w-sm text-sm leading-6 ${muted}`}>
              Create your first house to start adding rooms and ESP devices.
            </p>

            <button
              type="button"
              onClick={openCreateHouse}
              className={`mx-auto mt-6 flex items-center justify-center gap-2 rounded-2xl border px-6 py-3 font-semibold backdrop-blur-xl ${
                darkMode
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-white/50 text-black hover:bg-white/70"
              }`}
            >
              <Plus size={18} />
              Create Your First House
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {houses.map((house) => (
              <button
                type="button"
                key={house.id}
                onClick={() =>
                  navigateWithTransition(() =>
                    router.push(`/house/${house.id}`),
                  )
                }
                className={`group w-full rounded-[30px] border p-6 text-left shadow-xl backdrop-blur-2xl transition duration-300 hover:-translate-y-1 ${glass}`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition group-hover:scale-105 ${
                      darkMode
                        ? "border-white/15 bg-white/10"
                        : "border-black/10 bg-black/5"
                    }`}
                  >
                    <Home size={27} />
                  </div>

                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                      darkMode
                        ? "border-white/10 bg-white/5 text-white/50 group-hover:bg-white/15 group-hover:text-white"
                        : "border-black/10 bg-black/5 text-black/40 group-hover:bg-black/10 group-hover:text-black"
                    }`}
                  >
                    <ArrowUpRight size={19} />
                  </div>
                </div>

                <div className="mt-7">
                  <h3 className="text-xl font-semibold">{house.name}</h3>

                  <p className={`mt-1 text-sm ${muted}`}>Smart home</p>
                </div>

                <div
                  className={`mt-6 flex items-center justify-between border-t pt-4 ${
                    darkMode ? "border-white/10" : "border-black/10"
                  }`}
                >
                  <span className={`text-xs font-medium ${muted}`}>House</span>

                  <span className="text-xs font-medium opacity-70">
                    Open house →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* =================================================
          PROFILE MODAL
      ================================================= */}

      {showProfileSettings && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowProfileSettings(false);
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-[32px] border p-7 shadow-2xl backdrop-blur-2xl ${
              darkMode
                ? "border-white/20 bg-slate-900/90 text-white"
                : "border-black/10 bg-white/90 text-black"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                    darkMode
                      ? "border-white/10 bg-white/10"
                      : "border-black/10 bg-black/5"
                  }`}
                >
                  <User size={23} />
                </div>

                <h2 className="mt-4 text-2xl font-semibold">Profile Picture</h2>

                <p
                  className={`mt-1 text-sm ${
                    darkMode ? "text-white/45" : "text-black/45"
                  }`}
                >
                  Upload your profile picture.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowProfileSettings(false)}
                className={`rounded-xl p-2 ${
                  darkMode
                    ? "text-white/40 hover:bg-white/10 hover:text-white"
                    : "text-black/40 hover:bg-black/5 hover:text-black"
                }`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-7 flex justify-center">
              <div
                className={`h-32 w-32 overflow-hidden rounded-[35px] border ${
                  darkMode
                    ? "border-white/10 bg-white/10"
                    : "border-black/10 bg-black/5"
                }`}
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center ${
                      darkMode ? "text-white/30" : "text-black/30"
                    }`}
                  >
                    <User size={45} />
                  </div>
                )}
              </div>
            </div>

            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) {
                  uploadProfile(file);
                }
              }}
            />

            <button
              type="button"
              disabled={uploadingProfile}
              onClick={() => profileInputRef.current?.click()}
              className={`mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-semibold disabled:opacity-50 ${
                darkMode
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/5 text-black hover:bg-black/10"
              }`}
            >
              {uploadingProfile ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera size={18} />
                  Upload Profile Picture
                </>
              )}
            </button>

            <p
              className={`mt-5 text-center text-xs ${
                darkMode ? "text-white/30" : "text-black/30"
              }`}
            >
              Maximum 5MB.
              <br />
              New picture replaces the previous one.
            </p>
          </div>
        </div>
      )}

      {/* =================================================
          BACKGROUND MODAL
      ================================================= */}

      {showBackgroundSettings && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowBackgroundSettings(false);
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-[32px] border p-7 shadow-2xl backdrop-blur-2xl ${
              darkMode
                ? "border-white/20 bg-slate-900/90 text-white"
                : "border-black/10 bg-white/90 text-black"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                    darkMode
                      ? "border-white/10 bg-white/10"
                      : "border-black/10 bg-black/5"
                  }`}
                >
                  <ImageIcon size={24} />
                </div>

                <h2 className="mt-4 text-2xl font-semibold">
                  Dashboard Background
                </h2>

                <p
                  className={`mt-1 text-sm leading-6 ${
                    darkMode ? "text-white/50" : "text-black/50"
                  }`}
                >
                  Your image automatically expires after 30 days.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBackgroundSettings(false)}
                className={`rounded-xl p-2 ${
                  darkMode
                    ? "text-white/40 hover:bg-white/10 hover:text-white"
                    : "text-black/40 hover:bg-black/5 hover:text-black"
                }`}
              >
                <X size={20} />
              </button>
            </div>

            <div
              className="mt-6 h-40 rounded-3xl bg-cover bg-center"
              style={{
                backgroundImage: `url("${background}")`,
              }}
            />

            {backgroundUploadedAt && (
              <p
                className={`mt-3 text-xs ${
                  darkMode ? "text-white/40" : "text-black/40"
                }`}
              >
                Uploaded {new Date(backgroundUploadedAt).toLocaleDateString()}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) {
                  uploadBackground(file);
                }
              }}
            />

            <button
              type="button"
              disabled={uploadingBackground}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-semibold disabled:opacity-50 ${
                darkMode
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/5 text-black hover:bg-black/10"
              }`}
            >
              {uploadingBackground ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload New Image
                </>
              )}
            </button>

            {backgroundUploadedAt && (
              <button
                type="button"
                onClick={removeBackground}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 py-4 font-semibold text-red-700 hover:bg-red-500/20 dark:text-red-100"
              >
                <Trash2 size={18} />
                Remove My Image
              </button>
            )}

            <p
              className={`mt-5 text-center text-xs ${
                darkMode ? "text-white/30" : "text-black/30"
              }`}
            >
              Maximum 8MB · JPG, PNG or WebP
              <br />
              New uploads replace your existing image.
            </p>
          </div>
        </div>
      )}

      {/* =================================================
          CREATE HOUSE MODAL
      ================================================= */}

      {showCreateHouse && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeCreateHouse();
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-[32px] border p-7 shadow-2xl backdrop-blur-2xl ${
              darkMode
                ? "border-white/20 bg-slate-900/90 text-white"
                : "border-black/10 bg-white/90 text-black"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                    darkMode
                      ? "border-white/10 bg-white/10"
                      : "border-black/10 bg-black/5"
                  }`}
                >
                  <Home size={24} />
                </div>

                <h2 className="mt-4 text-2xl font-semibold">Create House</h2>

                <p
                  className={`mt-1 text-sm ${
                    darkMode ? "text-white/45" : "text-black/45"
                  }`}
                >
                  Give your smart home a name.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateHouse}
                disabled={creating}
                className={`rounded-xl p-2 ${
                  darkMode
                    ? "text-white/40 hover:bg-white/10 hover:text-white"
                    : "text-black/40 hover:bg-black/5 hover:text-black"
                }`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6">
              <label
                className={`mb-2 block text-sm font-medium ${
                  darkMode ? "text-white/60" : "text-black/60"
                }`}
              >
                House Name
              </label>

              <input
                type="text"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createHouse();
                  }
                }}
                placeholder="e.g. My Home"
                autoFocus
                disabled={creating}
                className={`w-full rounded-2xl border px-4 py-4 outline-none ${
                  darkMode
                    ? "border-white/10 bg-white/10 text-white placeholder:text-white/25 focus:border-white/20 focus:bg-white/15"
                    : "border-black/10 bg-black/5 text-black placeholder:text-black/25 focus:border-black/20 focus:bg-black/10"
                }`}
              />
            </div>

            <button
              type="button"
              onClick={createHouse}
              disabled={creating || !houseName.trim()}
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-semibold disabled:opacity-40 ${
                darkMode
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/5 text-black hover:bg-black/10"
              }`}
            >
              {creating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Create House
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          ANIMATION
      ================================================= */}

      <style jsx global>{`
        @keyframes cloudMove {
          0% {
            transform: translateX(-25vw);
          }

          100% {
            transform: translateX(125vw);
          }
        }

        @keyframes cloudMoveReverse {
          0% {
            transform: translateX(125vw);
          }

          100% {
            transform: translateX(-30vw);
          }
        }

        @keyframes rainFall {
          0% {
            transform: translateY(-30px) rotate(15deg);
          }

          100% {
            transform: translateY(115vh) rotate(15deg);
          }
        }

        @keyframes snowFall {
          0% {
            transform: translateY(-20px) translateX(0);
          }

          50% {
            transform: translateY(55vh) translateX(18px);
          }

          100% {
            transform: translateY(115vh) translateX(-12px);
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: string;
}) {
  return (
    <div>
      <p className={`text-[11px] ${muted}`}>{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function SettingSelect({
  label,
  value,
  onChange,
  options,
  darkMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  darkMode: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${
          darkMode
            ? "border-white/10 bg-slate-900 text-white"
            : "border-black/10 bg-white text-black"
        }`}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

// =======================================================
// NIGHT MOON
// =======================================================

function SunMoonIcon() {
  return (
    <MoonStar
      className="pointer-events-none fixed right-[12%] top-[12%] text-white/80"
      size={105}
    />
  );
}

// =======================================================
// CLOUD
// =======================================================

function Cloud({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.5 19H7a5 5 0 1 1 1.1-9.88A6.5 6.5 0 0 1 20 11.5a4 4 0 0 1-2.5 7.5Z" />
    </svg>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { navigateWithTransition } from "@/lib/viewTransition";
import { supabase } from "@/lib/supabase";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { BackgroundSettingsModal } from "@/components/layout/BackgroundSettingsModal";

import {
  Home,
  Plus,
  Loader2,
  X,
  AlertCircle,
  ArrowUpRight,
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
  RefreshCw,
  Thermometer,
  Gauge,
  Eye,
  Compass,
  Umbrella,
  Cloud as CloudIcon,
  Search,
  Wind as WindIcon,
  Globe2,
  Settings2,
} from "lucide-react";

type House = {
  id: string;
  name: string;
  created_at: string;
};

type WeatherData = {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  dewPoint: number;
  precipitation: number;
  rainfall: number;
  snowfall: number;
  snowDepth: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  pressure: number;
  visibility: number;
  cloudCover: number;
  isDay: boolean;
  sunrise: string;
  sunset: string;
  high: number;
  low: number;
  uvIndex: number;
  moonrise: string;
  moonset: string;
  moonPhase: number;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  utcOffsetSeconds: number;
  aqi?: number;
};

type AirQualityData = {
  usAqi: number;
  pm25: number;
  pm10: number;
  ozone: number;
  nitrogenDioxide: number;
  carbonMonoxide: number;
  sulphurDioxide: number;
};

type CityResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
};

type RoomLoad = {
  room: string;
  watts: number;
};

type TemperatureUnit = "C" | "F";
type WindUnit = "km/h" | "mph" | "m/s" | "knots";
type PrecipitationUnit = "mm" | "in";
type PressureUnit = "hPa" | "mb" | "inHg";
type VisibilityUnit = "km" | "mi";
type SnowDepthUnit = "cm" | "in";

function convertTemperature(value: number, unit: TemperatureUnit) {
  return unit === "F" ? (value * 9) / 5 + 32 : value;
}

function convertWindSpeed(value: number, unit: WindUnit) {
  switch (unit) {
    case "mph":
      return value * 0.621371;
    case "m/s":
      return value / 3.6;
    case "knots":
      return value * 0.539957;
    default:
      return value;
  }
}

function convertPrecipitation(value: number, unit: PrecipitationUnit) {
  return unit === "in" ? value / 25.4 : value;
}

function convertPressure(value: number, unit: PressureUnit) {
  if (unit === "inHg") return value * 0.0295299831;
  return value;
}

function convertVisibility(valueMeters: number, unit: VisibilityUnit) {
  return unit === "mi" ? valueMeters / 1609.344 : valueMeters / 1000;
}

function convertSnowDepth(valueCm: number, unit: SnowDepthUnit) {
  return unit === "in" ? valueCm / 2.54 : valueCm;
}

function getWindDirection(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function formatTime(value: string, use24Hour = false) {
  if (!value) return "—";
  const timePart = value.includes("T") ? value.split("T")[1] : value;
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (use24Hour) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatGmtSeconds(offsetSeconds: number) {
  const sign = offsetSeconds >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetSeconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  return `GMT${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatMetric(value: number, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatShortWeatherTime(value: string) {
  return formatTime(value, false);
}

function getDayDuration(sunrise: string, sunset: string) {
  const start = new Date(sunrise).getTime();
  const end = new Date(sunset).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  let minutes = Math.round((end - start) / 60000);
  if (minutes < 0) minutes += 24 * 60;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getAqiLabel(aqi: number) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

function getMoonPhaseLabel(phase: number) {
  if (phase < 0.03 || phase >= 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
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

function WeatherIcon({ code, size = 42 }: { code: number; size?: number }) {
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
    return <Sun size={size} />;
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

function WeatherMetric({
  icon,
  label,
  value,
  muted,
  compact = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  muted: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${compact ? "min-w-[82px]" : "min-h-[88px]"}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="opacity-70">{icon}</span>}
        <p className={`truncate text-[10px] ${muted}`}>{label}</p>
      </div>
      <p className={`${compact ? "mt-1 text-xs" : "mt-3 text-sm"} font-semibold`}>{value}</p>
    </div>
  );
}

function getMinutesFromLocalTime(value: string) {
  const timePart = value.includes("T") ? value.split("T")[1] : value;
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getSunriseAwareSky(now: Date, weather: WeatherData | null, timezone: string) {
  if (!weather) return { css: "linear-gradient(180deg, #020617 0%, #020617 100%)", isNight: true };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(now);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "00";
  const current = Number(get("hour")) * 60 + Number(get("minute"));
  const sunrise = getMinutesFromLocalTime(weather.sunrise);
  const sunset = getMinutesFromLocalTime(weather.sunset);
  if (sunrise === null || sunset === null) return { css: "linear-gradient(180deg, #020617 0%, #020617 100%)", isNight: true };
  if (current < sunrise - 45 || current > sunset + 60) return { css: "linear-gradient(180deg, #020617 0%, #020617 100%)", isNight: true };
  if (current < sunrise) {
    const t = Math.max(0, Math.min(1, (current - sunrise + 45) / 45));
    const top = interpolateHex("#020617", "#312E81", t);
    const bottom = interpolateHex("#020617", "#FF7A45", t);
    return { css: `linear-gradient(180deg, ${top} 0%, ${interpolateHex(top,bottom,.45)} 45%, ${bottom} 100%)`, isNight: false };
  }
  if (current <= sunset) {
    const t = Math.max(0, Math.min(1, (current - sunrise) / Math.max(1, sunset - sunrise)));
    const top = t < .82 ? interpolateHex("#87CEFA", "#FFD27F", t/.82) : interpolateHex("#FFD27F", "#FF7043", (t-.82)/.18);
    const bottom = t < .65 ? interpolateHex("#BDEBFF", "#FFD27F", t/.65) : interpolateHex("#FFD27F", "#FF8A65", (t-.65)/.35);
    return { css: `linear-gradient(180deg, ${top} 0%, ${interpolateHex(top,bottom,.45)} 45%, ${bottom} 100%)`, isNight: false };
  }
  const t = Math.max(0, Math.min(1, (current - sunset) / 60));
  const top = interpolateHex("#FF7043", "#020617", t);
  const bottom = interpolateHex("#FF8A65", "#020617", t);
  return { css: `linear-gradient(180deg, ${top} 0%, ${interpolateHex(top,bottom,.45)} 45%, ${bottom} 100%)`, isNight: false };
}

export default function DashboardPage() {
  const router = useRouter();

  const profileInputRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState("");
  const [houses, setHouses] = useState<House[]>([]);

  const [showCreateHouse, setShowCreateHouse] = useState(false);

  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);

  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const [houseName, setHouseName] = useState("");

  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);

  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [uploadingProfile, setUploadingProfile] = useState(false);

  const [weather, setWeather] = useState<WeatherData | null>(null);

  const [weatherLoading, setWeatherLoading] = useState(true);

  const [roomLoads, setRoomLoads] = useState<RoomLoad[]>([]);

  const [thisMonthKwh, setThisMonthKwh] = useState(0);

  const [lastMonthKwh, setLastMonthKwh] = useState(0);

  const [error, setError] = useState("");

  const [darkMode, setDarkMode] = useState(true);

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [location, setLocation] = useState<CityResult>({
    id: 1174872,
    name: "Karachi",
    latitude: 24.8607,
    longitude: 67.0011,
    country: "Pakistan",
    country_code: "PK",
    timezone: "Asia/Karachi",
  });
  const [showWeatherSettings, setShowWeatherSettings] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("C");
  const [windUnit, setWindUnit] = useState<WindUnit>("km/h");
  const [precipitationUnit, setPrecipitationUnit] = useState<PrecipitationUnit>("mm");
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>("hPa");
  const [visibilityUnit, setVisibilityUnit] = useState<VisibilityUnit>("km");
  const [snowDepthUnit, setSnowDepthUnit] = useState<SnowDepthUnit>("cm");
  const [time24Hour, setTime24Hour] = useState(false);

  // =====================================================
  // DIGITAL CLOCK + LOCATION TIMEZONE
  // =====================================================

  useEffect(() => {
    try {
      const savedLocation = localStorage.getItem("smart-home-weather-location");
      const savedTemp = localStorage.getItem("smart-home-temperature-unit");
      const savedWind = localStorage.getItem("smart-home-wind-unit");
      const savedPrecip = localStorage.getItem("smart-home-precipitation-unit");
      const savedPressure = localStorage.getItem("smart-home-pressure-unit");
      const savedVisibility = localStorage.getItem("smart-home-visibility-unit");
      const savedSnowDepth = localStorage.getItem("smart-home-snow-depth-unit");
      const savedClock = localStorage.getItem("smart-home-clock-24h");

      if (savedLocation) {
        const parsed = JSON.parse(savedLocation) as CityResult;
        if (parsed?.latitude && parsed?.longitude && parsed?.name) setLocation(parsed);
      }
      if (savedTemp === "C" || savedTemp === "F") setTemperatureUnit(savedTemp);
      if (["km/h", "mph", "m/s", "knots"].includes(savedWind ?? "")) setWindUnit(savedWind as WindUnit);
      if (savedPrecip === "mm" || savedPrecip === "in") setPrecipitationUnit(savedPrecip);
      if (["hPa", "mb", "inHg"].includes(savedPressure ?? "")) setPressureUnit(savedPressure as PressureUnit);
      if (savedVisibility === "km" || savedVisibility === "mi") setVisibilityUnit(savedVisibility);
      if (savedSnowDepth === "cm" || savedSnowDepth === "in") setSnowDepthUnit(savedSnowDepth);
      if (savedClock === "true") setTime24Hour(true);
    } catch {}

    const tick = () => setCurrentTime(new Date());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // =====================================================
  // AUTOMATIC DAY/NIGHT THEME
  // =====================================================

  useEffect(() => {
    const applyTheme = () => {
      const now = currentTime;
      const localHour = Number(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: location.timezone || "UTC",
        }).format(now),
      );
      const isDark = localHour < 6 || localHour >= 18;
      setDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.classList.toggle("light", !isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };

    applyTheme();
  }, [currentTime, location.timezone]);

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
  // WEATHER + AIR QUALITY
  // =====================================================

  async function loadWeather() {
    try {
      setWeatherLoading(true);

      const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "dew_point_2m",
          "apparent_temperature",
          "precipitation",
          "rain",
          "snowfall",
          "snow_depth",
          "weather_code",
          "cloud_cover",
          "pressure_msl",
          "visibility",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "is_day",
        ].join(","),
        daily: [
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_probability_max",
          "sunrise",
          "sunset",
          "uv_index_max",
          "moonrise",
          "moonset",
          "moon_phase",
        ].join(","),
        forecast_days: "1",
        timezone: "auto",
      });

      const aqParams = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: [
          "us_aqi",
          "pm2_5",
          "pm10",
          "ozone",
          "nitrogen_dioxide",
          "carbon_monoxide",
          "sulphur_dioxide",
        ].join(","),
        timezone: "auto",
      });

      const [response, aqResponse] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${aqParams.toString()}`),
      ]);

      if (!response.ok) throw new Error("Weather request failed");
      const data = await response.json();
      const aqData = aqResponse.ok ? await aqResponse.json() : null;

      const daily = data.daily ?? {};
      const current = data.current ?? {};
      const aqCurrent = aqData?.current ?? {};

      setWeather({
        temperature: Number(current.temperature_2m ?? 0),
        apparentTemperature: Number(current.apparent_temperature ?? 0),
        humidity: Number(current.relative_humidity_2m ?? 0),
        dewPoint: Number(current.dew_point_2m ?? 0),
        precipitation: Number(current.precipitation ?? 0),
        rainfall: Number(current.rain ?? 0),
        snowfall: Number(current.snowfall ?? 0),
        snowDepth: Number(current.snow_depth ?? 0),
        precipitationProbability: Number(daily.precipitation_probability_max?.[0] ?? 0),
        weatherCode: Number(current.weather_code ?? 0),
        windSpeed: Number(current.wind_speed_10m ?? 0),
        windDirection: Number(current.wind_direction_10m ?? 0),
        windGusts: Number(current.wind_gusts_10m ?? 0),
        pressure: Number(current.pressure_msl ?? 0),
        visibility: Number(current.visibility ?? 0),
        cloudCover: Number(current.cloud_cover ?? 0),
        isDay: Number(current.is_day ?? 0) === 1,
        sunrise: daily.sunrise?.[0] ?? "",
        sunset: daily.sunset?.[0] ?? "",
        high: Number(daily.temperature_2m_max?.[0] ?? 0),
        low: Number(daily.temperature_2m_min?.[0] ?? 0),
        uvIndex: Number(daily.uv_index_max?.[0] ?? 0),
        moonrise: daily.moonrise?.[0] ?? "",
        moonset: daily.moonset?.[0] ?? "",
        moonPhase: Number(daily.moon_phase?.[0] ?? 0),
        city: location.name,
        country: location.country ?? "",
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: data.timezone ?? location.timezone ?? "UTC",
        utcOffsetSeconds: Number(data.utc_offset_seconds ?? 0),
      });

      setAirQuality(
        aqData
          ? {
              usAqi: Number(aqCurrent.us_aqi ?? 0),
              pm25: Number(aqCurrent.pm2_5 ?? 0),
              pm10: Number(aqCurrent.pm10 ?? 0),
              ozone: Number(aqCurrent.ozone ?? 0),
              nitrogenDioxide: Number(aqCurrent.nitrogen_dioxide ?? 0),
              carbonMonoxide: Number(aqCurrent.carbon_monoxide ?? 0),
              sulphurDioxide: Number(aqCurrent.sulphur_dioxide ?? 0),
            }
          : null,
      );
    } catch (err) {
      console.error("Weather error:", err);
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    loadWeather();
    const interval = window.setInterval(loadWeather, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    if (!showWeatherSettings || citySearch.trim().length < 2) {
      setCityResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setCitySearching(true);
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(citySearch.trim())}&count=10&language=en&format=json`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data = await response.json();
        setCityResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error(err);
      } finally {
        setCitySearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [citySearch, showWeatherSettings]);

  function selectCity(city: CityResult) {
    setLocation(city);
    localStorage.setItem("smart-home-weather-location", JSON.stringify(city));
    window.dispatchEvent(new Event("smart-home-weather-location-changed"));
    setShowWeatherSettings(false);
    setCitySearch("");
    setCityResults([]);
  }

  function saveUnit<T extends string>(key: string, value: T) {
    localStorage.setItem(key, value);
  }

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

  const sunriseSky = getSunriseAwareSky(currentTime, weather, weather?.timezone || location.timezone || "UTC");

  const night = sunriseSky.isNight;

  const energyChange =
    lastMonthKwh > 0 ? ((thisMonthKwh - lastMonthKwh) / lastMonthKwh) * 100 : 0;

  const sky = sunriseSky;

  const displayTemperature = weather
    ? convertTemperature(weather.temperature, temperatureUnit)
    : 0;
  const displayFeelsLike = weather
    ? convertTemperature(weather.apparentTemperature, temperatureUnit)
    : 0;
  const displayHigh = weather
    ? convertTemperature(weather.high, temperatureUnit)
    : 0;
  const displayLow = weather
    ? convertTemperature(weather.low, temperatureUnit)
    : 0;
  const displayDewPoint = weather
    ? convertTemperature(weather.dewPoint, temperatureUnit)
    : 0;
  const displayWindSpeed = weather
    ? convertWindSpeed(weather.windSpeed, windUnit)
    : 0;
  const displayWindGusts = weather
    ? convertWindSpeed(weather.windGusts, windUnit)
    : 0;
  const displayPrecipitation = weather
    ? convertPrecipitation(weather.precipitation, precipitationUnit)
    : 0;
  const displayRainfall = weather
    ? convertPrecipitation(weather.rainfall, precipitationUnit)
    : 0;
  const displaySnowfall = weather
    ? convertPrecipitation(weather.snowfall, precipitationUnit)
    : 0;
  const displaySnowDepth = weather
    ? convertSnowDepth(weather.snowDepth, snowDepthUnit)
    : 0;
  const displayPressure = weather
    ? convertPressure(weather.pressure, pressureUnit)
    : 0;
  const displayVisibility = weather
    ? convertVisibility(weather.visibility, visibilityUnit)
    : 0;
  const clockTime = weather
    ? new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: !time24Hour,
        timeZone: weather.timezone || location.timezone || "UTC",
      }).format(currentTime)
    : "--:--:--";
  const clockDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: weather?.timezone || location.timezone || "UTC",
  }).format(currentTime);
  const gmtLabel = formatGmtSeconds(weather?.utcOffsetSeconds ?? 0);

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen p-5">
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
        darkMode ? "text-white" : "text-black"
      }`}
    >
      {/* =================================================
          CONTENT
      ================================================= */}

      <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6">
        {/* =================================================
            NAVBAR
        ================================================= */}

        <DashboardHeader
          email={email}
          profileImage={profileImage}
          clockTime={clockTime}
          clockDate={clockDate}
          gmtLabel={gmtLabel}
          locationName={location.name}
          onProfile={() => setShowProfileSettings(true)}
          onWeatherSettings={() => setShowWeatherSettings(true)}
          onBackground={() => setShowBackgroundSettings(true)}
          onLogout={logout}
        />

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
                      onClick={() => loadWeather()}
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
                        {airQuality?.usAqi == null ? "—" : Math.round(airQuality.usAqi)}
                        <span className={`ml-1 text-[10px] font-normal ${muted}`}>
                          {getAqiLabel(airQuality?.usAqi ?? 0)}
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
                        {Math.round(displayHigh)}°
                        <span className={`mx-1 ${muted}`}>/</span>
                        {Math.round(displayLow)}°
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
                          ? `${formatMetric(displaySnowDepth, 1)} ${snowDepthUnit}`
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
          WEATHER SETTINGS MODAL
      ================================================= */}

      {showWeatherSettings && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowWeatherSettings(false);
          }}
        >
          <div
            className={`w-full max-w-2xl rounded-[32px] border p-6 shadow-2xl backdrop-blur-2xl ${
              darkMode
                ? "border-white/20 bg-slate-900/95 text-white"
                : "border-black/10 bg-white/95 text-black"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                  <Globe2 size={23} />
                </div>
                <h2 className="mt-4 text-2xl font-semibold">Weather & Clock Settings</h2>
                <p className={`mt-1 text-sm ${muted}`}>Choose any city worldwide. The clock and automatic theme follow its local timezone.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowWeatherSettings(false)}
                className={`rounded-xl p-2 ${darkMode ? "text-white/40 hover:bg-white/10 hover:text-white" : "text-black/40 hover:bg-black/5 hover:text-black"}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className={`mt-6 rounded-2xl border p-3 ${glassSoft}`}>
              <div className="flex items-center gap-2">
                <Search size={17} className="opacity-60" />
                <input
                  autoFocus
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Search city, e.g. London, Bangkok, New York"
                  className={`w-full bg-transparent py-2 text-sm outline-none ${darkMode ? "placeholder:text-white/30" : "placeholder:text-black/30"}`}
                />
                {citySearching && <Loader2 size={17} className="animate-spin opacity-60" />}
              </div>
            </div>

            {cityResults.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border">
                {cityResults.map((city) => (
                  <button
                    key={`${city.id}-${city.latitude}-${city.longitude}`}
                    type="button"
                    onClick={() => selectCity(city)}
                    className={`flex w-full items-center justify-between gap-3 border-b p-3 text-left last:border-b-0 ${darkMode ? "border-white/10 hover:bg-white/10" : "border-black/10 hover:bg-black/5"}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{city.name}</p>
                      <p className={`truncate text-xs ${muted}`}>
                        {[city.admin1, city.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] ${muted}`}>{city.timezone ?? "UTC"}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className={`rounded-2xl border p-3 ${glassSoft}`}>
                <span className={`block text-[10px] uppercase tracking-[0.16em] ${muted}`}>Temperature</span>
                <select value={temperatureUnit} onChange={(e) => { const v = e.target.value as TemperatureUnit; setTemperatureUnit(v); saveUnit("smart-home-temperature-unit", v); }} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
                  <option value="C">Celsius (°C)</option>
                  <option value="F">Fahrenheit (°F)</option>
                </select>
              </label>

              <label className={`rounded-2xl border p-3 ${glassSoft}`}>
                <span className={`block text-[10px] uppercase tracking-[0.16em] ${muted}`}>Wind speed</span>
                <select value={windUnit} onChange={(e) => { const v = e.target.value as WindUnit; setWindUnit(v); saveUnit("smart-home-wind-unit", v); }} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
                  <option value="km/h">Kilometers per hour</option>
                  <option value="mph">Miles per hour</option>
                  <option value="m/s">Meters per second</option>
                  <option value="knots">Knots</option>
                </select>
              </label>

              <label className={`rounded-2xl border p-3 ${glassSoft}`}>
                <span className={`block text-[10px] uppercase tracking-[0.16em] ${muted}`}>Precipitation</span>
                <select value={precipitationUnit} onChange={(e) => { const v = e.target.value as PrecipitationUnit; setPrecipitationUnit(v); saveUnit("smart-home-precipitation-unit", v); }} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
                  <option value="mm">Millimeters (mm)</option>
                  <option value="in">Inches (in)</option>
                </select>
              </label>

              <label className={`rounded-2xl border p-3 ${glassSoft}`}>
                <span className={`block text-[10px] uppercase tracking-[0.16em] ${muted}`}>Pressure</span>
                <select value={pressureUnit} onChange={(e) => { const v = e.target.value as PressureUnit; setPressureUnit(v); saveUnit("smart-home-pressure-unit", v); }} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
                  <option value="hPa">Hectopascals (hPa)</option>
                  <option value="mb">Millibars (mb)</option>
                  <option value="inHg">Inches of mercury (inHg)</option>
                </select>
              </label>

              <label className={`rounded-2xl border p-3 ${glassSoft}`}>
                <span className={`block text-[10px] uppercase tracking-[0.16em] ${muted}`}>Visibility</span>
                <select value={visibilityUnit} onChange={(e) => { const v = e.target.value as VisibilityUnit; setVisibilityUnit(v); saveUnit("smart-home-visibility-unit", v); }} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
                  <option value="km">Kilometers (km)</option>
                  <option value="mi">Miles (mi)</option>
                </select>
              </label>

              <label className={`rounded-2xl border p-3 ${glassSoft}`}>
                <span className={`block text-[10px] uppercase tracking-[0.16em] ${muted}`}>Snow depth</span>
                <select value={snowDepthUnit} onChange={(e) => { const v = e.target.value as SnowDepthUnit; setSnowDepthUnit(v); saveUnit("smart-home-snow-depth-unit", v); }} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
                  <option value="cm">Centimeters (cm)</option>
                  <option value="in">Inches (in)</option>
                </select>
              </label>

              <label className={`flex items-center justify-between rounded-2xl border p-3 ${glassSoft}`}>
                <span>
                  <span className={`block text-[10px] uppercase tracking-[0.16em] ${muted}`}>Clock</span>
                  <span className="mt-1 block text-sm font-semibold">24-hour format</span>
                </span>
                <input type="checkbox" checked={time24Hour} onChange={(e) => { setTime24Hour(e.target.checked); localStorage.setItem("smart-home-clock-24h", String(e.target.checked)); }} className="h-5 w-5" />
              </label>
            </div>

            <div className={`mt-5 rounded-2xl border p-4 ${glassSoft}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={`text-[10px] uppercase tracking-[0.16em] ${muted}`}>Selected location</p>
                  <p className="mt-1 font-semibold">{location.name}, {location.country}</p>
                  <p className={`mt-1 text-xs ${muted}`}>{location.timezone ?? "UTC"}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] uppercase tracking-[0.16em] ${muted}`}>Local GMT</p>
                  <p className="mt-1 text-lg font-semibold">{gmtLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <BackgroundSettingsModal
        open={showBackgroundSettings}
        onClose={() => setShowBackgroundSettings(false)}
      />

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

    </main>
  );
}

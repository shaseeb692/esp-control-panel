"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  MapPin,
  MoonStar,
  RefreshCw,
  Settings2,
  Sun,
  X,
} from "lucide-react";

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
  currentLocalTime: string;

  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozoneUgM3: number | null;
  no2UgM3: number | null;
  coUgM3: number | null;
  so2UgM3: number | null;
};

const AUTO_WEATHER_LOCATION: WeatherLocation = {
  name: "Auto Location",
  latitude: 24.8607,
  longitude: 67.0011,
  auto: true,
};

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
  return unit === "inHg" ? valueHpa * 0.0295299830714 : valueHpa;
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
  return coToMgM3(ugM3) * (24.45 / 28.01);
}

function formatWeatherTime(value: string, format: TimeFormat) {
  if (!value) return "—";
  const timePart = value.includes("T") ? value.split("T")[1] : value;

  if (format === "24h") return timePart?.slice(0, 5) || "—";

  const [hoursRaw, minutes = "00"] = (timePart || "").split(":");
  const hours = Number(hoursRaw);
  if (!Number.isFinite(hours)) return value;

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${minutes} ${period}`;
}

function moonPhaseLabel(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Unavailable";

  let phase = value;
  if (phase > 1) phase = phase <= 100 ? phase / 100 : phase / 360;
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


function getCurrentSunPhase(
  currentTime: string,
  sunrise: string,
  sunset: string,
) {
  const toMinutes = (value: string) => {
    if (!value) return NaN;
    const time = value.includes("T") ? value.split("T")[1] : value;
    const [h, m = "0"] = time.split(":");
    return Number(h) * 60 + Number(m);
  };

  const now = toMinutes(currentTime);
  const rise = toMinutes(sunrise);
  const set = toMinutes(sunset);

  if (![now, rise, set].every(Number.isFinite)) {
    return { label: "Unavailable", icon: "☀️" };
  }

  if (now < rise - 30 || now >= set + 45) {
    return { label: "Night", icon: "🌙" };
  }

  if (now < rise - 10) {
    return { label: "Dawn", icon: "🌄" };
  }

  if (now < rise + 20) {
    return { label: "Sunrise", icon: "🌅" };
  }

  if (now < set - 60) {
    return { label: "Daylight", icon: "☀️" };
  }

  if (now < set - 20) {
    return { label: "Golden Hour", icon: "✨" };
  }

  if (now < set + 20) {
    return { label: "Sunset", icon: "🌇" };
  }

  return { label: "Dusk", icon: "🌆" };
}

function getWeatherInfo(code: number) {
  if (code === 0) return { label: "Clear sky", type: "clear" };
  if ([1, 2, 3].includes(code)) {
    return { label: code === 3 ? "Overcast" : "Partly cloudy", type: "cloudy" };
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: "Rain", type: "rain" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: "Snow", type: "snow" };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: "Thunderstorm", type: "storm" };
  }
  return { label: "Cloudy", type: "cloudy" };
}

function WeatherIcon({ code, size = 44 }: { code: number; size?: number }) {
  const info = getWeatherInfo(code);

  if (info.type === "rain" || info.type === "storm") {
    return <CloudRain size={size} />;
  }

  if (info.type === "snow") {
    return <CloudSnow size={size} />;
  }

  if (info.type === "clear") {
    return <Sun size={size} />;
  }

  return <CloudSun size={size} />;
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
      <p className="mt-1 text-sm font-semibold">{value}</p>
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

export default function WeatherPage() {
  const router = useRouter();

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [error, setError] = useState("");

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

  const [weatherLocation, setWeatherLocation] =
    useState<WeatherLocation>(AUTO_WEATHER_LOCATION);
  const [pendingWeatherLocation, setPendingWeatherLocation] =
    useState<WeatherLocation>(AUTO_WEATHER_LOCATION);

  const [weatherCitySearch, setWeatherCitySearch] = useState("");
  const [citySearchResults, setCitySearchResults] =
    useState<CitySearchResult[]>([]);
  const [citySearchLoading, setCitySearchLoading] = useState(false);

  const darkMode = true;
  const muted = "text-white/50";
  const glass = "border-white/15 bg-black/[0.30] text-white";
  const glassSoft = "border-white/10 bg-white/[0.07]";

  async function loadWeather(locationOverride?: WeatherLocation) {
    try {
      setWeatherLoading(true);
      setError("");

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
          latitude = 24.8607;
          longitude = 67.0011;
          city = "Karachi";
          country = "Pakistan";
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
      const airData = airResponse.ok ? await airResponse.json() : null;

      const intervalSeconds = Number(data.current?.interval ?? 3600);
      const currentPrecipitation = Number(data.current?.precipitation ?? 0);
      const precipitationRateMmH =
        intervalSeconds > 0
          ? currentPrecipitation * (3600 / intervalSeconds)
          : currentPrecipitation;

      setWeather({
        temperature: Number(data.current?.temperature_2m ?? 0),
        apparentTemperature: Number(data.current?.apparent_temperature ?? 0),
        highTemperature: Number(data.daily?.temperature_2m_max?.[0] ?? 0),
        lowTemperature: Number(data.daily?.temperature_2m_min?.[0] ?? 0),
        dewPoint: Number(data.current?.dew_point_2m ?? 0),
        humidity: Number(data.current?.relative_humidity_2m ?? 0),

        precipitation: currentPrecipitation,
        rainfallAmount: Number(data.daily?.rain_sum?.[0] ?? data.current?.rain ?? 0),
        snowfallDepthCm: Number(data.current?.snow_depth ?? 0) * 100,
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
        currentLocalTime: data.current?.time ?? "",

        aqi: airData?.current?.us_aqi == null ? null : Number(airData.current.us_aqi),
        pm25: airData?.current?.pm2_5 == null ? null : Number(airData.current.pm2_5),
        pm10: airData?.current?.pm10 == null ? null : Number(airData.current.pm10),
        ozoneUgM3: airData?.current?.ozone == null ? null : Number(airData.current.ozone),
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
      console.error(err);
      setError("Could not load weather for this location.");
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    const raw = localStorage.getItem("smart-weather-settings-v3");

    let initialLocation = AUTO_WEATHER_LOCATION;

    if (raw) {
      try {
        const saved = JSON.parse(raw);

        if (saved.temperatureUnit === "C" || saved.temperatureUnit === "F") {
          setTemperatureUnit(saved.temperatureUnit);
        }

        if (["km/h", "mph", "m/s", "knots"].includes(saved.windUnit)) {
          setWindUnit(saved.windUnit);
        }

        if (["mm", "in"].includes(saved.precipitationUnit)) {
          setPrecipitationUnit(saved.precipitationUnit);
        }

        if (["cm", "in"].includes(saved.snowUnit)) {
          setSnowUnit(saved.snowUnit);
        }

        if (["hPa", "mb", "inHg"].includes(saved.pressureUnit)) {
          setPressureUnit(saved.pressureUnit);
        }

        if (["km", "mi"].includes(saved.visibilityUnit)) {
          setVisibilityUnit(saved.visibilityUnit);
        }

        if (["12h", "24h"].includes(saved.timeFormat)) {
          setTimeFormat(saved.timeFormat);
        }

        if (["ppb", "ug/m3"].includes(saved.ozoneUnit)) {
          setOzoneUnit(saved.ozoneUnit);
        }

        if (["ppm", "mg/m3"].includes(saved.coUnit)) {
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
          initialLocation = saved.location;
          setWeatherLocation(saved.location);
          setPendingWeatherLocation(saved.location);
        }
      } catch {}
    }

    loadWeather(initialLocation);
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
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error("City search failed");

        const data = await response.json();
        setCitySearchResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadWeather(weatherLocation);
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [weatherLocation]);

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

  const weatherType = weather
    ? getWeatherInfo(weather.weatherCode).type
    : "cloudy";

  const displayTemperature = weather
    ? convertTemperature(weather.temperature, temperatureUnit)
    : 0;

  const displayFeelsLike = weather
    ? convertTemperature(weather.apparentTemperature, temperatureUnit)
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

  const currentSunPhase = weather
    ? getCurrentSunPhase(
        weather.currentLocalTime,
        weather.sunrise,
        weather.sunset,
      )
    : { label: "Unavailable", icon: "☀️" };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-b from-sky-500 via-slate-900 to-slate-950" />

      {weather?.isDay === false && (
        <>
          <MoonStar
            className="pointer-events-none fixed right-[10%] top-[10%] text-white/80"
            size={100}
          />

          <div className="pointer-events-none fixed inset-0">
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-1 w-1 animate-pulse rounded-full bg-white"
                style={{
                  left: `${7 + ((index * 13) % 88)}%`,
                  top: `${6 + ((index * 17) % 45)}%`,
                  animationDelay: `${index * 230}ms`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {["cloudy", "rain", "storm"].includes(weatherType) && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <Cloud className="absolute -left-40 top-[10%] animate-[cloudMove_38s_linear_infinite] text-white/20" size={180} />
          <Cloud className="absolute -left-52 top-[30%] animate-[cloudMove_55s_linear_infinite] text-white/15" size={250} />
          <Cloud className="absolute -right-52 top-[8%] animate-[cloudMoveReverse_46s_linear_infinite] text-white/15" size={210} />
        </div>
      )}

      {rainEffectsEnabled && ["rain", "storm"].includes(weatherType) && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-45">
          {Array.from({ length: 90 }).map((_, index) => (
            <span
              key={index}
              className="absolute top-[-30px] h-20 w-px rotate-[15deg] animate-[rainFall_800ms_linear_infinite] bg-white/60"
              style={{
                left: `${(index * 19) % 100}%`,
                animationDelay: `${(index * 43) % 1000}ms`,
              }}
            />
          ))}
        </div>
      )}

      {snowEffectsEnabled && weatherType === "snow" && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-75">
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

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-4 py-2.5 text-sm font-semibold backdrop-blur-xl"
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={openWeatherSettings}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-4 py-2.5 text-sm font-semibold backdrop-blur-xl"
            >
              <Settings2 size={16} />
              Settings
            </button>

            <button
              type="button"
              onClick={() => loadWeather(weatherLocation)}
              disabled={weatherLoading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-black/20 backdrop-blur-xl disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={weatherLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <section className={`rounded-[34px] border p-5 shadow-2xl backdrop-blur-2xl ${glass}`}>
          {weatherLoading && !weather ? (
            <div className="flex min-h-[250px] items-center justify-center gap-2">
              <Loader2 className="animate-spin" />
              Loading weather...
            </div>
          ) : weather ? (
            <>
              <div className={`rounded-[26px] border p-5 ${glassSoft}`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.18em] ${muted}`}>
                      Weather details
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-5xl font-semibold">
                        {Math.round(displayTemperature)}°{temperatureUnit}
                      </span>

                      <WeatherIcon code={weather.weatherCode} size={46} />
                    </div>

                    <p className={`mt-1 text-sm ${muted}`}>
                      {getWeatherInfo(weather.weatherCode).label}
                    </p>

                    <div className={`mt-2 flex items-center gap-1 text-xs ${muted}`}>
                      <MapPin size={12} />
                      {weather.city}
                      {weather.country ? `, ${weather.country}` : ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:min-w-[330px]">
                    <Metric label="Feels Like" value={`${formatMetric(displayFeelsLike, 1)} °${temperatureUnit}`} muted={muted} />
                    <Metric label="High" value={`${formatMetric(displayHighTemperature, 1)} °${temperatureUnit}`} muted={muted} />
                    <Metric label="Low" value={`${formatMetric(displayLowTemperature, 1)} °${temperatureUnit}`} muted={muted} />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Section title="Core Temperatures" glassSoft={glassSoft}>
                  <Metric label="Current Temperature" value={`${formatMetric(displayTemperature, 1)} °${temperatureUnit}`} muted={muted} />
                  <Metric label="Feels Like" value={`${formatMetric(displayFeelsLike, 1)} °${temperatureUnit}`} muted={muted} />
                  <Metric label="High / Low" value={`${formatMetric(displayHighTemperature, 1)}° / ${formatMetric(displayLowTemperature, 1)}° ${temperatureUnit}`} muted={muted} />
                  <Metric label="Dew Point" value={`${formatMetric(displayDewPoint, 1)} °${temperatureUnit}`} muted={muted} />
                </Section>

                <Section title="Precipitation & Moisture" glassSoft={glassSoft}>
                  <Metric label="Rainfall Amount" value={`${formatMetric(displayRainfall, 2)} ${precipitationUnit}`} muted={muted} />
                  <Metric label="Snowfall Depth" value={`${formatMetric(displaySnowDepth, 2)} ${snowUnit}`} muted={muted} />
                  <Metric label="Precipitation Rate" value={`${formatMetric(displayPrecipitationRate, 2)} ${precipitationUnit}/h`} muted={muted} />
                  <Metric label="Relative Humidity" value={`${formatMetric(weather.humidity, 0)}%`} muted={muted} />
                  <Metric label="Chance of Rain / Snow" value={`${formatMetric(weather.precipitationChance, 0)}%`} muted={muted} />
                </Section>

                <Section title="Wind & Atmosphere" glassSoft={glassSoft}>
                  <Metric label="Wind Speed" value={`${formatMetric(displayWindSpeed, 1)} ${windUnit === "knots" ? "kt" : windUnit}`} muted={muted} />
                  <Metric label="Wind Gusts" value={`${formatMetric(displayWindGust, 1)} ${windUnit === "knots" ? "kt" : windUnit}`} muted={muted} />
                  <Metric label="Wind Direction" value={`${Math.round(weather.windDirection)}° ${windDirectionLabel(weather.windDirection)}`} muted={muted} />
                  <Metric label="Atmospheric Pressure" value={`${formatMetric(displayPressure, pressureUnit === "inHg" ? 2 : 0)} ${pressureUnit}`} muted={muted} />
                </Section>

                <Section title="Visibility & Sky" glassSoft={glassSoft}>
                  <Metric label="Visibility Distance" value={`${formatMetric(displayVisibility, 1)} ${visibilityUnit}`} muted={muted} />
                  <Metric label="Cloud Cover" value={`${formatMetric(weather.cloudCover, 0)}%`} muted={muted} />
                  <Metric label="UV Index" value={formatMetric(weather.uvIndex, 1)} muted={muted} />
                </Section>

                <Section title="Air Quality Index" glassSoft={glassSoft}>
                  <Metric label="US AQI" value={weather.aqi == null ? "—" : `${Math.round(weather.aqi)} · ${aqiLabel(weather.aqi)}`} muted={muted} />
                  <Metric label="PM2.5" value={weather.pm25 == null ? "—" : `${formatMetric(weather.pm25, 1)} µg/m³`} muted={muted} />
                  <Metric label="PM10" value={weather.pm10 == null ? "—" : `${formatMetric(weather.pm10, 1)} µg/m³`} muted={muted} />
                  <Metric label="O₃" value={displayOzone == null ? "—" : `${formatMetric(displayOzone, 1)} ${ozoneUnit === "ppb" ? "ppb" : "µg/m³"}`} muted={muted} />
                  <Metric label="NO₂" value={displayNo2 == null ? "—" : `${formatMetric(displayNo2, 1)} ppb`} muted={muted} />
                  <Metric label="CO" value={displayCO == null ? "—" : `${formatMetric(displayCO, coUnit === "ppm" ? 2 : 3)} ${coUnit === "ppm" ? "ppm" : "mg/m³"}`} muted={muted} />
                  <Metric label="SO₂" value={displaySo2 == null ? "—" : `${formatMetric(displaySo2, 1)} ppb`} muted={muted} />
                </Section>

                <Section title="Astronomical Times" glassSoft={glassSoft}>
                  <Metric
                    label="Current Sun Phase"
                    value={currentSunPhase.label}
                    muted={muted}
                  />

                  <Metric
                    label="Current Moon Phase"
                    value={moonPhaseLabel(weather.moonPhase)}
                    muted={muted}
                  />

                  <Metric
                    label="Sunrise"
                    value={formatWeatherTime(weather.sunrise, timeFormat)}
                    muted={muted}
                  />

                  <Metric
                    label="Moonrise"
                    value={formatWeatherTime(weather.moonrise, timeFormat)}
                    muted={muted}
                  />

                  <Metric
                    label="Sunset"
                    value={formatWeatherTime(weather.sunset, timeFormat)}
                    muted={muted}
                  />

                  <Metric
                    label="Moonset"
                    value={formatWeatherTime(weather.moonset, timeFormat)}
                    muted={muted}
                  />
                </Section>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-white/50">
              Weather unavailable
            </div>
          )}
        </section>
      </div>

      {showWeatherSettings && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowWeatherSettings(false);
            }
          }}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/15 bg-slate-950 p-6 text-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Weather Settings</h2>
                <p className="mt-1 text-xs text-white/50">
                  Search any city worldwide and choose units.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowWeatherSettings(false)}
                className="rounded-xl p-2 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-semibold">Location</label>

                <button
                  type="button"
                  onClick={() => {
                    setPendingWeatherLocation(AUTO_WEATHER_LOCATION);
                    setWeatherCitySearch("");
                    setCitySearchResults([]);
                  }}
                  className={`mt-2 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                    pendingWeatherLocation.auto
                      ? "border-cyan-400/50 bg-cyan-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">Auto Location</span>
                    <span className="text-xs text-white/50">
                      Use this device&apos;s location
                    </span>
                  </span>
                  {pendingWeatherLocation.auto ? "✓" : ""}
                </button>

                <div className="relative mt-3">
                  <input
                    type="text"
                    value={weatherCitySearch}
                    onChange={(e) => setWeatherCitySearch(e.target.value)}
                    placeholder="Search any city worldwide..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30"
                  />

                  {citySearchLoading && (
                    <Loader2
                      size={16}
                      className="absolute right-4 top-3.5 animate-spin opacity-50"
                    />
                  )}
                </div>

                {citySearchResults.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                    {citySearchResults.map((result) => (
                      <button
                        type="button"
                        key={result.id}
                        onClick={() => {
                          setPendingWeatherLocation({
                            name: result.name,
                            country: result.country,
                            latitude: result.latitude,
                            longitude: result.longitude,
                            timezone: result.timezone,
                            auto: false,
                          });

                          setWeatherCitySearch(
                            [result.name, result.admin1, result.country]
                              .filter(Boolean)
                              .join(", "),
                          );

                          setCitySearchResults([]);
                        }}
                        className="block w-full border-b border-white/10 px-4 py-3 text-left last:border-b-0 hover:bg-white/5"
                      >
                        <span className="block text-sm font-medium">
                          {result.name}
                        </span>
                        <span className="text-xs text-white/50">
                          {[result.admin1, result.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SettingSelect
                  label="Temperature"
                  value={temperatureUnit}
                  onChange={(value) => setTemperatureUnit(value as TemperatureUnit)}
                  options={[
                    ["C", "Celsius (°C)"],
                    ["F", "Fahrenheit (°F)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Wind Speed / Gusts"
                  value={windUnit}
                  onChange={(value) => setWindUnit(value as WindUnit)}
                  options={[
                    ["km/h", "Kilometers/hour (km/h)"],
                    ["mph", "Miles/hour (mph)"],
                    ["knots", "Knots (kt)"],
                    ["m/s", "Meters/second (m/s)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Rain / Precipitation"
                  value={precipitationUnit}
                  onChange={(value) => setPrecipitationUnit(value as PrecipitationUnit)}
                  options={[
                    ["mm", "Millimeters (mm)"],
                    ["in", "Inches (in)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Snow Depth"
                  value={snowUnit}
                  onChange={(value) => setSnowUnit(value as SnowUnit)}
                  options={[
                    ["cm", "Centimeters (cm)"],
                    ["in", "Inches (in)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Atmospheric Pressure"
                  value={pressureUnit}
                  onChange={(value) => setPressureUnit(value as PressureUnit)}
                  options={[
                    ["hPa", "Hectopascals (hPa)"],
                    ["mb", "Millibars (mb)"],
                    ["inHg", "Inches of mercury (inHg)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Visibility"
                  value={visibilityUnit}
                  onChange={(value) => setVisibilityUnit(value as VisibilityUnit)}
                  options={[
                    ["km", "Kilometers (km)"],
                    ["mi", "Miles (mi)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Ozone (O₃)"
                  value={ozoneUnit}
                  onChange={(value) => setOzoneUnit(value as OzoneUnit)}
                  options={[
                    ["ppb", "Parts per billion (ppb)"],
                    ["ug/m3", "Micrograms/m³ (µg/m³)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Carbon Monoxide (CO)"
                  value={coUnit}
                  onChange={(value) => setCoUnit(value as COUnit)}
                  options={[
                    ["ppm", "Parts per million (ppm)"],
                    ["mg/m3", "Milligrams/m³ (mg/m³)"],
                  ]}
                  darkMode={darkMode}
                />

                <SettingSelect
                  label="Astronomical Time"
                  value={timeFormat}
                  onChange={(value) => setTimeFormat(value as TimeFormat)}
                  options={[
                    ["12h", "12-hour (AM/PM)"],
                    ["24h", "24-hour"],
                  ]}
                  darkMode={darkMode}
                />
              </div>

              <div>
                <p className="text-sm font-semibold">Weather Effects</p>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm">Rain animation</span>
                    <input
                      type="checkbox"
                      checked={rainEffectsEnabled}
                      onChange={(e) => setRainEffectsEnabled(e.target.checked)}
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm">Snow animation</span>
                    <input
                      type="checkbox"
                      checked={snowEffectsEnabled}
                      onChange={(e) => setSnowEffectsEnabled(e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowWeatherSettings(false)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={applyWeatherSettings}
                className="flex-1 rounded-2xl border border-cyan-300/30 bg-cyan-400/15 py-3 text-sm font-semibold text-cyan-100"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes cloudMove {
          0% { transform: translateX(-25vw); }
          100% { transform: translateX(125vw); }
        }

        @keyframes cloudMoveReverse {
          0% { transform: translateX(125vw); }
          100% { transform: translateX(-30vw); }
        }

        @keyframes rainFall {
          0% { transform: translateY(-30px) rotate(15deg); }
          100% { transform: translateY(115vh) rotate(15deg); }
        }

        @keyframes snowFall {
          0% { transform: translateY(-20px) translateX(0); }
          50% { transform: translateY(55vh) translateX(18px); }
          100% { transform: translateY(115vh) translateX(-12px); }
        }
      `}</style>
    </main>
  );
}

function Section({
  title,
  children,
  glassSoft,
}: {
  title: string;
  children: ReactNode;
  glassSoft: string;
}) {
  return (
    <div className={`rounded-[24px] border p-5 ${glassSoft}`}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-4 grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

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

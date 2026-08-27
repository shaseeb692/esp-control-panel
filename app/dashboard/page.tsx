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
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  isDay: boolean;
  city: string;
};

const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&q=85";

function getWeatherInfo(code: number) {
  if (code === 0) {
    return {
      label: "Clear sky",
      type: "clear",
    };
  }

  if (code === 1 || code === 2) {
    return {
      label: "Partly cloudy",
      type: "cloudy",
    };
  }

  if (code === 3) {
    return {
      label: "Overcast",
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
}: {
  code: number;
  size?: number;
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
    return <Sun size={size} />;
  }

  return <CloudSun size={size} />;
}

/*
|--------------------------------------------------------------------------
| Animated Cloud
|--------------------------------------------------------------------------
| Custom name so it doesn't conflict with lucide-react's Cloud import.
*/

function AnimatedCloud({
  className = "",
  size = 180,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size * 0.62}
      viewBox="0 0 200 125"
      fill="none"
      aria-hidden="true"
    >
      <g filter="url(#cloudBlur)">
        <path
          d="M58 98H151C177 98 194 82 194 61C194 41 179 26 159 25C152 9 137 0 119 0C95 0 76 16 72 39C68 38 63 37 58 37C35 37 18 54 18 75C18 88 28 98 42 98H58Z"
          fill="white"
        />
      </g>

      <defs>
        <filter
          id="cloudBlur"
          x="-10%"
          y="-10%"
          width="120%"
          height="130%"
        >
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState("");
  const [houses, setHouses] = useState<House[]>([]);

  const [showCreateHouse, setShowCreateHouse] = useState(false);
  const [showBackgroundSettings, setShowBackgroundSettings] =
    useState(false);

  const [houseName, setHouseName] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [background, setBackground] =
    useState(DEFAULT_BACKGROUND);

  const [uploadingBackground, setUploadingBackground] =
    useState(false);

  const [backgroundUploadedAt, setBackgroundUploadedAt] =
    useState<string | null>(null);

  const [weather, setWeather] =
    useState<WeatherData | null>(null);

  const [weatherLoading, setWeatherLoading] =
    useState(true);

  const [error, setError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | WEATHER
  |--------------------------------------------------------------------------
  */

  async function loadWeather() {
    try {
      setWeatherLoading(true);

      let latitude = 24.8607;
      let longitude = 67.0011;
      let city = "Karachi";

      /*
      |--------------------------------------------------------------------------
      | Browser location
      |--------------------------------------------------------------------------
      */

      if (
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        try {
          const position =
            await new Promise<GeolocationPosition>(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 30 * 60 * 1000,
                  }
                );
              }
            );

          latitude = position.coords.latitude;
          longitude = position.coords.longitude;

          /*
          |--------------------------------------------------------------------------
          | Reverse geocoding
          |--------------------------------------------------------------------------
          */

          try {
            const geoResponse = await fetch(
              `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`
            );

            if (geoResponse.ok) {
              const geoData = await geoResponse.json();

              if (geoData?.results?.[0]?.name) {
                city = geoData.results[0].name;
              }
            }
          } catch {
            // Karachi fallback
          }
        } catch {
          // Permission denied / timeout.
          // Karachi fallback.
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Open-Meteo
      |--------------------------------------------------------------------------
      */

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&timezone=auto`
      );

      if (!response.ok) {
        throw new Error("Weather request failed");
      }

      const data = await response.json();

      setWeather({
        temperature: data.current.temperature_2m,
        apparentTemperature:
          data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        precipitation: data.current.precipitation,
        weatherCode: data.current.weather_code,
        windSpeed: data.current.wind_speed_10m,
        isDay: data.current.is_day === 1,
        city,
      });
    } catch (err) {
      console.error("Weather loading error:", err);
    } finally {
      setWeatherLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD DASHBOARD
  |--------------------------------------------------------------------------
  */

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

        /*
        |--------------------------------------------------------------------------
        | Houses
        |--------------------------------------------------------------------------
        */

        const {
          data: housesData,
          error: housesError,
        } = await supabase
          .from("houses")
          .select("id, name, created_at")
          .eq("owner_id", user.id)
          .order("created_at", {
            ascending: true,
          });

        if (housesError) {
          console.error(
            "House loading error:",
            housesError
          );

          setError(
            `Could not load houses: ${housesError.message}`
          );

          setHouses([]);
        } else {
          setHouses(housesData ?? []);
        }

        /*
        |--------------------------------------------------------------------------
        | User Background
        |--------------------------------------------------------------------------
        */

        const {
          data: backgroundData,
          error: backgroundError,
        } = await supabase
          .from("dashboard_backgrounds")
          .select("file_path, uploaded_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!backgroundError && backgroundData) {
          const uploadedAt = new Date(
            backgroundData.uploaded_at
          );

          const age =
            Date.now() - uploadedAt.getTime();

          const thirtyDays =
            30 * 24 * 60 * 60 * 1000;

          /*
          |--------------------------------------------------------------------------
          | Automatically remove after 30 days
          |--------------------------------------------------------------------------
          */

          if (age >= thirtyDays) {
            await supabase.storage
              .from("dashboard-backgrounds")
              .remove([
                backgroundData.file_path,
              ]);

            await supabase
              .from("dashboard_backgrounds")
              .delete()
              .eq("user_id", user.id);

            setBackground(DEFAULT_BACKGROUND);
            setBackgroundUploadedAt(null);
          } else {
            const {
              data: publicUrlData,
            } = supabase.storage
              .from("dashboard-backgrounds")
              .getPublicUrl(
                backgroundData.file_path
              );

            if (publicUrlData?.publicUrl) {
              setBackground(
                `${publicUrlData.publicUrl}?v=${uploadedAt.getTime()}`
              );
            }

            setBackgroundUploadedAt(
              backgroundData.uploaded_at
            );
          }
        }

        await loadWeather();
      } catch (err) {
        console.error(
          "Dashboard loading error:",
          err
        );

        setError(
          "Something went wrong while loading the dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  /*
  |--------------------------------------------------------------------------
  | WEATHER AUTO REFRESH
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const interval = setInterval(() => {
      loadWeather();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  /*
  |--------------------------------------------------------------------------
  | BACKGROUND UPLOAD
  |--------------------------------------------------------------------------
  */

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

      /*
      |--------------------------------------------------------------------------
      | IMPORTANT
      |--------------------------------------------------------------------------
      | Every user gets their own folder:
      |
      | user-id/background.jpg
      |
      | Therefore Haseeb's image can NEVER overwrite Waqar's image.
      */

      const filePath =
        `${user.id}/background.jpg`;

      /*
      |--------------------------------------------------------------------------
      | Replace existing image
      |--------------------------------------------------------------------------
      */

      const {
        error: uploadError,
      } = await supabase.storage
        .from("dashboard-backgrounds")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            contentType: file.type,
            upsert: true,
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      const uploadedAt =
        new Date().toISOString();

      /*
      |--------------------------------------------------------------------------
      | Save metadata
      |--------------------------------------------------------------------------
      */

      const {
        error: dbError,
      } = await supabase
        .from("dashboard_backgrounds")
        .upsert(
          {
            user_id: user.id,
            file_path: filePath,
            uploaded_at: uploadedAt,
          },
          {
            onConflict: "user_id",
          }
        );

      if (dbError) {
        throw dbError;
      }

      /*
      |--------------------------------------------------------------------------
      | New public URL
      |--------------------------------------------------------------------------
      */

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("dashboard-backgrounds")
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setBackground(
          `${publicUrlData.publicUrl}?v=${Date.now()}`
        );
      }

      setBackgroundUploadedAt(uploadedAt);
      setShowBackgroundSettings(false);
    } catch (err) {
      console.error(
        "Background upload error:",
        err
      );

      setError(
        "Could not upload background image."
      );
    } finally {
      setUploadingBackground(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | REMOVE BACKGROUND
  |--------------------------------------------------------------------------
  */

  async function removeBackground() {
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const filePath =
        `${user.id}/background.jpg`;

      await supabase.storage
        .from("dashboard-backgrounds")
        .remove([filePath]);

      await supabase
        .from("dashboard_backgrounds")
        .delete()
        .eq("user_id", user.id);

      setBackground(DEFAULT_BACKGROUND);
      setBackgroundUploadedAt(null);
      setShowBackgroundSettings(false);
    } catch (err) {
      console.error(
        "Remove background error:",
        err
      );

      setError(
        "Could not remove background."
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE HOUSE
  |--------------------------------------------------------------------------
  */

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
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth/login");
        return;
      }

      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const {
        data,
        error: insertError,
      } = await supabase
        .from("houses")
        .insert({
          owner_id: user.id,
          name,
          slug,
        })
        .select(
          "id, name, created_at"
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      setHouses((current) => [
        ...current,
        data,
      ]);

      setHouseName("");
      setShowCreateHouse(false);
    } catch (err) {
      console.error(
        "Create house error:",
        err
      );

      setError(
        "Could not create house."
      );
    } finally {
      setCreating(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/auth/login");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | WEATHER STATE
  |--------------------------------------------------------------------------
  */

  const weatherType = weather
    ? getWeatherInfo(
        weather.weatherCode
      ).type
    : "cloudy";

  const night =
    weather
      ? !weather.isDay
      : false;

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-5">
        <div className="mx-auto max-w-6xl space-y-5">

          <div className="h-20 animate-pulse rounded-[28px] bg-white/10" />

          <div className="h-56 animate-pulse rounded-[34px] bg-white/10" />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(
              (item) => (
                <div
                  key={item}
                  className="h-52 animate-pulse rounded-[30px] bg-white/10"
                />
              )
            )}
          </div>

        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MAIN DASHBOARD
  |--------------------------------------------------------------------------
  */

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">

      {/* =====================================================
          BACKGROUND IMAGE
      ===================================================== */}

      <div
        className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-[1500ms]"
        style={{
          backgroundImage: `url("${background}")`,
        }}
      />

      {/* =====================================================
          IMAGE DARKENING
          Keeps cards/content readable.
      ===================================================== */}

      <div
        className={`fixed inset-0 z-[1] transition-all duration-[1500ms] ${
          night
            ? "bg-slate-950/75"
            : weatherType === "rain"
            ? "bg-slate-950/65"
            : weatherType === "storm"
            ? "bg-black/75"
            : weatherType === "snow"
            ? "bg-slate-900/55"
            : weatherType === "cloudy"
            ? "bg-slate-950/55"
            : "bg-slate-950/42"
        }`}
      />

      {/* =====================================================
          EXTRA CONTENT READABILITY GRADIENT
      ===================================================== */}

      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(0,0,0,0.08),rgba(0,0,0,0.30))]" />

      {/* =====================================================
          NIGHT
      ===================================================== */}

      {night && (
        <>

          {/* Night blue atmosphere */}

          <div className="pointer-events-none fixed inset-0 z-[3] bg-gradient-to-b from-indigo-950/45 via-slate-950/10 to-black/45" />

          {/* Moon */}

          <div className="pointer-events-none fixed right-[9%] top-[9%] z-[4]">

            <div className="h-24 w-24 rounded-full bg-white/90 shadow-[0_0_70px_rgba(255,255,255,0.45)]" />

            <div className="absolute -right-2 -top-1 h-24 w-24 rounded-full bg-indigo-950/95" />

          </div>

          {/* Stars */}

          <div className="pointer-events-none fixed inset-0 z-[4] opacity-70">

            {[
              [12, 11],
              [22, 23],
              [34, 9],
              [48, 17],
              [61, 8],
              [72, 25],
              [82, 13],
              [91, 31],
              [15, 38],
              [55, 32],
              [76, 43],
              [88, 48],
            ].map(
              ([left, top], index) => (
                <span
                  key={index}
                  className="absolute h-1 w-1 animate-pulse rounded-full bg-white"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    animationDelay: `${index * 350}ms`,
                  }}
                />
              )
            )}

          </div>

        </>
      )}

      {/* =====================================================
          CLOUDS
          Background only — low opacity so they don't cover UI.
      ===================================================== */}

      {(weatherType === "cloudy" ||
        weatherType === "rain" ||
        weatherType === "storm") && (
        <div className="pointer-events-none fixed inset-0 z-[4] overflow-hidden">

          <AnimatedCloud
            size={190}
            className="absolute -left-52 top-[10%] opacity-[0.12] animate-[cloudMove_42s_linear_infinite]"
          />

          <AnimatedCloud
            size={240}
            className="absolute -left-64 top-[27%] opacity-[0.08] animate-[cloudMove_55s_linear_infinite]"
          />

          <AnimatedCloud
            size={210}
            className="absolute -right-60 top-[14%] opacity-[0.09] animate-[cloudMoveReverse_48s_linear_infinite]"
          />

          <AnimatedCloud
            size={160}
            className="absolute -right-48 top-[40%] opacity-[0.06] animate-[cloudMoveReverse_65s_linear_infinite]"
          />

        </div>
      )}

      {/* =====================================================
          RAIN
      ===================================================== */}

      {(weatherType === "rain" ||
        weatherType === "storm") && (
        <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden opacity-[0.24]">

          {[...Array(65)].map(
            (_, index) => (
              <span
                key={index}
                className="absolute -top-20 h-14 w-px rotate-[15deg] bg-white/60 animate-[rainFall_850ms_linear_infinite]"
                style={{
                  left: `${(index * 17) % 100}%`,
                  animationDelay: `${(index * 47) % 850}ms`,
                  opacity:
                    0.25 +
                    ((index * 13) % 7) / 10,
                }}
              />
            )
          )}

        </div>
      )}

      {/* =====================================================
          SNOW
      ===================================================== */}

      {weatherType === "snow" && (
        <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden opacity-[0.45]">

          {[...Array(45)].map(
            (_, index) => (
              <span
                key={index}
                className="absolute -top-5 h-2 w-2 rounded-full bg-white/80 animate-[snowFall_7s_linear_infinite]"
                style={{
                  left: `${(index * 19) % 100}%`,
                  animationDelay: `${(index * 150) % 7000}ms`,
                }}
              />
            )
          )}

        </div>
      )}

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="relative z-20 mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6">

        {/* =====================================================
            NAVBAR
        ===================================================== */}

        <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/25 bg-slate-900/35 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.30)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-5">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-white shadow-lg">

              <Home size={21} />

            </div>

            <div>

              <p className="text-sm font-semibold text-white">
                Smart Home
              </p>

              <p className="text-xs text-white/60">
                Control center
              </p>

            </div>

          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() =>
                setShowBackgroundSettings(true)
              }
              className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-xl transition hover:bg-white/20"
            >

              <ImageIcon size={16} />

              <span className="hidden sm:inline">
                Background
              </span>

            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-xl transition hover:bg-white/20"
            >

              <LogOut size={16} />

              <span className="hidden sm:inline">
                Logout
              </span>

            </button>

          </div>

        </header>

        {/* =====================================================
            WEATHER / HERO
        ===================================================== */}

        <section className="relative mb-7 overflow-hidden rounded-[34px] border border-white/25 bg-slate-900/35 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl sm:p-8">

          {/* Inner glass shine */}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-black/[0.10]" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

            {/* LEFT */}

            <div className="max-w-xl">

              <div className="flex items-center gap-2 text-sm font-medium text-white/70">

                <MapPin size={15} />

                {weather?.city ?? "Your location"}

              </div>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white drop-shadow-lg sm:text-4xl">

                Welcome back

              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">

                Manage your homes, rooms and
                connected devices from one place.

              </p>

              {email && (
                <p className="mt-4 text-xs text-white/45">
                  {email}
                </p>
              )}

            </div>

            {/* =================================================
                WEATHER CARD
            ================================================= */}

            <div className="w-full rounded-[28px] border border-white/25 bg-white/[0.14] p-5 shadow-[0_15px_50px_rgba(0,0,0,0.25)] backdrop-blur-2xl lg:w-[390px]">

              {weatherLoading ? (
                <div className="flex items-center gap-3 py-5">

                  <Loader2
                    className="animate-spin text-white"
                    size={25}
                  />

                  <span className="text-sm text-white/65">
                    Loading weather...
                  </span>

                </div>
              ) : weather ? (
                <div>

                  <div className="flex items-start justify-between">

                    <div>

                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Current weather
                      </p>

                      <div className="mt-1 flex items-center gap-3">

                        <span className="text-5xl font-semibold tracking-tight text-white drop-shadow-md">

                          {Math.round(
                            weather.temperature
                          )}
                          °

                        </span>

                        <div className="text-white/90">

                          <WeatherIcon
                            code={
                              weather.weatherCode
                            }
                            size={42}
                          />

                        </div>

                      </div>

                      <p className="mt-1 text-sm font-medium text-white/70">

                        {
                          getWeatherInfo(
                            weather.weatherCode
                          ).label
                        }

                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-xs text-white/45">
                        Feels like
                      </p>

                      <p className="mt-1 text-lg font-semibold text-white">
                        {Math.round(
                          weather.apparentTemperature
                        )}
                        °
                      </p>

                    </div>

                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">

                    <div className="rounded-2xl border border-white/15 bg-black/10 p-3 backdrop-blur-md">

                      <Droplets
                        size={16}
                        className="text-cyan-200"
                      />

                      <p className="mt-2 text-xs text-white/45">
                        Humidity
                      </p>

                      <p className="text-sm font-semibold text-white">
                        {weather.humidity}%
                      </p>

                    </div>

                    <div className="rounded-2xl border border-white/15 bg-black/10 p-3 backdrop-blur-md">

                      <Wind
                        size={16}
                        className="text-cyan-200"
                      />

                      <p className="mt-2 text-xs text-white/45">
                        Wind
                      </p>

                      <p className="text-sm font-semibold text-white">

                        {Math.round(
                          weather.windSpeed
                        )}{" "}
                        km/h

                      </p>

                    </div>

                    <div className="rounded-2xl border border-white/15 bg-black/10 p-3 backdrop-blur-md">

                      <CloudRain
                        size={16}
                        className="text-cyan-200"
                      />

                      <p className="mt-2 text-xs text-white/45">
                        Rain
                      </p>

                      <p className="text-sm font-semibold text-white">
                        {weather.precipitation} mm
                      </p>

                    </div>

                  </div>

                </div>
              ) : (
                <div className="py-5 text-sm text-white/55">
                  Weather unavailable
                </div>
              )}

            </div>

          </div>

        </section>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-300/25 bg-red-950/40 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-xl">

            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p>{error}</p>

          </div>
        )}

        {/* =====================================================
            HOUSE HEADER
        ===================================================== */}

        <div className="mb-5 flex items-center justify-between gap-4">

          <div>

            <h2 className="text-xl font-semibold text-white drop-shadow-md">
              Your Houses
            </h2>

            <p className="mt-1 text-sm text-white/60">
              Manage your smart homes
            </p>

          </div>

          <button
            type="button"
            onClick={openCreateHouse}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/25 bg-white/[0.16] px-5 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.23]"
          >

            <Plus size={18} />

            <span className="hidden sm:inline">
              Create House
            </span>

          </button>

        </div>

        {/* =====================================================
            HOUSES
        ===================================================== */}

        {houses.length === 0 ? (

          <div className="rounded-[32px] border border-white/25 bg-slate-900/35 p-12 text-center shadow-[0_25px_70px_rgba(0,0,0,0.30)] backdrop-blur-2xl">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/25 bg-white/[0.14] text-white shadow-lg">

              <Home size={30} />

            </div>

            <h3 className="mt-5 text-lg font-semibold text-white">
              No houses yet
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/60">

              Create your first house to start
              adding rooms and ESP devices.

            </p>

            <button
              type="button"
              onClick={openCreateHouse}
              className="mx-auto mt-6 flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/[0.16] px-6 py-3 font-semibold text-white shadow-lg backdrop-blur-xl transition hover:bg-white/[0.23]"
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
                  navigateWithTransition(
                    () => {
                      router.push(
                        `/house/${house.id}`
                      );
                    }
                  )
                }
                className="group relative w-full overflow-hidden rounded-[30px] border border-white/25 bg-slate-900/35 p-6 text-left shadow-[0_20px_55px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1.5 hover:border-white/35 hover:bg-slate-900/45 hover:shadow-[0_25px_70px_rgba(0,0,0,0.38)]"
              >

                {/* Card shine */}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-black/[0.08] opacity-70" />

                {/* Top glass highlight */}

                <div className="pointer-events-none absolute left-5 right-5 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                <div className="relative">

                  <div className="flex items-start justify-between">

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-white/[0.14] text-white shadow-lg transition duration-300 group-hover:scale-105 group-hover:bg-white/[0.20]">

                      <Home size={27} />

                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/[0.10] text-white/55 transition group-hover:bg-white/[0.18] group-hover:text-white">

                      <ArrowUpRight size={19} />

                    </div>

                  </div>

                  <div className="mt-7">

                    <h3 className="text-xl font-semibold text-white drop-shadow-md">
                      {house.name}
                    </h3>

                    <p className="mt-1 text-sm text-white/55">
                      Smart home
                    </p>

                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4">

                    <span className="text-xs font-medium text-white/45">
                      House
                    </span>

                    <span className="text-xs font-semibold text-white/75 transition group-hover:text-white">
                      Open house →
                    </span>

                  </div>

                </div>

              </button>

            ))}

          </div>

        )}

      </div>

      {/* =====================================================
          BACKGROUND SETTINGS MODAL
      ===================================================== */}

      {showBackgroundSettings && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowBackgroundSettings(false);
            }
          }}
        >

          <div
            className="w-full max-w-md rounded-[32px] border border-white/25 bg-slate-900/80 p-7 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="flex items-start justify-between">

              <div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white">

                  <ImageIcon size={24} />

                </div>

                <h2 className="mt-4 text-2xl font-semibold text-white">
                  Dashboard Background
                </h2>

                <p className="mt-1 text-sm leading-6 text-white/55">

                  Use your own home interior image.
                  It automatically expires after
                  30 days.

                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowBackgroundSettings(false)
                }
                disabled={uploadingBackground}
                className="rounded-xl p-2 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >

                <X size={20} />

              </button>

            </div>

            {/* =================================================
                CURRENT PREVIEW
            ================================================= */}

            <div
              className="mt-6 h-40 overflow-hidden rounded-3xl border border-white/15 bg-cover bg-center shadow-xl"
              style={{
                backgroundImage: `url("${background}")`,
              }}
            >

              <div className="flex h-full items-end bg-gradient-to-t from-black/40 to-transparent p-4">

                <span className="rounded-xl border border-white/20 bg-black/20 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md">
                  Current background
                </span>

              </div>

            </div>

            {backgroundUploadedAt && (
              <p className="mt-3 text-xs text-white/45">

                Uploaded{" "}
                {new Date(
                  backgroundUploadedAt
                ).toLocaleDateString()}

              </p>
            )}

            {/* =================================================
                FILE INPUT
            ================================================= */}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file =
                  e.target.files?.[0];

                if (file) {
                  uploadBackground(file);
                }
              }}
            />

            {/* =================================================
                UPLOAD BUTTON
            ================================================= */}

            <button
              type="button"
              disabled={uploadingBackground}
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/[0.13] py-4 font-semibold text-white shadow-lg backdrop-blur-xl transition hover:bg-white/[0.20] disabled:opacity-50"
            >

              {uploadingBackground ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />

                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />

                  Upload New Image
                </>
              )}

            </button>

            {/* =================================================
                REMOVE
            ================================================= */}

            {backgroundUploadedAt && (
              <button
                type="button"
                onClick={removeBackground}
                disabled={uploadingBackground}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 py-4 font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
              >

                <Trash2 size={18} />

                Remove My Image

              </button>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-white/35">

              Maximum 8MB · JPG, PNG or WebP
              <br />
              New uploads replace your existing image.
              <br />
              Custom images automatically expire after 30 days.

            </p>

          </div>

        </div>

      )}

      {/* =====================================================
          CREATE HOUSE MODAL
      ===================================================== */}

      {showCreateHouse && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              closeCreateHouse();
            }
          }}
        >

          <div
            className="w-full max-w-md rounded-[32px] border border-white/25 bg-slate-900/80 p-7 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="flex items-start justify-between">

              <div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white">

                  <Home size={24} />

                </div>

                <h2 className="mt-4 text-2xl font-semibold text-white">
                  Create House
                </h2>

                <p className="mt-1 text-sm text-white/50">
                  Give your smart home a name.
                </p>

              </div>

              <button
                type="button"
                onClick={closeCreateHouse}
                disabled={creating}
                className="rounded-xl p-2 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >

                <X size={20} />

              </button>

            </div>

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">

                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <p>{error}</p>

              </div>
            )}

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-white/65">
                House Name
              </label>

              <input
                type="text"
                value={houseName}
                onChange={(e) =>
                  setHouseName(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    e.preventDefault();
                    createHouse();
                  }
                }}
                placeholder="e.g. My Home"
                autoFocus
                disabled={creating}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-white outline-none transition placeholder:text-white/25 focus:border-white/40 focus:bg-white/[0.15] focus:ring-2 focus:ring-white/10 disabled:bg-white/5"
              />

            </div>

            <button
              type="button"
              onClick={createHouse}
              disabled={
                creating ||
                !houseName.trim()
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/[0.16] py-4 font-semibold text-white shadow-lg transition hover:bg-white/[0.23] disabled:cursor-not-allowed disabled:opacity-40"
            >

              {creating ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />

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

      {/* =====================================================
          ANIMATION STYLES
      ===================================================== */}

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
            transform: translateX(-35vw);
          }
        }

        @keyframes rainFall {
          0% {
            transform: translateY(-15vh) rotate(15deg);
          }

          100% {
            transform: translateY(120vh) rotate(15deg);
          }
        }

        @keyframes snowFall {
          0% {
            transform: translateY(-20px) translateX(0);
          }

          50% {
            transform: translateY(50vh) translateX(30px);
          }

          100% {
            transform: translateY(110vh) translateX(-20px);
          }
        }

      `}</style>

    </main>
  );
}
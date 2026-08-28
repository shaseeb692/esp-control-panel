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
  sunrise: string;
  sunset: string;
  city: string;
};

type RoomLoad = {
  room: string;
  watts: number;
};

type ThemeMode = "manual-dark" | "manual-light" | "auto";

const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&q=85";

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

  const offset =
    circumference -
    (safeValue / 100) * circumference;

  return (
    <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center">
      <svg
        width="88"
        height="88"
        viewBox="0 0 88 88"
        className="-rotate-90"
      >
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className={
            darkMode
              ? "text-white/10"
              : "text-black/10"
          }
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
          className={
            darkMode
              ? "text-cyan-300"
              : "text-cyan-600"
          }
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Droplets
          size={14}
          className={
            darkMode
              ? "text-cyan-200"
              : "text-cyan-600"
          }
        />

        <span
          className={`mt-0.5 text-lg font-semibold ${
            darkMode
              ? "text-white"
              : "text-black"
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

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const profileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState("");
  const [houses, setHouses] = useState<House[]>([]);

  const [showCreateHouse, setShowCreateHouse] =
    useState(false);

  const [
    showBackgroundSettings,
    setShowBackgroundSettings,
  ] = useState(false);

  const [
    showProfileSettings,
    setShowProfileSettings,
  ] = useState(false);

  const [houseName, setHouseName] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [background, setBackground] =
    useState(DEFAULT_BACKGROUND);

  const [
    uploadingBackground,
    setUploadingBackground,
  ] = useState(false);

  const [
    backgroundUploadedAt,
    setBackgroundUploadedAt,
  ] = useState<string | null>(null);

  const [profileImage, setProfileImage] =
    useState<string | null>(null);

  const [
    uploadingProfile,
    setUploadingProfile,
  ] = useState(false);

  const [weather, setWeather] =
    useState<WeatherData | null>(null);

  const [weatherLoading, setWeatherLoading] =
    useState(true);

  const [roomLoads, setRoomLoads] =
    useState<RoomLoad[]>([]);

  const [thisMonthKwh, setThisMonthKwh] =
    useState(0);

  const [lastMonthKwh, setLastMonthKwh] =
    useState(0);

  const [error, setError] =
    useState("");

  const [themeMode, setThemeMode] =
    useState<ThemeMode>("auto");

  const [darkMode, setDarkMode] =
    useState(true);

  const [themeReady, setThemeReady] =
    useState(false);

  // =====================================================
  // THEME MODE — LOAD SAVED SETTING
  // =====================================================

  useEffect(() => {
    const savedMode =
      localStorage.getItem(
        "smart-home-theme-mode"
      );

    let mode: ThemeMode = "auto";

    if (
      savedMode === "manual-dark" ||
      savedMode === "manual-light" ||
      savedMode === "auto"
    ) {
      mode = savedMode;
    } else {
      const oldTheme =
        localStorage.getItem(
          "smart-home-theme"
        );

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
      if (
        !weather?.sunrise ||
        !weather?.sunset
      ) {
        return weather
          ? !weather.isDay
          : true;
      }

      const now = new Date();

      const sunrise = new Date(
        weather.sunrise
      );

      const sunset = new Date(
        weather.sunset
      );

      const darkStart = new Date(
        sunset.getTime() -
          30 * 60 * 1000
      );

      /*
       * AUTO RULE:
       *
       * Sunrise -> Light
       *
       * 30 minutes before sunset -> Dark
       *
       * Sunset -> Dark
       *
       * Night -> Dark
       */

      if (
        now >= darkStart ||
        now < sunrise
      ) {
        return true;
      }

      return false;
    }

    function applyTheme() {
      let nextDark: boolean;

      if (
        themeMode ===
        "manual-dark"
      ) {
        nextDark = true;
      } else if (
        themeMode ===
        "manual-light"
      ) {
        nextDark = false;
      } else {
        nextDark =
          getAutomaticDarkState();
      }

      setDarkMode(nextDark);

      const html =
        document.documentElement;

      // Main Tailwind class
      html.classList.toggle(
        "dark",
        nextDark
      );

      // Explicit light class too
      html.classList.toggle(
        "light",
        !nextDark
      );

      // Browser native UI / inputs
      html.style.colorScheme =
        nextDark
          ? "dark"
          : "light";

      localStorage.setItem(
        "smart-home-theme-mode",
        themeMode
      );
    }

    applyTheme();

    const interval =
      window.setInterval(
        applyTheme,
        60 * 1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    themeMode,
    weather?.sunrise,
    weather?.sunset,
    weather?.isDay,
    themeReady,
  ]);

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
      setThemeMode(
        darkMode
          ? "manual-light"
          : "manual-dark"
      );

      return;
    }

    setThemeMode("auto");
  }

  function getThemeButtonText() {
    if (themeMode === "auto") {
      return darkMode
        ? "Light"
        : "Dark";
    }

    return "Auto";
  }

  const isAutoMode =
    themeMode === "auto";

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
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          router.replace(
            "/auth/login"
          );
          return;
        }

        setEmail(
          user.email ?? ""
        );

        // =================================================
        // HOUSES
        // =================================================

        const {
          data: housesData,
          error: housesError,
        } =
          await supabase
            .from("houses")
            .select(
              "id, name, created_at"
            )
            .eq(
              "owner_id",
              user.id
            )
            .order(
              "created_at",
              {
                ascending: true,
              }
            );

        if (housesError) {
          setError(
            `Could not load houses: ${housesError.message}`
          );
        } else {
          setHouses(
            housesData ?? []
          );
        }

        // =================================================
        // BACKGROUND
        // =================================================

        const {
          data: backgroundData,
        } =
          await supabase
            .from(
              "dashboard_backgrounds"
            )
            .select(
              "file_path, uploaded_at"
            )
            .eq(
              "user_id",
              user.id
            )
            .maybeSingle();

        if (backgroundData) {
          const uploadedAt =
            new Date(
              backgroundData.uploaded_at
            );

          const age =
            Date.now() -
            uploadedAt.getTime();

          const thirtyDays =
            30 *
            24 *
            60 *
            60 *
            1000;

          if (
            age >=
            thirtyDays
          ) {
            await supabase.storage
              .from(
                "dashboard-backgrounds"
              )
              .remove([
                backgroundData.file_path,
              ]);

            await supabase
              .from(
                "dashboard_backgrounds"
              )
              .delete()
              .eq(
                "user_id",
                user.id
              );

            setBackground(
              DEFAULT_BACKGROUND
            );
          } else {
            const {
              data:
                publicUrlData,
            } =
              supabase.storage
                .from(
                  "dashboard-backgrounds"
                )
                .getPublicUrl(
                  backgroundData.file_path
                );

            if (
              publicUrlData?.publicUrl
            ) {
              setBackground(
                `${publicUrlData.publicUrl}?v=${uploadedAt.getTime()}`
              );
            }

            setBackgroundUploadedAt(
              backgroundData.uploaded_at
            );
          }
        }

        // =================================================
        // PROFILE IMAGE
        // =================================================

        const {
          data: avatarData,
        } =
          await supabase
            .from(
              "profile_avatars"
            )
            .select(
              "file_path"
            )
            .eq(
              "user_id",
              user.id
            )
            .maybeSingle();

        if (avatarData) {
          const {
            data:
              avatarUrlData,
          } =
            supabase.storage
              .from(
                "profile-avatars"
              )
              .getPublicUrl(
                avatarData.file_path
              );

          if (
            avatarUrlData?.publicUrl
          ) {
            setProfileImage(
              `${avatarUrlData.publicUrl}?v=${Date.now()}`
            );
          }
        }

        // =================================================
        // WEATHER
        // =================================================

        await loadWeather();

        // =================================================
        // ENERGY
        // =================================================

        await loadEnergy(
          user.id
        );
      } catch (err) {
        console.error(err);

        setError(
          "Something went wrong while loading the dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  // =====================================================
  // WEATHER
  // =====================================================

  async function loadWeather() {
    try {
      setWeatherLoading(true);

      let latitude = 24.8607;
      let longitude = 67.0011;
      let city = "Karachi";

      if (
        typeof navigator !==
          "undefined" &&
        navigator.geolocation
      ) {
        try {
          const position =
            await new Promise<GeolocationPosition>(
              (
                resolve,
                reject
              ) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  {
                    enableHighAccuracy:
                      false,
                    timeout: 5000,
                    maximumAge:
                      30 *
                      60 *
                      1000,
                  }
                );
              }
            );

          latitude =
            position.coords
              .latitude;

          longitude =
            position.coords
              .longitude;

          try {
            const geoResponse =
              await fetch(
                `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`
              );

            if (
              geoResponse.ok
            ) {
              const geoData =
                await geoResponse.json();

              if (
                geoData
                  ?.results?.[0]
                  ?.name
              ) {
                city =
                  geoData
                    .results[0]
                    .name;
              }
            }
          } catch {}
        } catch {}
      }

      const response =
        await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&daily=sunrise,sunset&forecast_days=1&timezone=auto`
        );

      if (!response.ok) {
        throw new Error(
          "Weather request failed"
        );
      }

      const data =
        await response.json();

      const sunrise =
        data.daily?.sunrise?.[0] ??
        "";

      const sunset =
        data.daily?.sunset?.[0] ??
        "";

      setWeather({
        temperature:
          data.current
            .temperature_2m,

        apparentTemperature:
          data.current
            .apparent_temperature,

        humidity:
          data.current
            .relative_humidity_2m,

        precipitation:
          data.current
            .precipitation,

        weatherCode:
          data.current
            .weather_code,

        windSpeed:
          data.current
            .wind_speed_10m,

        isDay:
          data.current
            .is_day === 1,

        sunrise,
        sunset,
        city,
      });
    } catch (err) {
      console.error(
        "Weather error:",
        err
      );
    } finally {
      setWeatherLoading(
        false
      );
    }
  }

  useEffect(() => {
    const interval =
      window.setInterval(
        loadWeather,
        60 * 1000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, []);

  // =====================================================
  // ENERGY
  // =====================================================

  async function loadEnergy(
    userId: string
  ) {
    try {
      const now =
        new Date();

      const currentMonthStart =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      const lastMonthStart =
        new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "energy_readings"
          )
          .select(
            "room_name, watts, kwh, recorded_at"
          )
          .eq(
            "user_id",
            userId
          )
          .gte(
            "recorded_at",
            lastMonthStart.toISOString()
          );

      if (error) {
        console.error(
          "Energy error:",
          error
        );
        return;
      }

      const currentRoomMap =
        new Map<
          string,
          number
        >();

      let currentKwh = 0;
      let previousKwh = 0;

      for (
        const reading of
          data ?? []
      ) {
        const recorded =
          new Date(
            reading.recorded_at
          );

        const watts =
          Number(
            reading.watts ?? 0
          );

        const kwh =
          Number(
            reading.kwh ?? 0
          );

        if (
          recorded >=
          currentMonthStart
        ) {
          currentKwh += kwh;

          currentRoomMap.set(
            reading.room_name,
            Math.max(
              currentRoomMap.get(
                reading.room_name
              ) ?? 0,
              watts
            )
          );
        } else {
          previousKwh += kwh;
        }
      }

      setThisMonthKwh(
        currentKwh
      );

      setLastMonthKwh(
        previousKwh
      );

      setRoomLoads(
        Array.from(
          currentRoomMap.entries()
        )
          .map(
            ([room, watts]) => ({
              room,
              watts,
            })
          )
          .sort(
            (a, b) =>
              b.watts -
              a.watts
          )
      );
    } catch (err) {
      console.error(err);
    }
  }

  // =====================================================
  // PROFILE UPLOAD
  // =====================================================

  async function uploadProfile(
    file: File
  ) {
    setError("");

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "Please select an image."
      );
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        "Profile image must be smaller than 5MB."
      );
      return;
    }

    setUploadingProfile(
      true
    );

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace(
          "/auth/login"
        );
        return;
      }

      const filePath =
        `${user.id}/profile.jpg`;

      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            "profile-avatars"
          )
          .upload(
            filePath,
            file,
            {
              cacheControl:
                "3600",
              contentType:
                "image/jpeg",
              upsert: true,
            }
          );

      if (uploadError) {
        throw uploadError;
      }

      const {
        error:
          dbError,
      } =
        await supabase
          .from(
            "profile_avatars"
          )
          .upsert(
            {
              user_id:
                user.id,
              file_path:
                filePath,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "user_id",
            }
          );

      if (dbError) {
        throw dbError;
      }

      const {
        data:
          publicUrlData,
      } =
        supabase.storage
          .from(
            "profile-avatars"
          )
          .getPublicUrl(
            filePath
          );

      if (
        publicUrlData?.publicUrl
      ) {
        setProfileImage(
          `${publicUrlData.publicUrl}?v=${Date.now()}`
        );
      }

      setShowProfileSettings(
        false
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not upload profile image."
      );
    } finally {
      setUploadingProfile(
        false
      );

      if (
        profileInputRef.current
      ) {
        profileInputRef.current.value =
          "";
      }
    }
  }

  // =====================================================
  // BACKGROUND UPLOAD
  // =====================================================

  async function uploadBackground(
    file: File
  ) {
    setError("");

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "Please select an image file."
      );
      return;
    }

    if (
      file.size >
      8 * 1024 * 1024
    ) {
      setError(
        "Image must be smaller than 8MB."
      );
      return;
    }

    setUploadingBackground(
      true
    );

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace(
          "/auth/login"
        );
        return;
      }

      const filePath =
        `${user.id}/background.jpg`;

      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            "dashboard-backgrounds"
          )
          .upload(
            filePath,
            file,
            {
              cacheControl:
                "3600",
              contentType:
                file.type,
              upsert: true,
            }
          );

      if (uploadError) {
        throw uploadError;
      }

      const uploadedAt =
        new Date().toISOString();

      const {
        error:
          dbError,
      } =
        await supabase
          .from(
            "dashboard_backgrounds"
          )
          .upsert(
            {
              user_id:
                user.id,
              file_path:
                filePath,
              uploaded_at:
                uploadedAt,
            },
            {
              onConflict:
                "user_id",
            }
          );

      if (dbError) {
        throw dbError;
      }

      const {
        data:
          publicUrlData,
      } =
        supabase.storage
          .from(
            "dashboard-backgrounds"
          )
          .getPublicUrl(
            filePath
          );

      if (
        publicUrlData?.publicUrl
      ) {
        setBackground(
          `${publicUrlData.publicUrl}?v=${Date.now()}`
        );
      }

      setBackgroundUploadedAt(
        uploadedAt
      );

      setShowBackgroundSettings(
        false
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not upload background image."
      );
    } finally {
      setUploadingBackground(
        false
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
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
      } =
        await supabase.auth.getUser();

      if (!user) return;

      const filePath =
        `${user.id}/background.jpg`;

      await supabase.storage
        .from(
          "dashboard-backgrounds"
        )
        .remove([
          filePath,
        ]);

      await supabase
        .from(
          "dashboard_backgrounds"
        )
        .delete()
        .eq(
          "user_id",
          user.id
        );

      setBackground(
        DEFAULT_BACKGROUND
      );

      setBackgroundUploadedAt(
        null
      );
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
    setShowCreateHouse(
      true
    );
  }

  function closeCreateHouse() {
    if (creating) return;

    setShowCreateHouse(
      false
    );

    setHouseName("");
  }

  async function createHouse() {
    setError("");

    const name =
      houseName.trim();

    if (!name) {
      setError(
        "Please enter a house name."
      );
      return;
    }

    setCreating(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace(
          "/auth/login"
        );
        return;
      }

      const slug =
        name
          .toLowerCase()
          .trim()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            ""
          );

      const {
        data,
        error:
          insertError,
      } =
        await supabase
          .from("houses")
          .insert({
            owner_id:
              user.id,
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

      setHouses(
        current => [
          ...current,
          data,
        ]
      );

      setShowCreateHouse(
        false
      );

      setHouseName("");
    } catch (err) {
      console.error(err);

      setError(
        "Could not create house."
      );
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
      router.replace(
        "/auth/login"
      );
    }
  }

  // =====================================================
  // WEATHER / ENERGY
  // =====================================================

  const weatherType =
    weather
      ? getWeatherInfo(
          weather.weatherCode
        ).type
      : "cloudy";

  const night =
    weather
      ? !weather.isDay
      : false;

  const energyChange =
    lastMonthKwh > 0
      ? ((thisMonthKwh -
          lastMonthKwh) /
          lastMonthKwh) *
        100
      : 0;

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
            {[1, 2, 3, 4, 5, 6].map(
              item => (
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

  // =====================================================
  // GLASS COLORS
  // =====================================================

  const glass =
    darkMode
      ? "border-white/15 bg-black/[0.30] text-white"
      : "border-black/10 bg-white/[0.55] text-black";

  const glassSoft =
    darkMode
      ? "border-white/10 bg-white/[0.07]"
      : "border-black/10 bg-white/[0.45]";

  const muted =
    darkMode
      ? "text-white/50"
      : "text-black/50";

  return (
    <main
      className={`relative min-h-screen overflow-hidden transition-colors duration-700 ${
        darkMode
          ? "bg-slate-950 text-white"
          : "bg-white text-black"
      }`}
    >
      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div
        className="fixed inset-0 bg-cover bg-center transition-all duration-1000"
        style={{
          backgroundImage:
            `url("${background}")`,
        }}
      />

      <div
        className={`fixed inset-0 transition-all duration-1000 ${
          !darkMode
            ? "bg-white/65"
            : night
            ? "bg-slate-950/70"
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
          <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-indigo-950/50 via-slate-950/30 to-black/60" />

          <SunMoonIcon />

          <div className="pointer-events-none fixed inset-0">
            {[
              1, 2, 3, 4, 5,
              6, 7, 8, 9, 10,
            ].map(star => (
              <span
                key={star}
                className="absolute h-1 w-1 animate-pulse rounded-full bg-white"
                style={{
                  left: `${8 + star * 8}%`,
                  top: `${7 + (star % 5) * 12}%`,
                  animationDelay:
                    `${star * 300}ms`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* =================================================
          CLOUDS
      ================================================= */}

      {[
        "cloudy",
        "rain",
        "storm",
      ].includes(
        weatherType
      ) && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <Cloud
            className={`absolute -left-40 top-[12%] animate-[cloudMove_38s_linear_infinite] ${
              darkMode
                ? "text-white/20"
                : "text-black/10"
            }`}
            size={180}
          />

          <Cloud
            className={`absolute -left-52 top-[32%] animate-[cloudMove_55s_linear_infinite] ${
              darkMode
                ? "text-white/15"
                : "text-black/10"
            }`}
            size={250}
          />

          <Cloud
            className={`absolute -right-52 top-[8%] animate-[cloudMoveReverse_46s_linear_infinite] ${
              darkMode
                ? "text-white/15"
                : "text-black/10"
            }`}
            size={210}
          />
        </div>
      )}

      {/* =================================================
          RAIN
      ================================================= */}

      {[
        "rain",
        "storm",
      ].includes(
        weatherType
      ) && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-45">
          {Array.from({
            length: 90,
          }).map(
            (_, index) => (
              <span
                key={index}
                className={`absolute top-[-30px] h-20 w-px rotate-[15deg] animate-[rainFall_800ms_linear_infinite] ${
                  darkMode
                    ? "bg-white/60"
                    : "bg-black/20"
                }`}
                style={{
                  left: `${(index * 19) % 100}%`,
                  animationDelay:
                    `${(index * 43) % 1000}ms`,
                }}
              />
            )
          )}
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
              onClick={() =>
                setShowProfileSettings(
                  true
                )
              }
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
                    darkMode
                      ? "text-white/80"
                      : "text-black/70"
                  }`}
                >
                  <User size={22} />
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                <Camera
                  size={17}
                  className="text-white"
                />
              </div>
            </button>

            <div>
              <p className="text-sm font-semibold">
                Welcome
              </p>

              <p
                className={`max-w-[220px] truncate text-xs ${muted}`}
              >
                {email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">

            {/* THEME STATUS */}

            <div
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 backdrop-blur-xl ${
                darkMode
                  ? "border-white/15 bg-white/5"
                  : "border-black/10 bg-black/5"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isAutoMode
                    ? "bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.9)]"
                    : "bg-red-400"
                }`}
              />

              <span className="whitespace-nowrap text-xs font-semibold">
                {isAutoMode
                  ? "Auto Mode"
                  : "Manual Mode"}
              </span>
            </div>

            {/* THEME BUTTON */}

            <button
              type="button"
              onClick={
                cycleThemeMode
              }
              title={
                isAutoMode
                  ? `Auto mode · Click for ${
                      darkMode
                        ? "Manual Light"
                        : "Manual Dark"
                    }`
                  : "Click to return to Auto"
              }
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold backdrop-blur-xl transition-all duration-300 ${
                darkMode
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/10 text-black hover:bg-black/15"
              }`}
            >
              {darkMode ? (
                <SunMedium
                  size={17}
                />
              ) : (
                <MoonStar
                  size={17}
                />
              )}

              <span>
                {getThemeButtonText()}
              </span>
            </button>

            {/* BACKGROUND */}

            <button
              type="button"
              onClick={() =>
                setShowBackgroundSettings(
                  true
                )
              }
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold backdrop-blur-xl transition ${
                darkMode
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/10 text-black hover:bg-black/15"
              }`}
            >
              <ImageIcon size={16} />

              <span className="hidden sm:inline">
                Background
              </span>
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

              <span className="hidden sm:inline">
                Logout
              </span>
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
            <div
              className={`rounded-[26px] border p-5 ${glassSoft}`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div
                    className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${muted} ${
                      darkMode
                        ? "border-white/10 bg-white/5"
                        : "border-black/10 bg-black/5"
                    }`}
                  >
                    Current weather
                  </div>

                  {weatherLoading ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Loader2
                        size={20}
                        className="animate-spin"
                      />

                      <span
                        className={
                          muted
                        }
                      >
                        Loading weather...
                      </span>
                    </div>
                  ) : weather ? (
                    <>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-5xl font-semibold tracking-tight">
                          {Math.round(
                            weather.temperature
                          )}
                          °
                        </span>

                        <WeatherIcon
                          code={
                            weather.weatherCode
                          }
                          size={45}
                        />
                      </div>

                      <p
                        className={`mt-1 text-sm ${muted}`}
                      >
                        {
                          getWeatherInfo(
                            weather.weatherCode
                          ).label
                        }
                      </p>
                    </>
                  ) : (
                    <p
                      className={`mt-3 text-sm ${muted}`}
                    >
                      Weather unavailable
                    </p>
                  )}
                </div>

                {weather && (
                  <div className="text-left sm:text-right">
                    <p
                      className={`text-xs ${muted}`}
                    >
                      Feels like
                    </p>

                    <p className="mt-1 text-2xl font-semibold">
                      {Math.round(
                        weather.apparentTemperature
                      )}
                      °
                    </p>

                    <div
                      className={`mt-2 flex items-center gap-1 text-xs ${muted} sm:justify-end`}
                    >
                      <MapPin
                        size={12}
                      />

                      {weather.city}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">

              {/* HUMIDITY */}

              <div
                className={`flex min-h-[130px] flex-col items-center justify-center rounded-[24px] border p-3 ${glassSoft}`}
              >
                <HumidityGauge
                  value={
                    weather?.humidity ??
                    0
                  }
                  darkMode={
                    darkMode
                  }
                />

                <p
                  className={`mt-1 text-xs font-medium ${muted}`}
                >
                  Humidity
                </p>
              </div>

              {/* WIND */}

              <div
                className={`flex min-h-[130px] flex-col justify-center rounded-[24px] border p-4 ${glassSoft}`}
              >
                <Wind
                  size={20}
                  className={
                    darkMode
                      ? "text-cyan-200"
                      : "text-cyan-600"
                  }
                />

                <p
                  className={`mt-3 text-xs ${muted}`}
                >
                  Wind
                </p>

                <p className="mt-1 text-xl font-semibold">
                  {weather
                    ? Math.round(
                        weather.windSpeed
                      )
                    : 0}{" "}
                  <span className="text-xs font-normal opacity-60">
                    km/h
                  </span>
                </p>
              </div>

              {/* RAIN */}

              <div
                className={`flex min-h-[130px] flex-col justify-center rounded-[24px] border p-4 ${glassSoft}`}
              >
                <CloudRain
                  size={20}
                  className={
                    darkMode
                      ? "text-cyan-200"
                      : "text-cyan-600"
                  }
                />

                <p
                  className={`mt-3 text-xs ${muted}`}
                >
                  Rain
                </p>

                <p className="mt-1 text-xl font-semibold">
                  {weather?.precipitation ??
                    0}{" "}
                  <span className="text-xs font-normal opacity-60">
                    mm
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* CONNECTED HOMES */}

          <div
            className={`rounded-[34px] border p-6 shadow-2xl backdrop-blur-2xl ${glass}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className={`text-xs uppercase tracking-[0.18em] ${muted}`}
                >
                  Smart Home
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  Connected Homes
                </h2>
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
              <p className="text-5xl font-semibold">
                {houses.length}
              </p>

              <p
                className={`mt-2 text-sm ${muted}`}
              >
                {houses.length ===
                1
                  ? "home connected"
                  : "homes connected"}
              </p>
            </div>

            <div
              className={`mt-8 flex items-center justify-between border-t pt-4 ${
                darkMode
                  ? "border-white/10"
                  : "border-black/10"
              }`}
            >
              <span
                className={`text-xs ${muted}`}
              >
                Connected
              </span>

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

            <p
              className={`mt-2 max-w-xl text-sm leading-6 ${muted}`}
            >
              Manage your homes, rooms
              and connected devices from
              one place.
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
                <p
                  className={`text-xs uppercase tracking-[0.18em] ${muted}`}
                >
                  Live energy
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  Current Load
                </h2>
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

            {roomLoads.length ===
            0 ? (
              <div
                className={`mt-6 rounded-2xl border p-5 text-sm ${glassSoft} ${muted}`}
              >
                Waiting for device
                energy sensors...
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {roomLoads.map(
                  room => (
                    <div
                      key={
                        room.room
                      }
                      className={`flex items-center justify-between rounded-2xl border p-4 ${glassSoft}`}
                    >
                      <div>
                        <p className="font-medium">
                          {
                            room.room
                          }
                        </p>

                        <p
                          className={`mt-1 text-xs ${muted}`}
                        >
                          Current load
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xl font-semibold">
                          {Math.round(
                            room.watts
                          )}
                          W
                        </p>

                        <div className="mt-1 flex items-center justify-end gap-1 text-xs text-green-500 dark:text-green-300">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                          Live
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              navigateWithTransition(
                () =>
                  router.push(
                    "/energy"
                  )
              )
            }
            className={`group rounded-[30px] border p-6 text-left shadow-xl backdrop-blur-2xl transition hover:-translate-y-1 ${glass}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-xs uppercase tracking-[0.18em] ${muted}`}
                >
                  Energy
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  This Month
                </h2>
              </div>

              <BarChart3
                size={22}
                className={
                  darkMode
                    ? "text-cyan-200"
                    : "text-cyan-600"
                }
              />
            </div>

            <p className="mt-7 text-4xl font-semibold">
              {thisMonthKwh.toFixed(
                1
              )}

              <span
                className={`ml-1 text-lg ${muted}`}
              >
                kWh
              </span>
            </p>

            <div className="mt-5 flex items-center justify-between">
              <div
                className={`flex items-center gap-1 text-sm ${
                  energyChange >
                  0
                    ? "text-red-500 dark:text-red-300"
                    : "text-green-500 dark:text-green-300"
                }`}
              >
                {energyChange >
                0 ? (
                  <TrendingUp
                    size={16}
                  />
                ) : (
                  <TrendingDown
                    size={16}
                  />
                )}

                {Math.abs(
                  energyChange
                ).toFixed(1)}
                %
              </div>

              <span
                className={`text-xs ${muted}`}
              >
                vs last month
              </span>
            </div>

            <div
              className={`mt-6 border-t pt-4 text-xs ${muted} ${
                darkMode
                  ? "border-white/10"
                  : "border-black/10"
              }`}
            >
              Open detailed energy
              analytics →
            </div>
          </button>
        </section>

        {/* =================================================
            HOUSE HEADER
        ================================================= */}

        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Your Houses
            </h2>

            <p
              className={`mt-1 text-sm ${muted}`}
            >
              Manage your smart homes
            </p>
          </div>

          <button
            type="button"
            onClick={
              openCreateHouse
            }
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-lg backdrop-blur-xl transition ${
              darkMode
                ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                : "border-black/10 bg-white/50 text-black hover:bg-white/70"
            }`}
          >
            <Plus size={18} />

            <span className="hidden sm:inline">
              Create House
            </span>
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

            <h3 className="mt-5 text-lg font-semibold">
              No houses yet
            </h3>

            <p
              className={`mx-auto mt-2 max-w-sm text-sm leading-6 ${muted}`}
            >
              Create your first house
              to start adding rooms
              and ESP devices.
            </p>

            <button
              type="button"
              onClick={
                openCreateHouse
              }
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
            {houses.map(
              house => (
                <button
                  type="button"
                  key={
                    house.id
                  }
                  onClick={() =>
                    navigateWithTransition(
                      () =>
                        router.push(
                          `/house/${house.id}`
                        )
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
                      <ArrowUpRight
                        size={19}
                      />
                    </div>
                  </div>

                  <div className="mt-7">
                    <h3 className="text-xl font-semibold">
                      {
                        house.name
                      }
                    </h3>

                    <p
                      className={`mt-1 text-sm ${muted}`}
                    >
                      Smart home
                    </p>
                  </div>

                  <div
                    className={`mt-6 flex items-center justify-between border-t pt-4 ${
                      darkMode
                        ? "border-white/10"
                        : "border-black/10"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${muted}`}
                    >
                      House
                    </span>

                    <span className="text-xs font-medium opacity-70">
                      Open house →
                    </span>
                  </div>
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* =================================================
          PROFILE MODAL
      ================================================= */}

      {showProfileSettings && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
          onMouseDown={e => {
            if (
              e.target ===
              e.currentTarget
            ) {
              setShowProfileSettings(
                false
              );
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-[32px] border p-7 shadow-2xl backdrop-blur-2xl ${
              darkMode
                ? "border-white/20 bg-slate-900/90 text-white"
                : "border-black/10 bg-white/90 text-black"
            }`}
            onMouseDown={e =>
              e.stopPropagation()
            }
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

                <h2 className="mt-4 text-2xl font-semibold">
                  Profile Picture
                </h2>

                <p
                  className={`mt-1 text-sm ${
                    darkMode
                      ? "text-white/45"
                      : "text-black/45"
                  }`}
                >
                  Upload your profile
                  picture.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowProfileSettings(
                    false
                  )
                }
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
                    src={
                      profileImage
                    }
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center ${
                      darkMode
                        ? "text-white/30"
                        : "text-black/30"
                    }`}
                  >
                    <User
                      size={45}
                    />
                  </div>
                )}
              </div>
            </div>

            <input
              ref={
                profileInputRef
              }
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file =
                  e.target.files?.[0];

                if (file) {
                  uploadProfile(
                    file
                  );
                }
              }}
            />

            <button
              type="button"
              disabled={
                uploadingProfile
              }
              onClick={() =>
                profileInputRef.current?.click()
              }
              className={`mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-semibold disabled:opacity-50 ${
                darkMode
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/5 text-black hover:bg-black/10"
              }`}
            >
              {uploadingProfile ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera size={18} />
                  Upload Profile
                  Picture
                </>
              )}
            </button>

            <p
              className={`mt-5 text-center text-xs ${
                darkMode
                  ? "text-white/30"
                  : "text-black/30"
              }`}
            >
              Maximum 5MB.
              <br />
              New picture replaces the
              previous one.
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
          onMouseDown={e => {
            if (
              e.target ===
              e.currentTarget
            ) {
              setShowBackgroundSettings(
                false
              );
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-[32px] border p-7 shadow-2xl backdrop-blur-2xl ${
              darkMode
                ? "border-white/20 bg-slate-900/90 text-white"
                : "border-black/10 bg-white/90 text-black"
            }`}
            onMouseDown={e =>
              e.stopPropagation()
            }
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
                  <ImageIcon
                    size={24}
                  />
                </div>

                <h2 className="mt-4 text-2xl font-semibold">
                  Dashboard
                  Background
                </h2>

                <p
                  className={`mt-1 text-sm leading-6 ${
                    darkMode
                      ? "text-white/50"
                      : "text-black/50"
                  }`}
                >
                  Your image
                  automatically expires
                  after 30 days.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowBackgroundSettings(
                    false
                  )
                }
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
                backgroundImage:
                  `url("${background}")`,
              }}
            />

            {backgroundUploadedAt && (
              <p
                className={`mt-3 text-xs ${
                  darkMode
                    ? "text-white/40"
                    : "text-black/40"
                }`}
              >
                Uploaded{" "}
                {new Date(
                  backgroundUploadedAt
                ).toLocaleDateString()}
              </p>
            )}

            <input
              ref={
                fileInputRef
              }
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file =
                  e.target.files?.[0];

                if (file) {
                  uploadBackground(
                    file
                  );
                }
              }}
            />

            <button
              type="button"
              disabled={
                uploadingBackground
              }
              onClick={() =>
                fileInputRef.current?.click()
              }
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-semibold disabled:opacity-50 ${
                darkMode
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/5 text-black hover:bg-black/10"
              }`}
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
                  <Upload
                    size={18}
                  />
                  Upload New
                  Image
                </>
              )}
            </button>

            {backgroundUploadedAt && (
              <button
                type="button"
                onClick={
                  removeBackground
                }
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 py-4 font-semibold text-red-700 hover:bg-red-500/20 dark:text-red-100"
              >
                <Trash2
                  size={18}
                />
                Remove My Image
              </button>
            )}

            <p
              className={`mt-5 text-center text-xs ${
                darkMode
                  ? "text-white/30"
                  : "text-black/30"
              }`}
            >
              Maximum 8MB · JPG,
              PNG or WebP
              <br />
              New uploads replace your
              existing image.
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
          onMouseDown={e => {
            if (
              e.target ===
              e.currentTarget
            ) {
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
            onMouseDown={e =>
              e.stopPropagation()
            }
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

                <h2 className="mt-4 text-2xl font-semibold">
                  Create House
                </h2>

                <p
                  className={`mt-1 text-sm ${
                    darkMode
                      ? "text-white/45"
                      : "text-black/45"
                  }`}
                >
                  Give your smart
                  home a name.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCreateHouse
                }
                disabled={
                  creating
                }
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
                  darkMode
                    ? "text-white/60"
                    : "text-black/60"
                }`}
              >
                House Name
              </label>

              <input
                type="text"
                value={
                  houseName
                }
                onChange={e =>
                  setHouseName(
                    e.target
                      .value
                  )
                }
                onKeyDown={e => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    e.preventDefault();
                    createHouse();
                  }
                }}
                placeholder="e.g. My Home"
                autoFocus
                disabled={
                  creating
                }
                className={`w-full rounded-2xl border px-4 py-4 outline-none ${
                  darkMode
                    ? "border-white/10 bg-white/10 text-white placeholder:text-white/25 focus:border-white/20 focus:bg-white/15"
                    : "border-black/10 bg-black/5 text-black placeholder:text-black/25 focus:border-black/20 focus:bg-black/10"
                }`}
              />
            </div>

            <button
              type="button"
              onClick={
                createHouse
              }
              disabled={
                creating ||
                !houseName.trim()
              }
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-semibold disabled:opacity-40 ${
                darkMode
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/20"
                  : "border-black/10 bg-black/5 text-black hover:bg-black/10"
              }`}
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
            transform: translateY(-30px)
              rotate(15deg);
          }

          100% {
            transform: translateY(115vh)
              rotate(15deg);
          }
        }
      `}</style>
    </main>
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

function Cloud({
  className,
  size,
}: {
  className?: string;
  size?: number;
}) {
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
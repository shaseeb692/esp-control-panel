"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Home,
  Plus,
  LogOut,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";

type House = {
  id: string;
  name: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [houses, setHouses] = useState<House[]>([]);

  const [showCreateHouse, setShowCreateHouse] =
    useState(false);

  const [houseName, setHouseName] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        // -------------------------------------------------
        // GET CURRENT USER
        // -------------------------------------------------

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("User error:", userError);
          router.replace("/auth/login");
          return;
        }

        if (!user) {
          router.replace("/auth/login");
          return;
        }

        setEmail(user.email ?? "");

        // -------------------------------------------------
        // GET USER HOUSES
        // -------------------------------------------------

        const {
          data,
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
          setHouses(data ?? []);
        }
      } catch (err) {
        console.error("Dashboard error:", err);

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
  // OPEN CREATE HOUSE
  // =====================================================

  function openCreateHouse() {
    console.log("CREATE HOUSE BUTTON CLICKED");

    setError("");
    setHouseName("");
    setShowCreateHouse(true);
  }

  // =====================================================
  // CLOSE CREATE HOUSE
  // =====================================================

  function closeCreateHouse() {
    if (creating) return;

    setShowCreateHouse(false);
    setHouseName("");
  }

  // =====================================================
  // CREATE HOUSE
  // =====================================================

  async function createHouse() {
    console.log("CREATE HOUSE SUBMIT");

    setError("");

    const name = houseName.trim();

    if (!name) {
      setError("Please enter a house name.");
      return;
    }

    setCreating(true);

    try {
      // -------------------------------------------------
      // GET CURRENT USER
      // -------------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          "Get user error:",
          userError
        );

        setError(userError.message);
        return;
      }

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      console.log(
        "Creating house for user:",
        user.id
      );

      // -------------------------------------------------
      // INSERT HOUSE
      // -------------------------------------------------

      const {
        data,
        error: insertError,
      } = await supabase
        .from("houses")
       .insert({
  owner_id: user.id,
  name: name,
  slug: name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, ""),
})
        .select("id, name, created_at")
        .single();

      if (insertError) {
        console.error(
          "Create house error:",
          insertError
        );

        setError(
          `Could not create house: ${insertError.message}`
        );

        return;
      }

      console.log(
        "House created successfully:",
        data
      );

      // -------------------------------------------------
      // ADD TO UI
      // -------------------------------------------------

      setHouses((current) => [
        ...current,
        data,
      ]);

      // -------------------------------------------------
      // RESET
      // -------------------------------------------------

      setHouseName("");
      setShowCreateHouse(false);
    } catch (err) {
      console.error(
        "Create house exception:",
        err
      );

      setError(
        "Something went wrong while creating the house."
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
      router.replace("/auth/login");
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fbfc]">

        <div className="text-center">

          <Loader2
            size={34}
            className="mx-auto animate-spin text-[#42B8C5]"
          />

          <p className="mt-4 text-sm text-slate-400">
            Loading dashboard...
          </p>

        </div>

      </main>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <main className="min-h-screen bg-[#f7fbfc] px-4 py-6 sm:px-6">

      <div className="mx-auto max-w-6xl">

        {/* =================================================
            TOP HEADER
        ================================================= */}

        <div className="mb-7 flex flex-col gap-5 rounded-[30px] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">

          <div>

            <p className="text-xs font-semibold tracking-[0.2em] text-[#42B8C5]">
              SMART HOME
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-slate-700">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              {email}
            </p>

          </div>

          <button
            type="button"
            onClick={logout}
            className="flex w-fit items-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >

            <LogOut size={17} />

            Logout

          </button>

        </div>

        {/* =================================================
            GLOBAL ERROR
        ================================================= */}

        {error && !showCreateHouse && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">

            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p>{error}</p>

          </div>
        )}

        {/* =================================================
            HOUSE HEADER
        ================================================= */}

        <div className="mb-5 flex items-center justify-between gap-4">

          <div>

            <h2 className="text-xl font-semibold text-slate-700">
              Your Houses
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Manage your smart homes
            </p>

          </div>

          <button
            type="button"
            onClick={openCreateHouse}
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-[#42B8C5] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >

            <Plus size={18} />

            Create House

          </button>

        </div>

        {/* =================================================
            HOUSES
        ================================================= */}

        {houses.length === 0 ? (

          <div className="rounded-[30px] border border-dashed border-slate-200 bg-white p-12 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5]">

              <Home size={30} />

            </div>

            <h3 className="mt-5 text-lg font-semibold text-slate-700">
              No houses yet
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
              Create your first house to start adding rooms and ESP devices.
            </p>

            <button
              type="button"
              onClick={openCreateHouse}
              className="mt-6 flex items-center justify-center gap-2 mx-auto rounded-2xl bg-[#42B8C5] px-6 py-3 font-semibold text-white transition hover:opacity-90"
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
                  router.push(
                    `/house/${house.id}`
                  )
                }
                className="group rounded-[28px] bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5]">

                  <Home size={27} />

                </div>

                <h3 className="mt-5 text-lg font-semibold text-slate-700">
                  {house.name}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Open house →
                </p>

              </button>

            ))}

          </div>

        )}

      </div>

      {/* =====================================================
          CREATE HOUSE MODAL
      ===================================================== */}

      {showCreateHouse && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeCreateHouse();
            }
          }}
        >

          <div
            className="w-full max-w-md rounded-[30px] bg-white p-7 shadow-2xl"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="flex items-start justify-between">

              <div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5]">

                  <Home size={24} />

                </div>

                <h2 className="mt-4 text-2xl font-semibold text-slate-700">
                  Create House
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Give your smart home a name.
                </p>

              </div>

              <button
                type="button"
                onClick={closeCreateHouse}
                disabled={creating}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >

                <X size={20} />

              </button>

            </div>

            {/* ERROR */}

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">

                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <p>{error}</p>

              </div>
            )}

            {/* INPUT */}

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-500">
                House Name
              </label>

              <input
                type="text"
                value={houseName}
                onChange={(e) =>
                  setHouseName(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createHouse();
                  }
                }}
                placeholder="e.g. My Home"
                autoFocus
                disabled={creating}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#42B8C5] focus:ring-2 focus:ring-[#42B8C5]/10 disabled:bg-slate-50"
              />

            </div>

            {/* CREATE */}

            <button
              type="button"
              onClick={createHouse}
              disabled={
                creating ||
                !houseName.trim()
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#42B8C5] py-4 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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

    </main>
  );
}
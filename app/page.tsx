"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Plus,
  LogOut,
  Loader2,
  Building2,
  ChevronRight,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  name: string | null;
};

type House = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [houses, setHouses] = useState<House[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingHouse, setCreatingHouse] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingHouse, setDeletingHouse] = useState(false);

  const [showAddHouse, setShowAddHouse] = useState(false);
  const [showDeleteHouse, setShowDeleteHouse] = useState(false);

  const [houseName, setHouseName] = useState("");
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/auth/login");
          return;
        }

        const userId = session.user.id;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("id", userId)
          .single();

        if (profileData) {
          setProfile(profileData);
        }

        const { data: housesData, error: housesError } =
          await supabase
            .from("houses")
            .select("id, name, slug, created_at")
            .eq("owner_id", userId)
            .order("created_at", {
              ascending: true,
            });

        if (housesError) {
          throw housesError;
        }

        setHouses(housesData || []);
      } catch (err: any) {
        console.error(err);

        setError(
          err?.message || "Unable to load your dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function handleAddHouse() {
    setError("");

    const cleanName = houseName.trim();

    if (!cleanName) {
      setError("Please enter a house name.");
      return;
    }

    const slug = createSlug(cleanName);

    if (!slug) {
      setError("Please enter a valid house name.");
      return;
    }

    setCreatingHouse(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const { data, error: insertError } =
        await supabase
          .from("houses")
          .insert({
            owner_id: session.user.id,
            name: cleanName,
            slug,
          })
          .select("id, name, slug, created_at")
          .single();

      if (insertError) {
        if (insertError.code === "23505") {
          setError(
            "You already have a house with this name."
          );
        } else {
          setError(insertError.message);
        }

        return;
      }

      if (data) {
        setHouses((current) => [...current, data]);
      }

      setHouseName("");
      setShowAddHouse(false);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Something went wrong while creating the house."
      );
    } finally {
      setCreatingHouse(false);
    }
  }

  function openDeleteHouse(house: House) {
    setSelectedHouse(house);
    setError("");
    setShowDeleteHouse(true);
  }

  async function handleDeleteHouse() {
    if (!selectedHouse) return;

    setDeletingHouse(true);
    setError("");

    try {
      const houseId = selectedHouse.id;

      /*
       * GET ROOMS
       */

      const { data: rooms, error: roomsError } =
        await supabase
          .from("rooms")
          .select("id")
          .eq("house_id", houseId);

      if (roomsError) {
        throw roomsError;
      }

      const roomIds = (rooms || []).map(
        (room) => room.id
      );

      /*
       * GET DEVICES
       */

      if (roomIds.length > 0) {
        const { data: devices, error: devicesError } =
          await supabase
            .from("devices")
            .select("id, device_id")
            .in("room_id", roomIds);

        if (devicesError) {
          throw devicesError;
        }

        const deviceUuidIds = (devices || []).map(
          (device) => device.id
        );

        const deviceIds = (devices || []).map(
          (device) => device.device_id
        );

        /*
         * DELETE RUNTIME
         */

        if (deviceIds.length > 0) {
          const { error: runtimeError } =
            await supabase
              .from("device_runtime")
              .delete()
              .in("device_id", deviceIds);

          if (runtimeError) {
            throw runtimeError;
          }

          /*
           * DELETE MESSAGES
           */

          const { error: messagesError } =
            await supabase
              .from("messages")
              .delete()
              .in("device_id", deviceIds);

          if (messagesError) {
            throw messagesError;
          }
        }

        /*
         * DELETE DEVICES
         */

        if (deviceUuidIds.length > 0) {
          const { error: devicesDeleteError } =
            await supabase
              .from("devices")
              .delete()
              .in("id", deviceUuidIds);

          if (devicesDeleteError) {
            throw devicesDeleteError;
          }
        }

        /*
         * DELETE ROOMS
         */

        const { error: roomsDeleteError } =
          await supabase
            .from("rooms")
            .delete()
            .in("id", roomIds);

        if (roomsDeleteError) {
          throw roomsDeleteError;
        }
      }

      /*
       * DELETE HOUSE MEMBERS
       */

      const { error: membersError } =
        await supabase
          .from("house_members")
          .delete()
          .eq("house_id", houseId);

      if (membersError) {
        throw membersError;
      }

      /*
       * DELETE HOUSE
       */

      const { error: houseDeleteError } =
        await supabase
          .from("houses")
          .delete()
          .eq("id", houseId);

      if (houseDeleteError) {
        throw houseDeleteError;
      }

      /*
       * UPDATE UI
       */

      setHouses((current) =>
        current.filter(
          (house) => house.id !== houseId
        )
      );

      setSelectedHouse(null);
      setShowDeleteHouse(false);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message || "Unable to delete this house."
      );
    } finally {
      setDeletingHouse(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await supabase.auth.signOut();

      router.replace("/auth/login");
      router.refresh();
    } catch (err) {
      console.error(err);
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <Loader2
            size={34}
            className="mx-auto animate-spin text-cyan-400"
          />

          <p className="mt-3 text-sm text-slate-400">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">

        {/* HEADER */}

        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <Home size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  ESP Control Center
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Master Dashboard
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm sm:block">
              <span className="text-slate-400">
                Welcome,{" "}
              </span>

              <span className="font-medium text-white">
                {profile?.name || "User"}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <LogOut size={16} />
              )}

              Logout
            </button>
          </div>
        </header>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* SUMMARY */}

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Houses"
            value={houses.length.toString()}
            icon={<Building2 size={20} />}
          />

          <SummaryCard
            title="Rooms"
            value="—"
            icon={<Home size={20} />}
          />

          <SummaryCard
            title="Devices"
            value="—"
            icon={<Building2 size={20} />}
          />
        </section>

        {/* HOUSE SECTION */}

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Your Houses
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage your homes and connected devices.
              </p>
            </div>

            <button
              onClick={() => {
                setError("");
                setShowAddHouse(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              <Plus size={18} />
              Add House
            </button>
          </div>

          {houses.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                <Home size={30} />
              </div>

              <h3 className="mt-5 text-xl font-semibold">
                No house added yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Add your first house to start managing
                rooms, ESP controllers and devices.
              </p>

              <button
                onClick={() => {
                  setError("");
                  setShowAddHouse(true);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <Plus size={18} />
                Add Your First House
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {houses.map((house) => (
                <div
                  key={house.id}
                  className="group rounded-3xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-500/40 hover:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() =>
                        router.push(
                          `/house/${house.id}`
                        )
                      }
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 transition hover:bg-cyan-500/20"
                    >
                      <Home size={23} />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          router.push(
                            `/house/${house.id}`
                          )
                        }
                        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-800 hover:text-cyan-400"
                        title="Open House"
                      >
                        <ChevronRight size={20} />
                      </button>

                      <button
                        onClick={() =>
                          openDeleteHouse(house)
                        }
                        className="rounded-lg p-2 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
                        title="Delete House"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      router.push(
                        `/house/${house.id}`
                      )
                    }
                    className="mt-5 block w-full text-left"
                  >
                    <h3 className="text-lg font-semibold">
                      {house.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      /{house.slug}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                      <span className="text-xs text-slate-500">
                        Rooms
                      </span>

                      <span className="text-xs text-slate-400">
                        Open house →
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ADD HOUSE MODAL */}

      {showAddHouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Add House
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Give your house a name.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowAddHouse(false);
                  setHouseName("");
                  setError("");
                }}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                House Name
              </label>

              <input
                type="text"
                value={houseName}
                onChange={(event) =>
                  setHouseName(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleAddHouse();
                  }
                }}
                placeholder="e.g. Haseeb Home"
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
              />

              <p className="mt-2 text-xs text-slate-600">
                Your house link will be generated automatically.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAddHouse(false);
                  setHouseName("");
                  setError("");
                }}
                disabled={creatingHouse}
                className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleAddHouse}
                disabled={creatingHouse}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingHouse ? (
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
        </div>
      )}

      {/* DELETE HOUSE MODAL */}

      {showDeleteHouse && selectedHouse && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                  <AlertTriangle size={24} />
                </div>

                <div>
                  <h2 className="text-xl font-semibold">
                    Delete House
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!deletingHouse) {
                    setShowDeleteHouse(false);
                    setSelectedHouse(null);
                    setError("");
                  }
                }}
                disabled={deletingHouse}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm leading-6 text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">
                  {selectedHouse.name}
                </span>
                ?
              </p>

              <p className="mt-3 text-sm leading-6 text-red-400">
                This will permanently remove this house,
                its rooms, connected ESP devices,
                runtime history and messages.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteHouse(false);
                  setSelectedHouse(null);
                  setError("");
                }}
                disabled={deletingHouse}
                className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteHouse}
                disabled={deletingHouse}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingHouse ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete House
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {title}
        </p>

        <div className="text-cyan-400">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}
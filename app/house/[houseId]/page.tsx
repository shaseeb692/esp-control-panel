"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  Home,
  Plus,
  Loader2,
  X,
  DoorOpen,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { navigateWithTransition } from "@/lib/viewTransition";

type House = {
  id: string;
  name: string;
  slug: string;
};

type Room = {
  id: string;
  house_id: string;
  name: string;
  slug: string;
  created_at: string;
};

export default function HousePage() {
  const router = useRouter();
  const params = useParams();

  const houseId = params.houseId as string;

  const [house, setHouse] = useState<House | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [deletingHouse, setDeletingHouse] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);

  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showDeleteHouse, setShowDeleteHouse] = useState(false);
  const [showDeleteRoom, setShowDeleteRoom] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [roomName, setRoomName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [error, setError] = useState("");

  /* =====================================================
     LOAD HOUSE + ROOMS
  ===================================================== */

  useEffect(() => {
    async function loadHouse() {
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

        const { data: houseData, error: houseError } =
          await supabase
            .from("houses")
            .select("id, name, slug")
            .eq("id", houseId)
            .single();

        if (houseError) {
          throw houseError;
        }

        setHouse(houseData);

        const { data: roomsData, error: roomsError } =
          await supabase
            .from("rooms")
            .select("id, house_id, name, slug, created_at")
            .eq("house_id", houseId)
            .order("created_at", {
              ascending: true,
            });

        if (roomsError) {
          throw roomsError;
        }

        setRooms(roomsData || []);
      } catch (err: any) {
        console.error("Load house error:", err);

        setError(
          err?.message || "Unable to load this house."
        );
      } finally {
        setLoading(false);
      }
    }

    if (houseId) {
      loadHouse();
    }
  }, [houseId, router]);

  /* =====================================================
     CREATE SLUG
  ===================================================== */

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* =====================================================
     ADD ROOM
  ===================================================== */

  async function handleAddRoom() {
    setError("");

    const cleanName = roomName.trim();

    if (!cleanName) {
      setError("Please enter a room name.");
      return;
    }

    const slug = createSlug(cleanName);

    if (!slug) {
      setError("Please enter a valid room name.");
      return;
    }

    setCreatingRoom(true);

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
          .from("rooms")
          .insert({
            house_id: houseId,
            name: cleanName,
            slug,
          })
          .select(
            "id, house_id, name, slug, created_at"
          )
          .single();

      if (insertError) {
        console.error(
          "Create room error:",
          insertError
        );

        if (insertError.code === "23505") {
          setError(
            "A room with this name already exists."
          );
        } else {
          setError(insertError.message);
        }

        return;
      }

      if (data) {
        setRooms((current) => [
          ...current,
          data,
        ]);
      }

      setRoomName("");
      setShowAddRoom(false);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Something went wrong while creating the room."
      );
    } finally {
      setCreatingRoom(false);
    }
  }

  /* =====================================================
     DELETE ROOM
  ===================================================== */

  async function handleDeleteRoom() {
    if (!selectedRoom) {
      return;
    }

    if (
      deleteConfirm.trim() !== selectedRoom.name
    ) {
      setError(
        `Please type "${selectedRoom.name}" exactly to confirm.`
      );
      return;
    }

    setError("");
    setDeletingRoom(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const { error: deleteError } =
        await supabase
          .from("rooms")
          .delete()
          .eq("id", selectedRoom.id)
          .eq("house_id", houseId);

      if (deleteError) {
        throw deleteError;
      }

      setRooms((current) =>
        current.filter(
          (room) => room.id !== selectedRoom.id
        )
      );

      setSelectedRoom(null);
      setDeleteConfirm("");
      setShowDeleteRoom(false);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message || "Unable to delete this room."
      );
    } finally {
      setDeletingRoom(false);
    }
  }

  /* =====================================================
     DELETE HOUSE
  ===================================================== */

  async function handleDeleteHouse() {
    if (!house) {
      return;
    }

    if (deleteConfirm.trim() !== house.name) {
      setError(
        `Please type "${house.name}" exactly to confirm.`
      );
      return;
    }

    setError("");
    setDeletingHouse(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const { error: roomsDeleteError } =
        await supabase
          .from("rooms")
          .delete()
          .eq("house_id", houseId);

      if (roomsDeleteError) {
        throw roomsDeleteError;
      }

      const { error: houseDeleteError } =
        await supabase
          .from("houses")
          .delete()
          .eq("id", houseId);

      if (houseDeleteError) {
        throw houseDeleteError;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message || "Unable to delete this house."
      );

      setDeletingHouse(false);
    }
  }

  if (loading) {
  return (
    <main className="min-h-screen bg-[#f7fbfc] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">

        {/* HOUSE HEADER SKELETON */}
        <div className="mb-7 rounded-[30px] bg-white p-6 shadow-sm sm:p-7">

          {/* Back button */}
          <div className="mb-6 h-5 w-36 animate-pulse rounded-lg bg-slate-100" />

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            {/* House info */}
            <div className="flex items-center gap-4">

              <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-slate-100" />

              <div>
                <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />

                <div className="mt-2 h-8 w-48 animate-pulse rounded-lg bg-slate-100" />

                <div className="mt-2 h-4 w-28 animate-pulse rounded bg-slate-100" />
              </div>

            </div>

            {/* Buttons */}
            <div className="flex gap-3">

              <div className="h-12 w-32 animate-pulse rounded-2xl bg-slate-100" />

              <div className="h-12 w-36 animate-pulse rounded-2xl bg-slate-100" />

            </div>

          </div>

        </div>

        {/* SUMMARY SKELETON */}
        <div className="mb-7 grid gap-4 sm:grid-cols-2">

          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-9 w-12 animate-pulse rounded-lg bg-slate-100" />
              </div>

              <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />

            </div>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-7 w-20 animate-pulse rounded-lg bg-slate-100" />
              </div>

              <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />

            </div>
          </div>

        </div>

        {/* ROOMS HEADER SKELETON */}
        <div className="mb-5 flex items-center justify-between">

          <div>
            <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-100" />

            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
          </div>

          <div className="hidden h-10 w-28 animate-pulse rounded-2xl bg-slate-100 sm:block" />

        </div>

        {/* ROOM CARDS SKELETON */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="rounded-[28px] bg-white p-6 shadow-sm"
            >

              {/* Top */}
              <div className="flex items-start justify-between">

                <div className="h-14 w-14 animate-pulse rounded-2xl bg-slate-100" />

                <div className="flex gap-1">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                </div>

              </div>

              {/* Room info */}
              <div className="mt-5">

                <div className="h-5 w-32 animate-pulse rounded-lg bg-slate-100" />

                <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-100" />

              </div>

              {/* Bottom */}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

                <div className="h-3 w-14 animate-pulse rounded bg-slate-100" />

                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />

              </div>

            </div>
          ))}

        </div>

      </div>
    </main>
  );
}

  /* =====================================================
     HOUSE NOT FOUND
  ===================================================== */

  if (!house) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fbfc] px-4">

        <div className="w-full max-w-md rounded-[30px] bg-white p-8 text-center shadow-sm">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-400">
            <Home size={30} />
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-700">
            House not found
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            {error || "This house does not exist."}
          </p>

          <button
  type="button"
  onClick={() =>
    navigateWithTransition(() => {
      router.push("/dashboard");
    })
  }
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#42B8C5] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>

        </div>

      </main>
    );
  }

  /* =====================================================
     HOUSE PAGE
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#f7fbfc] px-4 py-6 sm:px-6">

      <div className="mx-auto max-w-6xl">

        {/* =================================================
            TOP HEADER
        ================================================= */}

        <header className="mb-7 rounded-[30px] bg-white p-6 shadow-sm sm:p-7">

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-[#42B8C5]"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5]">
                <Home size={27} />
              </div>

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#42B8C5]">
                  House
                </p>

                <h1 className="mt-1 text-2xl font-semibold text-slate-700 sm:text-3xl">
                  {house.name}
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  /{house.slug}
                </p>

              </div>

            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRoomName("");
                  setShowAddRoom(true);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#42B8C5] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                <Plus size={18} />
                Add Room
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setDeleteConfirm("");
                  setShowDeleteHouse(true);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-100"
              >
                <Trash2 size={18} />
                Delete House
              </button>

            </div>

          </div>

        </header>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && !showAddRoom && !showDeleteRoom && !showDeleteHouse && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">

            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p>{error}</p>

          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-7 grid gap-4 sm:grid-cols-2">

          <div className="rounded-[28px] bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-slate-400">
                  Total Rooms
                </p>

                <p className="mt-2 text-3xl font-semibold text-slate-700">
                  {rooms.length}
                </p>

              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5]">
                <DoorOpen size={23} />
              </div>

            </div>

          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-slate-400">
                  House Status
                </p>

                <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-700">

                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                  Active

                </p>

              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                <Home size={23} />
              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            ROOMS
        ================================================= */}

        <section>

          <div className="mb-5 flex items-center justify-between">

            <div>

              <h2 className="text-xl font-semibold text-slate-700">
                Rooms
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Select a room to manage its devices.
              </p>

            </div>

            {rooms.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRoomName("");
                  setShowAddRoom(true);
                }}
                className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-[#42B8C5]/40 hover:text-[#42B8C5] sm:flex"
              >
                <Plus size={17} />
                Add Room
              </button>
            )}

          </div>

          {rooms.length === 0 ? (

            <div className="rounded-[30px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5]">
                <DoorOpen size={30} />
              </div>

              <h3 className="mt-5 text-lg font-semibold text-slate-700">
                No rooms yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Add your first room to start connecting
                ESP controllers and devices.
              </p>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRoomName("");
                  setShowAddRoom(true);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#42B8C5] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Plus size={18} />
                Add Your First Room
              </button>

            </div>

          ) : (

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              {rooms.map((room) => (

                <div
                  key={room.id}
                  className="group rounded-[28px] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >

                  <div className="flex items-start justify-between">

                    <button
  type="button"
  onClick={() =>
    navigateWithTransition(() => {
      router.push(
        `/house/${house.id}/room/${room.id}`
      );
    })
  }
  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5] transition hover:bg-[#42B8C5]/15"
>
                      <DoorOpen size={25} />
                    </button>

                    <div className="flex items-center gap-1">

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/house/${house.id}/room/${room.id}`
                          )
                        }
                        className="rounded-xl p-2 text-slate-300 transition hover:bg-[#42B8C5]/10 hover:text-[#42B8C5]"
                      >
                        <ChevronRight size={20} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoom(room);
                          setDeleteConfirm("");
                          setError("");
                          setShowDeleteRoom(true);
                        }}
                        className="rounded-xl p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>

                    </div>

                  </div>

                  <button
  type="button"
  onClick={() =>
    navigateWithTransition(() => {
      router.push(
        `/house/${house.id}/room/${room.id}`
      );
    })
  }
  className="mt-5 block w-full text-left"
>

                    <h3 className="text-lg font-semibold text-slate-700">
                      {room.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      /{room.slug}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

                      <span className="text-xs font-medium text-slate-400">
                        Devices
                      </span>

                      <span className="flex items-center gap-1 text-xs font-medium text-[#42B8C5]">
                        Open room
                        <ChevronRight size={14} />
                      </span>

                    </div>

                  </button>

                </div>

              ))}

            </div>

          )}

        </section>

      </div>

      {/* =====================================================
          ADD ROOM MODAL
      ===================================================== */}

      {showAddRoom && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingRoom) {
              setShowAddRoom(false);
              setRoomName("");
              setError("");
            }
          }}
        >

          <div
            className="w-full max-w-md rounded-[30px] bg-white p-7 shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="flex items-start justify-between">

              <div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#42B8C5]/10 text-[#42B8C5]">
                  <DoorOpen size={24} />
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-slate-700">
                  Add Room
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Add a room inside {house.name}.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!creatingRoom) {
                    setShowAddRoom(false);
                    setRoomName("");
                    setError("");
                  }
                }}
                disabled={creatingRoom}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={20} />
              </button>

            </div>

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">

                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <p>{error}</p>

              </div>
            )}

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-500">
                Room Name
              </label>

              <input
                type="text"
                value={roomName}
                onChange={(event) =>
                  setRoomName(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddRoom();
                  }
                }}
                placeholder="e.g. Bedroom"
                autoFocus
                disabled={creatingRoom}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#42B8C5] focus:ring-2 focus:ring-[#42B8C5]/10 disabled:bg-slate-50"
              />

            </div>

            <div className="mt-6 flex gap-3">

              <button
                type="button"
                onClick={() => {
                  setShowAddRoom(false);
                  setRoomName("");
                  setError("");
                }}
                disabled={creatingRoom}
                className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddRoom}
                disabled={
                  creatingRoom ||
                  !roomName.trim()
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#42B8C5] py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {creatingRoom ? (
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
                    Create Room
                  </>
                )}

              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          DELETE ROOM MODAL
      ===================================================== */}

      {showDeleteRoom && selectedRoom && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !deletingRoom
            ) {
              setShowDeleteRoom(false);
              setSelectedRoom(null);
              setDeleteConfirm("");
              setError("");
            }
          }}
        >

          <div
            className="w-full max-w-md rounded-[30px] bg-white p-7 shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="flex items-start justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <AlertTriangle size={24} />
                </div>

                <div>

                  <h2 className="text-xl font-semibold text-slate-700">
                    Delete Room
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    This action cannot be undone.
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!deletingRoom) {
                    setShowDeleteRoom(false);
                    setSelectedRoom(null);
                    setDeleteConfirm("");
                    setError("");
                  }
                }}
                disabled={deletingRoom}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={20} />
              </button>

            </div>

            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4">

              <p className="text-sm leading-6 text-slate-500">
                You are about to permanently delete:
              </p>

              <p className="mt-2 font-semibold text-red-500">
                {selectedRoom.name}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                Any devices or data linked to this room may
                also prevent deletion unless their database
                relationship allows cascading.
              </p>

            </div>

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-500">

                Type{" "}

                <span className="font-semibold text-slate-700">
                  {selectedRoom.name}
                </span>{" "}

                to confirm

              </label>

              <input
                type="text"
                value={deleteConfirm}
                onChange={(event) =>
                  setDeleteConfirm(event.target.value)
                }
                disabled={deletingRoom}
                placeholder={selectedRoom.name}
                autoFocus
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50"
              />

            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">

              <button
                type="button"
                onClick={() => {
                  setShowDeleteRoom(false);
                  setSelectedRoom(null);
                  setDeleteConfirm("");
                  setError("");
                }}
                disabled={deletingRoom}
                className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteRoom}
                disabled={
                  deletingRoom ||
                  deleteConfirm.trim() !==
                    selectedRoom.name
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >

                {deletingRoom ? (
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
                    Delete Room
                  </>
                )}

              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          DELETE HOUSE MODAL
      ===================================================== */}

      {showDeleteHouse && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !deletingHouse
            ) {
              setShowDeleteHouse(false);
              setDeleteConfirm("");
              setError("");
            }
          }}
        >

          <div
            className="w-full max-w-md rounded-[30px] bg-white p-7 shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="flex items-start justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <AlertTriangle size={24} />
                </div>

                <div>

                  <h2 className="text-xl font-semibold text-slate-700">
                    Delete House
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    This action cannot be undone.
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!deletingHouse) {
                    setShowDeleteHouse(false);
                    setDeleteConfirm("");
                    setError("");
                  }
                }}
                disabled={deletingHouse}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={20} />
              </button>

            </div>

            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4">

              <p className="text-sm leading-6 text-slate-500">
                You are about to permanently delete:
              </p>

              <p className="mt-2 font-semibold text-red-500">
                {house.name}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                All rooms belonging to this house will also
                be removed.
              </p>

            </div>

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-500">

                Type{" "}

                <span className="font-semibold text-slate-700">
                  {house.name}
                </span>{" "}

                to confirm

              </label>

              <input
                type="text"
                value={deleteConfirm}
                onChange={(event) =>
                  setDeleteConfirm(event.target.value)
                }
                disabled={deletingHouse}
                placeholder={house.name}
                autoFocus
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50"
              />

            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">

              <button
                type="button"
                onClick={() => {
                  setShowDeleteHouse(false);
                  setDeleteConfirm("");
                  setError("");
                }}
                disabled={deletingHouse}
                className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteHouse}
                disabled={
                  deletingHouse ||
                  deleteConfirm.trim() !== house.name
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
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
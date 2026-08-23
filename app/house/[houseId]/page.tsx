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

  const [selectedRoom, setSelectedRoom] =
    useState<Room | null>(null);

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
            .select(
              "id, house_id, name, slug, created_at"
            )
            .eq("house_id", houseId)
            .order("created_at", {
              ascending: true,
            });

        if (roomsError) {
          throw roomsError;
        }

        setRooms(roomsData || []);
      } catch (err: any) {
        console.error(err);

        setError(
          err?.message ||
            "Unable to load this house."
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

      /* -----------------------------------------------
         DELETE ROOM
      ------------------------------------------------ */

      const { error: deleteError } =
        await supabase
          .from("rooms")
          .delete()
          .eq("id", selectedRoom.id)
          .eq("house_id", houseId);

      if (deleteError) {
        throw deleteError;
      }

      /* -----------------------------------------------
         REMOVE FROM UI
      ------------------------------------------------ */

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
        err?.message ||
          "Unable to delete this room."
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

      /* -----------------------------------------------
         DELETE ROOMS
      ------------------------------------------------ */

      const { error: roomsDeleteError } =
        await supabase
          .from("rooms")
          .delete()
          .eq("house_id", houseId);

      if (roomsDeleteError) {
        throw roomsDeleteError;
      }

      /* -----------------------------------------------
         DELETE HOUSE
      ------------------------------------------------ */

      const { error: houseDeleteError } =
        await supabase
          .from("houses")
          .delete()
          .eq("id", houseId);

      if (houseDeleteError) {
        throw houseDeleteError;
      }

      router.replace("/");
      router.refresh();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to delete this house."
      );

      setDeletingHouse(false);
    }
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">

          <Loader2
            size={34}
            className="mx-auto animate-spin text-cyan-400"
          />

          <p className="mt-3 text-sm text-slate-400">
            Loading house...
          </p>

        </div>
      </main>
    );
  }

  /* =====================================================
     HOUSE NOT FOUND
  ===================================================== */

  if (!house) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">

        <div className="text-center">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <Home size={30} />
          </div>

          <h1 className="mt-5 text-xl font-semibold">
            House not found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {error || "This house does not exist."}
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
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
    <main className="min-h-screen bg-slate-950 text-white">

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="mb-8">

          <button
            onClick={() => router.push("/")}
            className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                <Home size={27} />
              </div>

              <div>

                <p className="text-xs uppercase tracking-wider text-slate-500">
                  House
                </p>

                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                  {house.name}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  /{house.slug}
                </p>

              </div>

            </div>

            <div className="flex flex-wrap gap-3">

              <button
                onClick={() => {
                  setError("");
                  setShowAddRoom(true);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <Plus size={18} />
                Add Room
              </button>

              <button
                onClick={() => {
                  setError("");
                  setDeleteConfirm("");
                  setShowDeleteHouse(true);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-400 transition hover:border-red-500/50 hover:bg-red-500/20"
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

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-sm text-slate-500">
              Total Rooms
            </p>

            <p className="mt-2 text-3xl font-bold">
              {rooms.length}
            </p>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-sm text-slate-500">
              House Status
            </p>

            <p className="mt-2 flex items-center gap-2 text-lg font-semibold">

              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />

              Active

            </p>

          </div>

        </div>

        {/* =================================================
            ROOMS
        ================================================= */}

        <section>

          <div className="mb-5">

            <h2 className="text-xl font-semibold">
              Rooms
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select a room to manage its devices.
            </p>

          </div>

          {rooms.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-16 text-center">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                <DoorOpen size={30} />
              </div>

              <h3 className="mt-5 text-xl font-semibold">
                No rooms yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Add your first room to start connecting
                ESP controllers and devices.
              </p>

              <button
                onClick={() => {
                  setError("");
                  setShowAddRoom(true);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
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
                  className="group rounded-3xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-500/40 hover:bg-slate-900/80"
                >

                  <div className="flex items-start justify-between">

                    <button
                      onClick={() =>
                        router.push(
                          `/house/${house.id}/room/${room.id}`
                        )
                      }
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400"
                    >
                      <DoorOpen size={23} />
                    </button>

                    <div className="flex items-center gap-1">

                      <button
                        onClick={() =>
                          router.push(
                            `/house/${house.id}/room/${room.id}`
                          )
                        }
                        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-800 hover:text-cyan-400"
                      >
                        <ChevronRight size={20} />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRoom(room);
                          setDeleteConfirm("");
                          setError("");
                          setShowDeleteRoom(true);
                        }}
                        className="rounded-lg p-2 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={18} />
                      </button>

                    </div>

                  </div>

                  <button
                    onClick={() =>
                      router.push(
                        `/house/${house.id}/room/${room.id}`
                      )
                    }
                    className="mt-5 block w-full text-left"
                  >

                    <h3 className="text-lg font-semibold">
                      {room.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      /{room.slug}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">

                      <span className="text-xs text-slate-500">
                        Devices
                      </span>

                      <span className="text-xs text-slate-400">
                        Open room →
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

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">

            <div className="flex items-start justify-between">

              <div>

                <h2 className="text-xl font-semibold">
                  Add Room
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add a room inside {house.name}.
                </p>

              </div>

              <button
                onClick={() => {
                  setShowAddRoom(false);
                  setRoomName("");
                  setError("");
                }}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white"
              >
                <X size={19} />
              </button>

            </div>

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-300">
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
                    handleAddRoom();
                  }
                }}
                placeholder="e.g. Bedroom"
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
              />

            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">

              <button
                onClick={() => {
                  setShowAddRoom(false);
                  setRoomName("");
                  setError("");
                }}
                disabled={creatingRoom}
                className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleAddRoom}
                disabled={creatingRoom}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
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

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-slate-900 p-6 shadow-2xl">

            <div className="flex items-start justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                  <AlertTriangle size={24} />
                </div>

                <div>

                  <h2 className="text-xl font-semibold">
                    Delete Room
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    This action cannot be undone.
                  </p>

                </div>

              </div>

              <button
                onClick={() => {
                  if (!deletingRoom) {
                    setShowDeleteRoom(false);
                    setSelectedRoom(null);
                    setDeleteConfirm("");
                    setError("");
                  }
                }}
                disabled={deletingRoom}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                <X size={19} />
              </button>

            </div>

            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">

              <p className="text-sm leading-6 text-slate-300">
                You are about to permanently delete:
              </p>

              <p className="mt-2 font-semibold text-red-400">
                {selectedRoom.name}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Any devices or data linked to this room may
                also prevent deletion unless their database
                relationship allows cascading.
              </p>

            </div>

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-300">

                Type{" "}

                <span className="font-semibold text-white">
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
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-700 focus:border-red-500 disabled:opacity-60"
              />

            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">

              <button
                onClick={() => {
                  setShowDeleteRoom(false);
                  setSelectedRoom(null);
                  setDeleteConfirm("");
                  setError("");
                }}
                disabled={deletingRoom}
                className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteRoom}
                disabled={
                  deletingRoom ||
                  deleteConfirm.trim() !==
                    selectedRoom.name
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
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

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-slate-900 p-6 shadow-2xl">

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
                    setDeleteConfirm("");
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
                You are about to permanently delete:
              </p>

              <p className="mt-2 font-semibold text-red-400">
                {house.name}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                All rooms belonging to this house will also
                be removed.
              </p>

            </div>

            <div className="mt-6">

              <label className="mb-2 block text-sm font-medium text-slate-300">

                Type{" "}

                <span className="font-semibold text-white">
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
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-700 focus:border-red-500 disabled:opacity-60"
              />

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
                  setDeleteConfirm("");
                  setError("");
                }}
                disabled={deletingHouse}
                className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteHouse}
                disabled={
                  deletingHouse ||
                  deleteConfirm.trim() !== house.name
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
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
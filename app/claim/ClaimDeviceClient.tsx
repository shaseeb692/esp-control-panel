"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { GlobalHeaderActions } from "@/components/layout/GlobalHeaderActions";

const THEME_COLOR = "#42B8C5";

type DiscoveryDevice = {
  discovery_session_id: string;
  device_id: string;
  hardware_model: string | null;
  firmware_version: string | null;
  lifecycle_state: string | null;
  expires_at: string;
};

type DiscoveryResponse = {
  ok?: boolean;
  devices?: DiscoveryDevice[];
  error?: string;
};

type ClaimResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  device_id?: string;
  house_id?: string;
  room_id?: string;
  security_state?: string;
};

type PageState =
  | "searching"
  | "ready"
  | "claiming"
  | "success"
  | "error";

/* =========================================================
   ERROR MESSAGE
========================================================= */

function getClaimErrorMessage(
  code?: string,
  fallback?: string,
) {
  switch (code) {
    case "DISCOVERY_SESSION_NOT_FOUND":
      return "This device is no longer available. Search again.";

    case "DISCOVERY_SESSION_EXPIRED":
      return "The device discovery session expired. Search again.";

    case "DISCOVERY_SESSION_UNAVAILABLE":
      return "This device is no longer available for setup.";

    case "DEVICE_NOT_REGISTERED":
      return "This device is not registered with the system.";

    case "DEVICE_UNAVAILABLE":
      return "This device is currently unavailable.";

    case "DEVICE_SECURITY_BLOCKED":
      return "This device is locked or blocked by its security state.";

    case "OWNED_BY_ANOTHER_USER":
      return "This device already belongs to another account.";

    case "HOUSE_NOT_AUTHORIZED":
      return "You do not have permission to add devices to this house.";

    case "ROOM_NOT_AUTHORIZED":
      return "The selected room is not authorized.";

    case "CLAIM_CONFLICT":
      return "The device ownership changed during setup. Search again.";

    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again.";

    case "CLAIM_DATABASE_ERROR":
    case "INVALID_CLAIM_RESPONSE":
    case "SERVER_CONFIG_ERROR":
    case "INTERNAL_SERVER_ERROR":
      return "The server could not complete device setup. Please try again.";

    default:
      return fallback || "Unable to add this device.";
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function ClaimDevicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    darkMode,
    glass,
    glassSoft,
    muted,
  } = useMasterTheme();

  const houseId =
    searchParams.get("houseId") ?? "";

  const roomId =
    searchParams.get("roomId") ?? "";

  const backHref =
    houseId && roomId
      ? `/house/${houseId}/room/${roomId}`
      : "/dashboard";

  const [devices, setDevices] =
    useState<DiscoveryDevice[]>([]);

  const [selectedSessionId, setSelectedSessionId] =
    useState("");

  const [pageState, setPageState] =
    useState<PageState>("searching");

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [hasSearched, setHasSearched] =
    useState(false);

  const redirectTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const mountedRef =
    useRef(true);

  /* =====================================================
     CLEANUP
  ===================================================== */

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  /* =====================================================
     DISCOVER DEVICES
  ===================================================== */

  const discoverDevices = useCallback(
    async (manual = false) => {
      if (!houseId || !roomId) {
        setDevices([]);
        setSelectedSessionId("");
        setPageState("error");

        setError(
          "House or room information is missing. Return to the room and start Add Device again.",
        );

        setHasSearched(true);
        return;
      }

      setError("");
      setSuccessMessage("");
      setPageState("searching");

      if (manual) {
        setDevices([]);
        setSelectedSessionId("");
      }

      try {
        const supabase = createClient();

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error(
            "Your session has expired. Please sign in again.",
          );
        }

        const response = await fetch(
          "/api/device/discover",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },

            cache: "no-store",
          },
        );

        let result: DiscoveryResponse;

        try {
          result =
            (await response.json()) as DiscoveryResponse;
        } catch {
          throw new Error(
            "The server returned an invalid discovery response.",
          );
        }

        if (!response.ok || !result.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your session has expired. Please sign in again.",
            );
          }

          throw new Error(
            result.error ||
              "Unable to search for devices.",
          );
        }

        if (!mountedRef.current) {
          return;
        }

        const foundDevices =
          result.devices ?? [];

        setDevices(foundDevices);

        /*
          Automatically select when exactly one
          device is available.

          With multiple devices the user chooses
          the physical unit they are setting up.
        */

        if (foundDevices.length === 1) {
          setSelectedSessionId(
            foundDevices[0].discovery_session_id,
          );
        } else {
          setSelectedSessionId("");
        }

        setPageState("ready");
        setHasSearched(true);
      } catch (discoverError) {
        console.error(
          "DEVICE DISCOVERY ERROR:",
          discoverError,
        );

        if (!mountedRef.current) {
          return;
        }

        setDevices([]);
        setSelectedSessionId("");
        setPageState("error");
        setHasSearched(true);

        setError(
          discoverError instanceof Error
            ? discoverError.message
            : "Unable to search for devices.",
        );
      }
    },
    [houseId, roomId],
  );

  /* =====================================================
     INITIAL DISCOVERY
  ===================================================== */

  useEffect(() => {
    void discoverDevices();
  }, [discoverDevices]);

  /* =====================================================
     CLAIM SELECTED DEVICE
  ===================================================== */

  async function addSelectedDevice() {
    if (!selectedSessionId) {
      setError(
        "Select a device before continuing.",
      );
      return;
    }

    if (!houseId || !roomId) {
      setError(
        "House or room information is missing.",
      );
      return;
    }

    setError("");
    setSuccessMessage("");
    setPageState("claiming");

    try {
      const response = await fetch(
        "/api/device/claim",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "same-origin",

          body: JSON.stringify({
            discovery_session_id:
              selectedSessionId,

            house_id:
              houseId,

            room_id:
              roomId,
          }),
        },
      );

      let result: ClaimResponse;

      try {
        result =
          (await response.json()) as ClaimResponse;
      } catch {
        throw new Error(
          "The server returned an invalid response.",
        );
      }

      if (!response.ok || !result.ok) {
        setPageState("ready");

        setError(
          getClaimErrorMessage(
            result.code,
            result.message,
          ),
        );

        /*
          These states mean the discovery result
          should no longer remain selectable.
        */

        if (
          result.code ===
            "DISCOVERY_SESSION_NOT_FOUND" ||
          result.code ===
            "DISCOVERY_SESSION_EXPIRED" ||
          result.code ===
            "DISCOVERY_SESSION_UNAVAILABLE" ||
          result.code ===
            "OWNED_BY_ANOTHER_USER" ||
          result.code ===
            "DEVICE_UNAVAILABLE"
        ) {
          setSelectedSessionId("");
        }

        return;
      }

      setError("");
      setSelectedSessionId("");
      setPageState("success");

      setSuccessMessage(
        result.code === "ALREADY_OWNED"
          ? "Device is connected to this room."
          : "Device added successfully. It is now connected to this room.",
      );

      redirectTimerRef.current =
        setTimeout(() => {
          router.replace(
            `/house/${houseId}/room/${roomId}`,
          );

          router.refresh();
        }, 1200);
    } catch (claimError) {
      console.error(
        "DEVICE CLAIM ERROR:",
        claimError,
      );

      setPageState("ready");

      setError(
        claimError instanceof Error
          ? claimError.message
          : "Unable to contact the server.",
      );
    }
  }

  const busy =
    pageState === "searching" ||
    pageState === "claiming";

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <main
      className={`smart-theme-page min-h-screen ${
        darkMode
          ? "text-white"
          : "text-slate-600"
      }`}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <AppHeader
          eyebrow="Device Setup"
          title="Add Device"
          subtitle="Find and connect your smart device"
          icon={<Radio size={25} />}
          backHref={backHref}
          backLabel="Room"
          actions={<GlobalHeaderActions />}
        />

        <div className="mx-auto mt-8 max-w-2xl">
          <section
            className={`rounded-[28px] border p-5 sm:p-7 ${glass}`}
          >
            {/* =========================================
                HEADER
            ========================================== */}

            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${glassSoft}`}
                style={{
                  color: THEME_COLOR,
                }}
              >
                <Wifi size={24} />
              </div>

              <div className="min-w-0">
                <h1 className="text-xl font-semibold">
                  Find Device
                </h1>

                <p
                  className={`mt-1 text-sm leading-6 ${muted}`}
                >
                  Make sure your device is powered on
                  and connected to Wi-Fi. Available
                  devices will appear automatically.
                </p>
              </div>
            </div>

            {/* =========================================
                SEARCHING
            ========================================== */}

            {pageState === "searching" && (
              <div
                className={`mt-6 rounded-2xl border p-6 text-center ${glassSoft}`}
              >
                <Loader2
                  size={32}
                  className="mx-auto animate-spin"
                  style={{
                    color: THEME_COLOR,
                  }}
                />

                <p
                  className="mt-4 font-semibold"
                  style={{
                    color: THEME_COLOR,
                  }}
                >
                  Searching for devices...
                </p>

                <p
                  className={`mt-1 text-sm ${muted}`}
                >
                  Looking for available devices ready
                  to be added.
                </p>
              </div>
            )}

            {/* =========================================
                NO DEVICES
            ========================================== */}

            {pageState !== "searching" &&
              pageState !== "success" &&
              hasSearched &&
              devices.length === 0 && (
                <div
                  className={`mt-6 rounded-2xl border p-6 text-center ${glassSoft}`}
                >
                  <Radio
                    size={32}
                    className="mx-auto"
                    style={{
                      color: THEME_COLOR,
                    }}
                  />

                  <p className="mt-4 font-semibold">
                    No devices found
                  </p>

                  <p
                    className={`mt-1 text-sm leading-6 ${muted}`}
                  >
                    Power on the device and make sure
                    it has completed Wi-Fi setup, then
                    search again.
                  </p>
                </div>
              )}

            {/* =========================================
                DEVICE LIST
            ========================================== */}

            {pageState !== "searching" &&
              pageState !== "success" &&
              devices.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        Available Devices
                      </p>

                      <p
                        className={`mt-1 text-sm ${muted}`}
                      >
                        {devices.length === 1
                          ? "1 device found"
                          : `${devices.length} devices found`}
                      </p>
                    </div>

                    <Radio
                      size={20}
                      style={{
                        color: THEME_COLOR,
                      }}
                    />
                  </div>

                  {devices.map((device) => {
                    const selected =
                      selectedSessionId ===
                      device.discovery_session_id;

                    return (
                      <button
                        key={
                          device.discovery_session_id
                        }
                        type="button"
                        onClick={() => {
                          setSelectedSessionId(
                            device.discovery_session_id,
                          );

                          setError("");
                        }}
                        disabled={busy}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "ring-2"
                            : ""
                        } ${glassSoft}`}
                        style={
                          selected
                            ? {
                                borderColor:
                                  THEME_COLOR,

                                boxShadow:
                                  `0 0 0 1px ${THEME_COLOR}`,
                              }
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                            style={{
                              color:
                                THEME_COLOR,
                            }}
                          >
                            <Cpu size={22} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold">
                                {device.device_id}
                              </p>

                              {selected && (
                                <CheckCircle2
                                  size={17}
                                  className="shrink-0"
                                  style={{
                                    color:
                                      THEME_COLOR,
                                  }}
                                />
                              )}
                            </div>

                            <p
                              className={`mt-1 text-sm ${muted}`}
                            >
                              {device.hardware_model ||
                                "Smart Device"}

                              {device.firmware_version
                                ? ` • Firmware ${device.firmware_version}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* =========================================
                CLAIMING
            ========================================== */}

            {pageState === "claiming" && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <Loader2
                  size={21}
                  className="mt-0.5 shrink-0 animate-spin"
                  style={{
                    color: THEME_COLOR,
                  }}
                />

                <div>
                  <p
                    className="font-semibold"
                    style={{
                      color: THEME_COLOR,
                    }}
                  >
                    Adding device...
                  </p>

                  <p
                    className={`mt-1 text-sm ${muted}`}
                  >
                    Verifying ownership, security and
                    room access.
                  </p>
                </div>
              </div>
            )}

            {/* =========================================
                SUCCESS
            ========================================== */}

            {pageState === "success" &&
              successMessage && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <CheckCircle2
                    size={21}
                    className="mt-0.5 shrink-0 text-emerald-500"
                  />

                  <div>
                    <p className="font-semibold text-emerald-500">
                      Device connected
                    </p>

                    <p
                      className={`mt-1 text-sm ${muted}`}
                    >
                      {successMessage}
                    </p>
                  </div>
                </div>
              )}

            {/* =========================================
                ERROR
            ========================================== */}

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <XCircle
                  size={21}
                  className="mt-0.5 shrink-0 text-red-500"
                />

                <p
                  className={`text-sm leading-6 ${muted}`}
                >
                  {error}
                </p>
              </div>
            )}

            {/* =========================================
                SECURITY INFO
            ========================================== */}

            {pageState !== "success" && (
              <div
                className={`mt-6 rounded-2xl border p-4 ${glassSoft}`}
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={20}
                    className="mt-0.5 shrink-0"
                    style={{
                      color: THEME_COLOR,
                    }}
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      Secure device setup
                    </p>

                    <p
                      className={`mt-1 text-sm leading-6 ${muted}`}
                    >
                      Only registered and available
                      devices can be added. Ownership,
                      room authorization and device
                      security are verified by the
                      server before setup completes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================
                ACTIONS
            ========================================== */}

            {pageState !== "success" && (
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    router.push(backHref)
                  }
                  disabled={
                    pageState === "claiming"
                  }
                  className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${glassSoft}`}
                >
                  <ArrowLeft size={18} />
                  Back
                </button>

                {devices.length === 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      void discoverDevices(true)
                    }
                    disabled={busy}
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor:
                        THEME_COLOR,
                    }}
                  >
                    {pageState ===
                    "searching" ? (
                      <>
                        <Loader2
                          size={18}
                          className="animate-spin"
                        />
                        Searching...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={18} />
                        Search Again
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={addSelectedDevice}
                    disabled={
                      !selectedSessionId ||
                      busy
                    }
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor:
                        THEME_COLOR,
                    }}
                  >
                    {pageState ===
                    "claiming" ? (
                      <>
                        <Loader2
                          size={18}
                          className="animate-spin"
                        />
                        Adding...
                      </>
                    ) : (
                      <>
                        <ShieldCheck
                          size={18}
                        />
                        Add Device
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
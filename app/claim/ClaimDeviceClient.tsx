"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  QrCode,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

import { useMasterTheme } from "@/components/theme/MasterThemeProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { GlobalHeaderActions } from "@/components/layout/GlobalHeaderActions";

const THEME_COLOR = "#42B8C5";

type ScanState =
  | "idle"
  | "scanning"
  | "reading"
  | "ready"
  | "claiming"
  | "success"
  | "error";

type ClaimResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  device_id?: string;
  house_id?: string;
  room_id?: string;
  security_state?: string;
};

function extractClaimToken(rawValue: string) {
  const value = rawValue.trim();

  if (!value) return "";

  try {
    const url = new URL(value);

    return (
      url.searchParams.get("token") ??
      url.searchParams.get("claim_token") ??
      ""
    ).trim();
  } catch {
    // Temporary device QR may contain the raw token.
  }

  if (value.startsWith("claim_")) {
    return value;
  }

  try {
    const parsed = JSON.parse(value) as {
      token?: unknown;
      claim_token?: unknown;
    };

    if (typeof parsed.token === "string") {
      return parsed.token.trim();
    }

    if (typeof parsed.claim_token === "string") {
      return parsed.claim_token.trim();
    }
  } catch {
    // Not JSON.
  }

  return "";
}

function getClaimErrorMessage(
  code?: string,
  fallback?: string,
) {
  switch (code) {
    case "CLAIM_TOKEN_REQUIRED":
      return "No device claim token was provided.";

    case "INVALID_TOKEN_FORMAT":
    case "INVALID_TOKEN":
      return "This device QR is invalid. Generate a new QR from the device and try again.";

    case "TOKEN_EXPIRED":
      return "This device QR has expired. Generate a new temporary QR from the device.";

    case "TOKEN_USED":
      return "This device QR has already been used. Generate a new temporary QR if needed.";

    case "TOKEN_REVOKED":
      return "This device QR is no longer valid. Generate a new temporary QR from the device.";

    case "DEVICE_NOT_REGISTERED":
      return "This device is not registered with the system.";

    case "DEVICE_UNAVAILABLE":
      return "This device is currently unavailable for claiming.";

    case "DEVICE_SECURITY_BLOCKED":
      return "This device is locked or blocked by its security state.";

    case "OWNED_BY_ANOTHER_USER":
      return "This device already belongs to another account. Ownership must be released, transferred, or recovered before it can be added.";

    case "HOUSE_NOT_AUTHORIZED":
      return "You do not have permission to add a device to this house.";

    case "ROOM_NOT_AUTHORIZED":
      return "The selected room does not belong to this house or you do not have permission to use it.";

    case "CLAIM_CONFLICT":
      return "The device ownership changed while the claim was being processed. Please try again.";

    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again.";

    case "CLAIM_DATABASE_ERROR":
    case "INVALID_CLAIM_RESPONSE":
    case "SERVER_CONFIG_ERROR":
    case "INTERNAL_SERVER_ERROR":
      return "The server could not complete the device claim. Please try again.";

    default:
      return fallback || "Unable to claim this device.";
  }
}

export default function ClaimDevicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { darkMode, glass, glassSoft, muted } =
    useMasterTheme();

  const houseId = searchParams.get("houseId") ?? "";
  const roomId = searchParams.get("roomId") ?? "";

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const redirectTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanState, setScanState] =
    useState<ScanState>("idle");

  const [claimToken, setClaimToken] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const backHref =
    houseId && roomId
      ? `/house/${houseId}/room/${roomId}`
      : "/dashboard";

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        scanner.stop().catch(() => undefined);
      }

      scannerRef.current = null;

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  async function stopCamera() {
    const scanner = scannerRef.current;

    if (scanner?.isScanning) {
      try {
        await scanner.stop();
      } catch {
        // Scanner may already be stopping.
      }
    }

    scannerRef.current = null;
  }

  function resetMessages() {
    setError("");
    setSuccessMessage("");
  }

  function acceptQrValue(decodedText: string) {
    const token = extractClaimToken(decodedText);

    if (!token) {
      setClaimToken("");
      setSuccessMessage("");
      setScanState("error");

      setError(
        "This QR code is not a valid device claim QR. Open the Connect Device tab on your ESP and scan the temporary QR shown there.",
      );

      return false;
    }

    setClaimToken(token);
    setError("");
    setSuccessMessage("");
    setScanState("ready");

    return true;
  }

  async function startCamera() {
    resetMessages();
    setClaimToken("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanState("error");

      setError(
        "Camera access is not available in this browser. You can upload a QR image instead.",
      );

      return;
    }

    await stopCamera();

    const scanner = new Html5Qrcode(
      "device-claim-reader",
    );

    scannerRef.current = scanner;

    try {
      setScanState("scanning");

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 240,
            height: 240,
          },
        },
        async (decodedText) => {
          if (!acceptQrValue(decodedText)) {
            return;
          }

          await stopCamera();
        },
        () => {
          // Normal frame without QR. Keep scanning.
        },
      );
    } catch (scanError) {
      scannerRef.current = null;
      setScanState("error");

      const message =
        scanError instanceof Error
          ? scanError.message
          : "Camera could not be started.";

      setError(
        `${message} You can still upload the QR image instead.`,
      );
    }
  }

  async function handleQrImage(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    resetMessages();
    setClaimToken("");
    setScanState("reading");

    await stopCamera();

    const scanner = new Html5Qrcode(
      "device-claim-file-reader",
    );

    try {
      const decodedText = await scanner.scanFile(
        file,
        true,
      );

      acceptQrValue(decodedText);
    } catch {
      setScanState("error");

      setError(
        "QR code could not be read from this image. Try a clearer image or use the camera scanner.",
      );
    } finally {
      try {
        scanner.clear();
      } catch {
        // Nothing to clear.
      }
    }
  }

  async function continueToVerification() {
    if (!claimToken) {
      setScanState("error");
      setError("Scan a valid device QR first.");
      return;
    }

    if (!houseId || !roomId) {
      setScanState("error");

      setError(
        "House or room information is missing. Return to the room and start Add Device again.",
      );

      return;
    }

    resetMessages();
    setScanState("claiming");

    try {
      const response = await fetch(
        "/api/device/claim",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          credentials: "same-origin",

          body: JSON.stringify({
            claim_token: claimToken,
            house_id: houseId,
            room_id: roomId,
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
        setScanState("error");

        setError(
          getClaimErrorMessage(
            result.code,
            result.message,
          ),
        );

        /*
          Do not keep an invalid/consumed token ready
          for another accidental submission.
        */

        if (
          result.code === "TOKEN_EXPIRED" ||
          result.code === "TOKEN_USED" ||
          result.code === "TOKEN_REVOKED" ||
          result.code === "INVALID_TOKEN" ||
          result.code === "INVALID_TOKEN_FORMAT"
        ) {
          setClaimToken("");
        }

        return;
      }

      setClaimToken("");
      setError("");
      setScanState("success");

      if (result.code === "ALREADY_OWNED") {
        setSuccessMessage(
          "This device already belongs to your account. It has been attached to the selected room.",
        );
      } else {
        setSuccessMessage(
          "Device claimed successfully. It is now connected to this room.",
        );
      }

      /*
        Give the user a moment to see confirmation,
        then return to the selected room.
      */

      redirectTimerRef.current = setTimeout(() => {
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

      setScanState("error");

      setError(
        claimError instanceof Error
          ? claimError.message
          : "Unable to contact the server. Please try again.",
      );
    }
  }

  const busy =
    scanState === "reading" ||
    scanState === "claiming";

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
          subtitle="Scan the temporary QR shown by your ESP"
          icon={<QrCode size={25} />}
          backHref={backHref}
          backLabel="Room"
          actions={<GlobalHeaderActions />}
        />

        <div className="mx-auto mt-8 max-w-2xl">
          <section
            className={`rounded-[28px] border p-5 sm:p-7 ${glass}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${glassSoft}`}
                style={{
                  color: THEME_COLOR,
                }}
              >
                <QrCode size={24} />
              </div>

              <div className="min-w-0">
                <h1 className="text-xl font-semibold">
                  Scan Device QR
                </h1>

                <p
                  className={`mt-1 text-sm leading-6 ${muted}`}
                >
                  Open your ESP&apos;s local IP,
                  select Connect Device, and scan the
                  temporary QR displayed there.
                </p>
              </div>
            </div>

            <div
              id="device-claim-reader"
              className={`mt-6 overflow-hidden rounded-2xl ${
                scanState === "scanning"
                  ? "min-h-[280px] border"
                  : ""
              } ${glassSoft}`}
            />

            <div
              id="device-claim-file-reader"
              className="hidden"
              aria-hidden="true"
            />

            {scanState === "ready" && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <CheckCircle2
                  size={21}
                  className="mt-0.5 shrink-0 text-emerald-500"
                />

                <div>
                  <p className="font-semibold text-emerald-500">
                    Device QR detected
                  </p>

                  <p
                    className={`mt-1 text-sm ${muted}`}
                  >
                    The temporary claim token is ready
                    for secure verification.
                  </p>
                </div>
              </div>
            )}

            {scanState === "claiming" && (
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
                    Verifying device...
                  </p>

                  <p
                    className={`mt-1 text-sm ${muted}`}
                  >
                    Checking the temporary token,
                    ownership and device security.
                  </p>
                </div>
              </div>
            )}

            {scanState === "success" &&
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
                      className={`mt-1 text-sm leading-6 ${muted}`}
                    >
                      {successMessage}
                    </p>
                  </div>
                </div>
              )}

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

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={startCamera}
                disabled={busy || scanState === "success"}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: THEME_COLOR,
                }}
              >
                {scanState === "scanning" ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Camera size={18} />
                    Scan with Camera
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={busy || scanState === "success"}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${glassSoft}`}
              >
                {scanState === "reading" ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    Reading...
                  </>
                ) : (
                  <>
                    <ImagePlus size={18} />
                    Upload QR Image
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleQrImage}
                className="hidden"
              />
            </div>

            {scanState === "scanning" && (
              <button
                type="button"
                onClick={async () => {
                  await stopCamera();
                  setScanState("idle");
                }}
                className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition hover:opacity-80 ${glassSoft}`}
              >
                Stop Camera
              </button>
            )}

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
                    Secure device claim
                  </p>

                  <p
                    className={`mt-1 text-sm leading-6 ${muted}`}
                  >
                    The QR contains a short-lived
                    one-time claim token, not the
                    permanent device secret. Ownership,
                    room authorization and device
                    security are checked by the server
                    before the device is added.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  router.push(backHref)
                }
                disabled={scanState === "claiming"}
                className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${glassSoft}`}
              >
                <ArrowLeft size={18} />
                Back
              </button>

              <button
                type="button"
                onClick={continueToVerification}
                disabled={
                  !claimToken ||
                  scanState === "claiming" ||
                  scanState === "success"
                }
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  backgroundColor: THEME_COLOR,
                }}
              >
                {scanState === "claiming" ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    Verifying...
                  </>
                ) : scanState === "success" ? (
                  <>
                    <CheckCircle2 size={18} />
                    Connected
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Verify Device
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
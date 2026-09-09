"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

export function BackgroundSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const {
    background,
    backgroundUploadedAt,
    uploadingBackground,
    uploadBackground,
    removeBackground,
    darkMode,
  } = useMasterTheme();

  if (!open) return null;

  async function handleUpload(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be smaller than 8MB.");
      return;
    }

    try {
      await uploadBackground(file);
      onClose();
    } catch (uploadError) {
      console.error(uploadError);
      setError("Could not upload background image.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError("");
    try {
      await removeBackground();
    } catch (removeError) {
      console.error(removeError);
      setError("Could not remove background image.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !uploadingBackground) onClose();
      }}
    >
      <div
        className={`w-full max-w-md rounded-[32px] border p-7 shadow-2xl backdrop-blur-2xl ${
          darkMode
            ? "border-white/20 bg-slate-900/90 text-white"
            : "border-black/10 bg-white/90 text-black"
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                darkMode ? "border-white/10 bg-white/10" : "border-black/10 bg-black/5"
              }`}
            >
              <ImageIcon size={24} />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Global Background</h2>
            <p className={`mt-1 text-sm leading-6 ${darkMode ? "text-white/50" : "text-black/50"}`}>
              This image is used on every page and automatically expires after 30 days.
            </p>
          </div>

          <button
            type="button"
            disabled={uploadingBackground}
            onClick={onClose}
            className={`rounded-xl p-2 disabled:opacity-40 ${
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
          style={{ backgroundImage: `url("${background}")` }}
        />

        {backgroundUploadedAt && (
          <p className={`mt-3 text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
            Uploaded {new Date(backgroundUploadedAt).toLocaleDateString()}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />

        <button
          type="button"
          disabled={uploadingBackground}
          onClick={() => inputRef.current?.click()}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-semibold disabled:opacity-50 ${
            darkMode
              ? "border-white/10 bg-white/10 text-white hover:bg-white/20"
              : "border-black/10 bg-black/5 text-black hover:bg-black/10"
          }`}
        >
          {uploadingBackground ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={18} />
              Upload New Image
            </>
          )}
        </button>

        {backgroundUploadedAt && (
          <button
            type="button"
            disabled={uploadingBackground}
            onClick={() => void handleRemove()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 py-4 font-semibold text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            <Trash2 size={18} />
            Remove Custom Background
          </button>
        )}
      </div>
    </div>
  );
}

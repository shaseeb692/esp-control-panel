"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

export default function ResetPasswordPage() {
  const router = useRouter();

  const {
    glass,
    glassSoft,
    muted,
    darkMode,
    loading: themeLoading,
  } = useMasterTheme();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "This password reset link is invalid or has expired. Please request a new one."
        );
      }

      setCheckingSession(false);
    }

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setError("");
          setCheckingSession(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Your reset session has expired. Please request a new password reset email."
        );

        setLoading(false);
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(
        "Password updated successfully!"
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/auth/login");
      }, 1500);
    } catch (err) {
      console.error(err);

      setError(
        "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  }

  if (checkingSession || themeLoading) {
    return (
      <main
        className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 ${
          darkMode ? "text-white" : "text-slate-950"
        }`}
      >
        <div className="relative z-10 text-center">
          <Loader2
            size={34}
            className={`mx-auto animate-spin ${
              darkMode ? "text-cyan-300" : "text-cyan-600"
            }`}
          />

          <p className={`mt-4 text-sm ${muted}`}>
            Verifying password reset link...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 ${
        darkMode ? "text-white" : "text-slate-950"
      }`}
    >
      <div className="relative z-10 w-full max-w-md">

        {/* HEADER */}
        <div className="mb-8 text-center">

          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${glassSoft}`}
          >
            <Lock
              size={30}
              className={
                darkMode
                  ? "text-cyan-300"
                  : "text-cyan-700"
              }
            />
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Set New Password
          </h1>

          <p className={`mt-2 text-sm ${muted}`}>
            Create a new password for your account
          </p>

        </div>

        {/* CARD */}
        <div
          className={`rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl sm:p-8 ${glass}`}
        >

          {error && (
            <div className="mb-5 flex gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-5 flex gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-500">
              <CheckCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>{success}</p>
            </div>
          )}

          <form
            onSubmit={handleUpdatePassword}
            className="space-y-5"
          >

            {/* NEW PASSWORD */}
            <div>
              <label
                className={`mb-2 block text-sm font-medium ${
                  darkMode ? "text-white/75" : "text-black/70"
                }`}
              >
                New Password
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                    darkMode ? "text-white/40" : "text-black/40"
                  }`}
                />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-12 outline-none backdrop-blur-xl transition ${
                    darkMode
                      ? "border-white/15 bg-black/20 text-white placeholder:text-white/30 focus:border-cyan-300"
                      : "border-black/10 bg-white/20 text-black placeholder:text-black/35 focus:border-cyan-600"
                  }`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 ${
                    darkMode
                      ? "text-white/40 hover:text-white/80"
                      : "text-black/40 hover:text-black/80"
                  }`}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              <p className={`mt-2 text-xs ${muted}`}>
                Minimum 8 characters
              </p>
            </div>

            {/* CONFIRM */}
            <div>
              <label
                className={`mb-2 block text-sm font-medium ${
                  darkMode ? "text-white/75" : "text-black/70"
                }`}
              >
                Confirm Password
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                    darkMode ? "text-white/40" : "text-black/40"
                  }`}
                />

                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-12 outline-none backdrop-blur-xl transition ${
                    darkMode
                      ? "border-white/15 bg-black/20 text-white placeholder:text-white/30 focus:border-cyan-300"
                      : "border-black/10 bg-white/20 text-black placeholder:text-black/35 focus:border-cyan-600"
                  }`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 ${
                    darkMode
                      ? "text-white/40 hover:text-white/80"
                      : "text-black/40 hover:text-black/80"
                  }`}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* UPDATE */}
            <button
              type="submit"
              disabled={
                loading ||
                !password ||
                !confirmPassword
              }
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                darkMode
                  ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                  : "bg-cyan-600 text-white hover:bg-cyan-700"
              }`}
            >
              {loading ? (
                <>
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </button>

          </form>

          {/* BACK */}
          <button
            type="button"
            onClick={() =>
              router.replace("/auth/login")
            }
            className={`mt-6 w-full text-center text-sm transition ${
              darkMode
                ? "text-white/50 hover:text-white/80"
                : "text-black/50 hover:text-black/80"
            }`}
          >
            ← Back to Login
          </button>

        </div>
      </div>
    </main>
  );
}
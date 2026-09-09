"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const {
    glass,
    glassSoft,
    muted,
    darkMode,
    loading: themeLoading,
  } = useMasterTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setCheckingSession(false);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        setLoading(false);
        return;
      }

      setSuccess("Login successful. Opening dashboard...");

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);

      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError(
        "Enter your email address first, then click Forgot password."
      );
      return;
    }

    setForgotLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo:
              `${window.location.origin}/auth/reset-password`,
          }
        );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(
        "Password reset email sent. Check your inbox."
      );
    } catch (error) {
      console.error(error);

      setError("Unable to send password reset email.");
    } finally {
      setForgotLoading(false);
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
            size={32}
            className="mx-auto animate-spin text-cyan-300"
          />

          <p className={`mt-3 text-sm ${muted}`}>
            Loading...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 ${darkMode ? "text-white" : "text-slate-950"}`}
    >
      <div className="relative z-10 w-full max-w-md">

        {/* HEADER */}
        <div className="mb-8 text-center">

          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${glassSoft}`}
          >
            <Lock
              size={30}
              className="text-cyan-300"
            />
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            ESP Control Center
          </h1>

          <p className={`mt-2 text-sm ${muted}`}>
            Sign in to manage your devices
          </p>

        </div>

        {/* CARD */}
        <div
          className={`rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl sm:p-8 ${glass}`}
        >

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >

            {/* EMAIL */}
            <div>
              <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-white/80" : "text-black/75"}`}>
                Email
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${darkMode ? "text-white/45" : "text-black/45"}`}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading || forgotLoading}
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-4 outline-none backdrop-blur-xl transition disabled:opacity-60 ${darkMode ? "border-white/15 bg-black/20 text-white placeholder:text-white/35 focus:border-cyan-300" : "border-black/10 bg-white/35 text-black placeholder:text-black/35 focus:border-cyan-600"}`}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-white/80" : "text-black/75"}`}>
                Password
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${darkMode ? "text-white/45" : "text-black/45"}`}
                />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading || forgotLoading}
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-12 outline-none backdrop-blur-xl transition disabled:opacity-60 ${darkMode ? "border-white/15 bg-black/20 text-white placeholder:text-white/35 focus:border-cyan-300" : "border-black/10 bg-white/35 text-black placeholder:text-black/35 focus:border-cyan-600"}`}
                />

                <button
                  type="button"
                  disabled={loading || forgotLoading}
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 transition disabled:opacity-50 ${darkMode ? "text-white/45 hover:text-white/85" : "text-black/45 hover:text-black/80"}`}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* OPTIONS */}
            <div className="flex items-center justify-between">

              <label className={`flex cursor-pointer items-center gap-2 text-sm ${muted}`}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                  disabled={loading || forgotLoading}
                  className="h-4 w-4 rounded accent-cyan-500"
                />

                Remember me
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading || forgotLoading}
                className="flex items-center gap-1.5 text-sm text-cyan-300 transition hover:text-cyan-200 disabled:opacity-50"
              >
                {forgotLoading ? (
                  <>
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                    Sending...
                  </>
                ) : (
                  <>
                    <KeyRound size={15} />
                    Forgot password?
                  </>
                )}
              </button>

            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                <CheckCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>{success}</span>
              </div>
            )}

            {/* LOGIN */}
            <button
              type="submit"
              disabled={loading || forgotLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>

          </form>

          {/* SIGNUP */}
          <div className="mt-6 border-t border-white/10 pt-6 text-center">

            <p className={`text-sm ${muted}`}>
              Don't have an account?
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/auth/signup")
              }
              className="mt-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
            >
              Create an account
            </button>

          </div>

        </div>

        <p className={`mt-6 text-center text-xs ${muted}`}>
          Secure device management
        </p>

      </div>
    </main>
  );
}
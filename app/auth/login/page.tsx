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
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

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

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
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

      setSuccess(
        "Login successful. Opening dashboard..."
      );

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        "Something went wrong. Please try again."
      );

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

      setError(
        "Unable to send password reset email."
      );
    } finally {
      setForgotLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto animate-spin text-cyan-400"
          />

          <p className="mt-3 text-sm text-slate-400">
            Loading...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md">

        <div className="mb-8 text-center">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
            <Lock size={30} />
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            ESP Control Center
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Sign in to manage your devices
          </p>

        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email
              </label>

              <div className="relative">

                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={
                    loading || forgotLoading
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-4 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 disabled:opacity-60"
                />

              </div>

            </div>

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </label>

              <div className="relative">

                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={
                    loading || forgotLoading
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 disabled:opacity-60"
                />

                <button
                  type="button"
                  disabled={
                    loading || forgotLoading
                  }
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-slate-300 disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

            </div>

            <div className="flex items-center justify-between">

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">

                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(
                      event.target.checked
                    )
                  }
                  disabled={
                    loading || forgotLoading
                  }
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-cyan-500"
                />

                Remember me

              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={
                  loading || forgotLoading
                }
                className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
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

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">

                <CheckCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {success}
                </span>

              </div>
            )}

            <button
              type="submit"
              disabled={
                loading || forgotLoading
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
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

          <div className="mt-6 border-t border-slate-800 pt-6 text-center">

            <p className="text-sm text-slate-500">
              Don't have an account?
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/auth/signup")
              }
              className="mt-2 text-sm font-medium text-cyan-400 hover:text-cyan-300"
            >
              Create an account
            </button>

          </div>

        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Secure device management
        </p>

      </div>
    </main>
  );
}
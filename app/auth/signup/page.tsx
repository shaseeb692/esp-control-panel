"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

export default function SignupPage() {
  const router = useRouter();

  const {
    glass,
    glassSoft,
    muted,
    darkMode,
  } = useMasterTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
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
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },

          emailRedirectTo:
            `${window.location.origin}/auth/login`,
        },
      });

      if (signupError) {
        setError(signupError.message);
        setLoading(false);
        return;
      }

      if (data.user && !data.session) {
        setSuccess(
          "Account created! Check your email and confirm your account before logging in."
        );

        setLoading(false);
        return;
      }

      if (data.session) {
        setSuccess(
          "Account created successfully. Opening dashboard..."
        );

        setTimeout(() => {
          router.replace("/");
          router.refresh();
        }, 1000);

        return;
      }

      setLoading(false);
    } catch (error) {
      console.error(error);

      setError(
        "Something went wrong. Please try again."
      );

      setLoading(false);
    }
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
            <User
              size={30}
              className={
                darkMode
                  ? "text-cyan-300"
                  : "text-cyan-700"
              }
            />
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Create Account
          </h1>

          <p className={`mt-2 text-sm ${muted}`}>
            Create your ESP Control Center account
          </p>

        </div>

        {/* CARD */}
        <div
          className={`rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl sm:p-8 ${glass}`}
        >

          <form
            onSubmit={handleSignup}
            className="space-y-5"
          >

            {/* NAME */}
            <div>
              <label
                className={`mb-2 block text-sm font-medium ${
                  darkMode ? "text-white/75" : "text-black/70"
                }`}
              >
                Full Name
              </label>

              <div className="relative">
                <User
                  size={18}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                    darkMode ? "text-white/40" : "text-black/40"
                  }`}
                />

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Your full name"
                  autoComplete="name"
                  disabled={loading}
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-4 outline-none backdrop-blur-xl transition disabled:opacity-60 ${
                    darkMode
                      ? "border-white/15 bg-black/20 text-white placeholder:text-white/30 focus:border-cyan-300"
                      : "border-black/10 bg-white/20 text-black placeholder:text-black/35 focus:border-cyan-600"
                  }`}
                />
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label
                className={`mb-2 block text-sm font-medium ${
                  darkMode ? "text-white/75" : "text-black/70"
                }`}
              >
                Email
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                    darkMode ? "text-white/40" : "text-black/40"
                  }`}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-4 outline-none backdrop-blur-xl transition disabled:opacity-60 ${
                    darkMode
                      ? "border-white/15 bg-black/20 text-white placeholder:text-white/30 focus:border-cyan-300"
                      : "border-black/10 bg-white/20 text-black placeholder:text-black/35 focus:border-cyan-600"
                  }`}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                className={`mb-2 block text-sm font-medium ${
                  darkMode ? "text-white/75" : "text-black/70"
                }`}
              >
                Password
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
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  disabled={loading}
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-12 outline-none backdrop-blur-xl transition disabled:opacity-60 ${
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
                  disabled={loading}
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
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  disabled={loading}
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-12 outline-none backdrop-blur-xl transition disabled:opacity-60 ${
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
                  disabled={loading}
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

            {/* ERROR */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-500">
                <CheckCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />
                <span>{success}</span>
              </div>
            )}

            {/* CREATE */}
            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>

          </form>

          {/* LOGIN */}
          <div
            className={`mt-6 border-t pt-6 text-center ${
              darkMode
                ? "border-white/10"
                : "border-black/10"
            }`}
          >
            <p className={`text-sm ${muted}`}>
              Already have an account?
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/auth/login")
              }
              className={`mt-2 text-sm font-medium ${
                darkMode
                  ? "text-cyan-300 hover:text-cyan-200"
                  : "text-cyan-700 hover:text-cyan-800"
              }`}
            >
              Sign in
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
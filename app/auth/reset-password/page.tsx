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

export default function ResetPasswordPage() {
  const router = useRouter();

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

  /* =====================================================
     CHECK RECOVERY SESSION
  ===================================================== */

  useEffect(() => {
    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      /*
        Recovery link should create a temporary
        authenticated session.

        We DO NOT redirect to dashboard here.
      */

      if (!session) {
        setError(
          "This password reset link is invalid or has expired. Please request a new one."
        );
      }

      setCheckingSession(false);
    }

    checkRecoverySession();

    /* ===================================================
       LISTEN FOR PASSWORD RECOVERY EVENT
    =================================================== */

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

  /* =====================================================
     UPDATE PASSWORD
  ===================================================== */

  async function handleUpdatePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    /* -----------------------------------------------
       PASSWORD CHECK
    ----------------------------------------------- */

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
      /* ---------------------------------------------
         MAKE SURE SESSION EXISTS
      --------------------------------------------- */

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

      /* ---------------------------------------------
         UPDATE PASSWORD
      --------------------------------------------- */

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      /* ---------------------------------------------
         SUCCESS
      --------------------------------------------- */

      setSuccess(
        "Password updated successfully!"
      );

      /*
        Sign out the recovery session so the user
        must use the new password to login.
      */

      await supabase.auth.signOut();

      /*
        Give the user a moment to see success message.
      */

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

  /* =====================================================
     LOADING
  ===================================================== */

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">

        <div className="text-center">

          <Loader2
            size={34}
            className="mx-auto animate-spin text-cyan-400"
          />

          <p className="mt-4 text-sm text-slate-400">
            Verifying password reset link...
          </p>

        </div>

      </main>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">

      <div className="w-full max-w-md">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8 text-center">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">

            <Lock size={30} />

          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Set New Password
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Create a new password for your account
          </p>

        </div>

        {/* =================================================
            CARD
        ================================================= */}

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">

          {error && (
            <div className="mb-5 flex gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">

              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>{error}</p>

            </div>
          )}

          {success && (
            <div className="mb-5 flex gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-400">

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

            {/* =================================================
                NEW PASSWORD
            ================================================= */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                New Password
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
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-slate-300"
                >

                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}

                </button>

              </div>

              <p className="mt-2 text-xs text-slate-600">
                Minimum 8 characters
              </p>

            </div>

            {/* =================================================
                CONFIRM PASSWORD
            ================================================= */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Confirm Password
              </label>

              <div className="relative">

                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-slate-300"
                >

                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}

                </button>

              </div>

            </div>

            {/* =================================================
                UPDATE BUTTON
            ================================================= */}

            <button
              type="submit"
              disabled={
                loading ||
                !password ||
                !confirmPassword
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
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

          {/* =================================================
              BACK TO LOGIN
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              router.replace("/auth/login")
            }
            className="mt-6 w-full text-center text-sm text-slate-500 transition hover:text-slate-300"
          >
            ← Back to Login
          </button>

        </div>

      </div>

    </main>
  );
}
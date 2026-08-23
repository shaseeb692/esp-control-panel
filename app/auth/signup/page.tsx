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

export default function SignupPage() {
  const router = useRouter();

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

  /* =====================================================
     SIGN UP
  ===================================================== */

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    /* -----------------------------------------------
       VALIDATION
    ----------------------------------------------- */

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
      /* ---------------------------------------------
         CREATE SUPABASE USER
      --------------------------------------------- */

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

      /* ---------------------------------------------
         EMAIL VERIFICATION REQUIRED
      --------------------------------------------- */

      if (
        data.user &&
        !data.session
      ) {
        setSuccess(
          "Account created! Check your email and confirm your account before logging in."
        );

        setLoading(false);
        return;
      }

      /* ---------------------------------------------
         IF EMAIL CONFIRMATION IS DISABLED
      --------------------------------------------- */

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

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">

      <div className="w-full max-w-md">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8 text-center">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">

            <User size={30} />

          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Create Account
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Create your ESP Control Center account
          </p>

        </div>

        {/* =================================================
            CARD
        ================================================= */}

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">

          <form
            onSubmit={handleSignup}
            className="space-y-5"
          >

            {/* =================================================
                NAME
            ================================================= */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Full Name
              </label>

              <div className="relative">

                <User
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Syed Haseeb Ur Rahman"
                  autoComplete="name"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-4 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 disabled:opacity-60"
                />

              </div>

            </div>

            {/* =================================================
                EMAIL
            ================================================= */}

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
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-4 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 disabled:opacity-60"
                />

              </div>

            </div>

            {/* =================================================
                PASSWORD
            ================================================= */}

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
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  disabled={loading}
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
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  disabled={loading}
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
                ERROR
            ================================================= */}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">

                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>{error}</span>

              </div>
            )}

            {/* =================================================
                SUCCESS
            ================================================= */}

            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">

                <CheckCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>{success}</span>

              </div>
            )}

            {/* =================================================
                CREATE ACCOUNT
            ================================================= */}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
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

          {/* =================================================
              LOGIN
          ================================================= */}

          <div className="mt-6 border-t border-slate-800 pt-6 text-center">

            <p className="text-sm text-slate-500">
              Already have an account?
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/auth/login")
              }
              className="mt-2 text-sm font-medium text-cyan-400 hover:text-cyan-300"
            >
              Sign in
            </button>

          </div>

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <p className="mt-6 text-center text-xs text-slate-600">
          Secure device management
        </p>

      </div>

    </main>
  );
}
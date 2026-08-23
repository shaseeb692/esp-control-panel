"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const THEME_COLOR = "#42B8C5";

export default function VerifyPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const storedEmail =
      sessionStorage.getItem("auth_email");

    if (!storedEmail) {
      router.replace("/auth/login");
      return;
    }

    setEmail(storedEmail);
  }, [router]);

  async function verifyOtp(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: "email",
        });

      if (error) {
        throw error;
      }

      sessionStorage.removeItem("auth_email");

      setSuccess("Verified successfully.");

      setTimeout(() => {
        router.replace("/dashboard");
      }, 500);

    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid or expired OTP.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!email) return;

    setError("");
    setSuccess("");
    setResending(true);

    try {
      const { error } =
        await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
          },
        });

      if (error) {
        throw error;
      }

      setSuccess("A new OTP has been sent.");
      setOtp("");

    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not resend OTP.");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7fbfc] px-4 py-8">
      <div className="mx-auto flex min-h-[90vh] max-w-md items-center justify-center">

        <div className="w-full rounded-[30px] border border-slate-100 bg-white p-7 shadow-sm">

          <button
            onClick={() =>
              router.push("/auth/login")
            }
            className="mb-8 flex items-center gap-2 text-sm text-slate-400"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="mb-8">

            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundColor: THEME_COLOR,
              }}
            >
              <CheckCircle2 size={27} />
            </div>

            <p className="text-xs font-medium tracking-wider text-slate-400">
              VERIFY EMAIL
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-slate-700">
              Enter your OTP
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              We sent a 6-digit verification code to:
            </p>

            <p className="mt-1 break-all text-sm font-semibold text-slate-600">
              {email}
            </p>

          </div>

          <form onSubmit={verifyOtp}>

            <label className="mb-2 block text-sm font-medium text-slate-500">
              Verification code
            </label>

            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              placeholder="000000"
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-semibold tracking-[0.5em] outline-none transition focus:border-[#42B8C5]"
            />

            {error && (
              <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-600">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-white disabled:opacity-60"
              style={{
                backgroundColor: THEME_COLOR,
              }}
            >
              {loading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </button>

          </form>

          <button
            onClick={resendOtp}
            disabled={resending}
            className="mt-5 w-full text-center text-sm font-medium disabled:opacity-50"
            style={{
              color: THEME_COLOR,
            }}
          >
            {resending
              ? "Sending..."
              : "Didn't receive the code? Resend"}
          </button>

        </div>

      </div>
    </main>
  );
}
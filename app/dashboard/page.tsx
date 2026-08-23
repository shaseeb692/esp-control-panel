"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setEmail(user.email ?? "");
    }

    checkUser();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <main className="min-h-screen bg-[#f7fbfc] p-6">
      <div className="mx-auto max-w-5xl">

        <div className="rounded-[30px] bg-white p-7 shadow-sm">

          <p className="text-sm text-slate-400">
            SMART HOME
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-slate-700">
            Dashboard
          </h1>

          <p className="mt-2 text-slate-400">
            Logged in as {email}
          </p>

          <button
            onClick={logout}
            className="mt-6 rounded-2xl bg-slate-800 px-5 py-3 font-semibold text-white"
          >
            Logout
          </button>

        </div>

      </div>
    </main>
  );
}
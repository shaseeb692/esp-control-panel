"use client";

import { useState, type ReactNode } from "react";
import { Image as ImageIcon, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";
import { BackgroundSettingsModal } from "@/components/layout/BackgroundSettingsModal";

export function GlobalHeaderActions({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const { darkMode } = useMasterTheme();
  const [showBackground, setShowBackground] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const actionClass = `flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-semibold backdrop-blur-xl transition sm:px-4 sm:text-sm ${
    darkMode
      ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
      : "border-black/10 bg-black/10 text-black hover:bg-black/15"
  }`;

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/auth/login");
    }
  }

  return (
    <>
      {children}
      <button type="button" onClick={() => setShowBackground(true)} className={actionClass}>
        <ImageIcon size={16} />
        <span className="hidden lg:inline">Background</span>
      </button>
      <button type="button" onClick={() => void logout()} disabled={loggingOut} className={actionClass}>
        <LogOut size={16} />
        <span className="hidden lg:inline">{loggingOut ? "Signing out" : "Logout"}</span>
      </button>
      <BackgroundSettingsModal open={showBackground} onClose={() => setShowBackground(false)} />
    </>
  );
}

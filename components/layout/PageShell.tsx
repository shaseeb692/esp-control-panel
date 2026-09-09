"use client";

import type { ReactNode } from "react";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

export function PageShell({
  children,
  maxWidth = "max-w-6xl",
  className = "",
}: {
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}) {
  const { darkMode } = useMasterTheme();
  return (
    <main
      className={`relative min-h-screen overflow-hidden transition-colors duration-700 ${
        darkMode ? "text-white" : "text-black"
      } ${className}`}
    >
      <div className={`relative z-10 mx-auto min-h-screen ${maxWidth} px-4 py-5 sm:px-6`}>
        {children}
      </div>
    </main>
  );
}

"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
};

export function AppHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  backHref,
  backLabel = "Back",
  actions,
  className = "",
}: AppHeaderProps) {
  const router = useRouter();
  const { glass, glassSoft, muted, darkMode } = useMasterTheme();

  return (
    <header
      className={`mb-5 rounded-[28px] border p-4 shadow-2xl backdrop-blur-2xl sm:p-5 ${glass} ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {backHref && (
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className={`mb-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${glassSoft}`}
            >
              <ArrowLeft size={15} />
              {backLabel}
            </button>
          )}

          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${glassSoft}`}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    darkMode ? "text-cyan-200" : "text-cyan-700"
                  }`}
                >
                  {eyebrow}
                </p>
              )}
              <h1 className="truncate text-xl font-semibold sm:text-2xl">{title}</h1>
              {subtitle && <p className={`mt-1 truncate text-sm ${muted}`}>{subtitle}</p>}
            </div>
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}

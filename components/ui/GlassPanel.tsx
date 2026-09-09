"use client";

import type { HTMLAttributes } from "react";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

type Props = HTMLAttributes<HTMLDivElement> & {
  soft?: boolean;
};

export function GlassPanel({ soft = false, className = "", ...props }: Props) {
  const { glass, glassSoft } = useMasterTheme();
  return (
    <div
      className={`border shadow-2xl backdrop-blur-2xl ${soft ? glassSoft : glass} ${className}`}
      {...props}
    />
  );
}

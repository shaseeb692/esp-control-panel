"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMasterTheme } from "@/components/theme/MasterThemeProvider";

/**
 * Legacy compatibility route.
 * Device controls now live directly on the Room page so users never need
 * to open one page per device. Old bookmarks are redirected automatically.
 */
export default function LegacyRoomDevicePage() {
  const params = useParams();
  const router = useRouter();
  const { muted } = useMasterTheme();
  const houseId = String(params.houseId ?? "");
  const roomId = String(params.roomId ?? "");

  useEffect(() => {
    if (houseId && roomId) router.replace(`/house/${houseId}/room/${roomId}`);
  }, [houseId, roomId, router]);

  return (
    <main className="smart-theme-page flex min-h-screen items-center justify-center p-6">
      <div className={`flex items-center gap-3 text-sm ${muted}`}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Opening room controls...
      </div>
    </main>
  );
}

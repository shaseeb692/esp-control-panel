import { Suspense } from "react";
import ClaimDeviceClient from "./ClaimDeviceClient";

function ClaimPageLoading() {
  return (
    <main className="min-h-screen">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />

          <p className="mt-4 text-sm opacity-60">
            Loading device setup...
          </p>
        </div>
      </div>
    </main>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<ClaimPageLoading />}>
      <ClaimDeviceClient />
    </Suspense>
  );
}

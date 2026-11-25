"use client";

import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 border-b border-amber-300 px-4 py-2 text-xs font-semibold text-amber-950"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You are offline — your Weekly QR Pass still works! Pending updates will
        sync once connection returns.
      </span>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, SunMedium, WifiOff } from "lucide-react";
import { toast } from "sonner";
import {
  buildQrPayload,
  formatManilaDate,
  getSaturdayServiceDate,
} from "@/lib/format";
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DiscipleshipTier } from "@/types/database.types";

const STORAGE_KEY = "sycc_offline_qr_profile_v1";
const emptySubscribe = () => () => {};

export interface QrProfileSnapshot {
  id: string;
  full_name: string;
  nickname: string | null;
  tier: DiscipleshipTier;
  current_leader_id: string | null;
  consecutive_saturday_streak: number;
}

export function OfflineQrPass({
  serverProfile,
}: {
  serverProfile: QrProfileSnapshot | null;
}) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Sync fresh server profile into localStorage for zero-signal Saturday check-in
  useEffect(() => {
    if (!serverProfile) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serverProfile));
    } catch {
      // Ignore storage quota issues
    }
  }, [serverProfile]);

  const cachedProfile = useMemo<QrProfileSnapshot | null>(() => {
    if (serverProfile || !isClient) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QrProfileSnapshot) : null;
    } catch {
      return null;
    }
  }, [serverProfile, isClient]);

  const profile = serverProfile ?? cachedProfile;
  const fromOfflineCache = !serverProfile && Boolean(cachedProfile);
  const serviceDate = isClient ? getSaturdayServiceDate("upcoming") : "";

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly QR Pass Unavailable Offline</CardTitle>
          <CardDescription>
            Sign in once while connected to the internet so your device caches
            your QR identity for offline Saturday check-ins.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const effectiveDate = serviceDate || "2026-01-03";
  const payload = buildQrPayload(profile.id, effectiveDate);
  const hierarchy = getHierarchyStyle(profile.tier, profile.current_leader_id);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("QR code string copied.");
    } catch {
      toast.error("Unable to copy to clipboard.");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card className="overflow-hidden border-2 border-slate-200 shadow-sm">
        <div
          className="px-6 py-5 border-b border-slate-200"
          style={{ background: "var(--banner-gradient)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A]">
              SYCC Saturday Pass
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs",
                hierarchy.badgeClass
              )}
            >
              {hierarchy.label}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
            {profile.full_name}
          </h1>
          <p className="text-xs font-medium text-slate-700 mt-0.5">
            Service Date: <strong>{formatManilaDate(effectiveDate)}</strong> ·
            Streak: <strong>{profile.consecutive_saturday_streak} wks</strong>
          </p>
        </div>

        <CardContent className="flex flex-col items-center p-6 space-y-4 bg-white">
          <div className="rounded-3xl border-4 border-slate-900 bg-white p-5 shadow-xs">
            <QRCodeSVG
              value={payload}
              size={232}
              level="M"
              includeMargin={false}
              bgColor="#FFFFFF"
              fgColor="#0F172A"
            />
          </div>

          <div className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-center">
            <p className="font-mono text-[11px] text-slate-600 break-all">
              {payload}
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <SunMedium className="h-4 w-4 text-amber-500" />
              Raise screen brightness at door
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyCode}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>

          <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2">
            {fromOfflineCache ? (
              <>
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>Loaded from offline device cache (0 KB server cost).</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Offline-ready! Your pass is cached locally for zero-signal
                  Saturday check-ins.
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSaturdayServiceDate } from "@/lib/format";
import {
  RegistrarWorkspace,
  type HistoricalSaturdayStat,
} from "@/components/registrar/RegistrarWorkspace";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Registrar Check-In Desk",
};

async function RegistrarContent() {
  await requirePageRole(["registrar"]);
  const supabase = await createServerSupabaseClient();
  const serviceDate = getSaturdayServiceDate("upcoming");

  const [rosterRes, todayLogsRes, recentLogsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("attendance_logs")
      .select("*")
      .eq("service_date", serviceDate)
      .order("checked_in_at", { ascending: false }),
    supabase
      .from("attendance_logs")
      .select("service_date")
      .order("service_date", { ascending: false })
      .limit(500),
  ]);

  const countsByDate = new Map<string, number>();
  for (const row of recentLogsRes.data ?? []) {
    countsByDate.set(
      row.service_date,
      (countsByDate.get(row.service_date) ?? 0) + 1
    );
  }
  const history: HistoricalSaturdayStat[] = Array.from(countsByDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)
    .map(([d, count]) => ({ serviceDate: d, count }));

  return (
    <RegistrarWorkspace
      serviceDate={serviceDate}
      roster={rosterRes.data ?? []}
      todayLogs={todayLogsRes.data ?? []}
      history={history}
    />
  );
}

export default function RegistrarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <div className="grid grid-cols-5 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </div>
      }
    >
      <RegistrarContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSaturdayServiceDate } from "@/lib/format";
import { TreasurerWorkspace } from "@/components/treasurer/TreasurerWorkspace";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  EligibleCounter,
  LiquidationExpenseRow,
} from "@/types/database.types";

export const metadata = {
  title: "Treasury & Liquidation",
};

async function TreasurerContent() {
  const profile = await requirePageRole(["treasurer"]);
  const supabase = await createServerSupabaseClient();
  const serviceDate = getSaturdayServiceDate("upcoming");

  const [
    rosterRes,
    attendanceRes,
    entriesRes,
    liquidationRes,
    countersRes,
    recentSheetsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, nickname")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("attendance_logs")
      .select("profile_id")
      .eq("service_date", serviceDate)
      .order("checked_in_at", { ascending: false }),
    supabase
      .from("tithes_and_offerings")
      .select("*")
      .eq("service_date", serviceDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("cash_liquidations")
      .select("*")
      .eq("service_date", serviceDate)
      .maybeSingle(),
    supabase.rpc("list_eligible_counters"),
    supabase
      .from("cash_liquidations")
      .select("*")
      .order("service_date", { ascending: false })
      .limit(12),
  ]);

  let expenses: LiquidationExpenseRow[] = [];
  if (liquidationRes.data?.id) {
    const { data: expData } = await supabase
      .from("liquidation_expenses")
      .select("*")
      .eq("liquidation_id", liquidationRes.data.id)
      .order("created_at", { ascending: false });
    expenses = expData ?? [];
  }

  return (
    <TreasurerWorkspace
      currentProfileId={profile.id}
      serviceDate={serviceDate}
      roster={rosterRes.data ?? []}
      initialPresentIds={(attendanceRes.data ?? []).map((a) => a.profile_id)}
      todayEntries={entriesRes.data ?? []}
      liquidation={liquidationRes.data ?? null}
      expenses={expenses}
      eligibleCounters={(countersRes.data ?? []) as EligibleCounter[]}
      recentSheets={recentSheetsRes.data ?? []}
    />
  );
}

export default function TreasurerPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-80" />
          <div className="grid grid-cols-5 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-[540px] w-full rounded-2xl" />
        </div>
      }
    >
      <TreasurerContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveTheme } from "@/lib/theme";
import { PastorWorkspace } from "@/components/pastor/PastorWorkspace";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  PastorFinancialSummaryRow,
  UmbrellaCellCount,
} from "@/types/database.types";

export const metadata = {
  title: "Pastor Ministry Overview",
};

async function PastorContent() {
  await requirePageRole(["pastor"]);
  const supabase = await createServerSupabaseClient();

  const [theme, profilesRes, umbrellasRes, financeRes, eventsRes] =
    await Promise.all([
      getActiveTheme(),
      supabase
        .from("profiles")
        .select("tier, ministry_status")
        .eq("is_active", true),
      supabase.rpc("get_umbrella_cell_counts", { p_leader_id: null }),
      supabase.rpc("get_pastor_financial_summary", { p_limit: 12 }),
      supabase
        .from("church_events")
        .select("*")
        .order("event_date", { ascending: false })
        .limit(20),
    ]);

  const list = profilesRes.data ?? [];
  const stats = {
    totalYouth: list.length,
    cellLeaders: list.filter((p) => p.tier === "cell_leader").length,
    disciples: list.filter((p) => p.tier === "disciple").length,
    invites: list.filter((p) => p.tier === "invite").length,
    newInvites: list.filter((p) => p.tier === "new_invite").length,
    activeInMinistry: list.filter((p) => p.ministry_status === "active").length,
  };

  return (
    <PastorWorkspace
      theme={theme}
      stats={stats}
      umbrellas={(umbrellasRes.data ?? []) as UmbrellaCellCount[]}
      financials={(financeRes.data ?? []) as PastorFinancialSummaryRow[]}
      events={eventsRes.data ?? []}
    />
  );
}

export default function PastorPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <div className="grid grid-cols-6 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <PastorContent />
    </Suspense>
  );
}

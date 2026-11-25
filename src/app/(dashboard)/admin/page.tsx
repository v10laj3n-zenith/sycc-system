import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveTheme } from "@/lib/theme";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "System Admin Console",
};

async function AdminContent() {
  await requirePageRole(["system_admin"]);
  const supabase = await createServerSupabaseClient();

  const [theme, profilesRes, lockedRes, auditRes] = await Promise.all([
    getActiveTheme(),
    supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true }),
    supabase
      .from("cash_liquidations")
      .select("*")
      .eq("is_locked", true)
      .order("service_date", { ascending: false })
      .limit(20),
    supabase
      .from("system_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <AdminWorkspace
      theme={theme}
      profiles={profilesRes.data ?? []}
      lockedSheets={lockedRes.data ?? []}
      auditLogs={auditRes.data ?? []}
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

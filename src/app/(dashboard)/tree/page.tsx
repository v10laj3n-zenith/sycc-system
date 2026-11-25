import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DiscipleshipTreeCanvas } from "@/components/tree/DiscipleshipTreeCanvas";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiscipleshipTreeNode } from "@/types/database.types";

export const metadata = {
  title: "Discipleship Family Tree",
};

async function TreeContent() {
  const profile = await requirePageRole(["member", "cell_leader", "pastor"]);
  const supabase = await createServerSupabaseClient();

  const isGlobal =
    profile.role === "pastor" || profile.role === "system_admin";

  const { data } = await supabase.rpc("get_discipleship_tree", {
    p_root_id: isGlobal ? null : profile.id,
  });

  const nodes = (data ?? []) as DiscipleshipTreeNode[];

  return (
    <DiscipleshipTreeCanvas
      members={nodes}
      scopeTitle={
        isGlobal
          ? "Church-Wide Discipleship Family Tree"
          : "My Discipleship Family Tree"
      }
    />
  );
}

export default function TreePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[460px] w-full rounded-3xl" />
        </div>
      }
    >
      <TreeContent />
    </Suspense>
  );
}

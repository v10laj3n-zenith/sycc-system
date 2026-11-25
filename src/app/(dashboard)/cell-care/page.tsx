import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSaturdayServiceDate } from "@/lib/format";
import {
  CellCareClient,
  type MeetupSummary,
} from "@/components/cell/CellCareClient";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  RetentionRadarItem,
  UmbrellaCellCount,
} from "@/types/database.types";

export const metadata = {
  title: "My Cell & Care Vault",
};

async function CellCareContent() {
  const profile = await requirePageRole(["cell_leader"]);
  const supabase = await createServerSupabaseClient();
  const latestSaturday = getSaturdayServiceDate("latest");

  const [umbrellaRes, membersRes, radarRes, meetupsRes] = await Promise.all([
    supabase.rpc("get_umbrella_cell_counts", { p_leader_id: profile.id }),
    supabase
      .from("profiles")
      .select("*")
      .eq("current_leader_id", profile.id)
      .eq("is_active", true)
      .order("tier", { ascending: true })
      .order("full_name", { ascending: true }),
    supabase.rpc("get_retention_radar", {
      p_leader_id: profile.id,
      p_reference_saturday: latestSaturday,
    }),
    supabase
      .from("cell_meetups")
      .select("*")
      .eq("leader_id", profile.id)
      .order("scheduled_at", { ascending: false })
      .limit(12),
  ]);

  const rawMeetups = meetupsRes.data ?? [];
  let rsvpList: Array<{ meetup_id: string; status: string }> = [];
  if (rawMeetups.length > 0) {
    const { data } = await supabase
      .from("cell_meetup_rsvps")
      .select("meetup_id, status")
      .in(
        "meetup_id",
        rawMeetups.map((m) => m.id)
      );
    rsvpList = data ?? [];
  }

  const meetups: MeetupSummary[] = rawMeetups.map((m) => {
    const forThis = rsvpList.filter((r) => r.meetup_id === m.id);
    return {
      id: m.id,
      title: m.title,
      topic: m.topic,
      location: m.location,
      scheduled_at: m.scheduled_at,
      goingCount: forThis.filter((r) => r.status === "going").length,
      maybeCount: forThis.filter((r) => r.status === "maybe").length,
      notGoingCount: forThis.filter((r) => r.status === "not_going").length,
    };
  });

  const umbrellaSummary =
    ((umbrellaRes.data ?? []) as UmbrellaCellCount[])[0] ?? null;

  return (
    <CellCareClient
      umbrellaSummary={umbrellaSummary}
      cellMembers={membersRes.data ?? []}
      retentionRadar={(radarRes.data ?? []) as RetentionRadarItem[]}
      meetups={meetups}
    />
  );
}

export default function CellCarePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <CellCareContent />
    </Suspense>
  );
}

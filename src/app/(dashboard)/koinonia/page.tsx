import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  KoinoniaClient,
  type EventViewItem,
  type PrayerViewItem,
} from "@/components/koinonia/KoinoniaClient";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Prayer & Events",
};

async function KoinoniaContent() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [prayersRes, amensRes, eventsRes, rsvpsRes] = await Promise.all([
    supabase
      .from("koinonia_prayers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("prayer_amens").select("prayer_id, profile_id"),
    supabase
      .from("church_events")
      .select("*")
      .eq("is_published", true)
      .order("event_date", { ascending: true })
      .limit(20),
    supabase.from("event_rsvps").select("event_id, profile_id, status"),
  ]);

  const rawPrayers = prayersRes.data ?? [];
  const authorIds = Array.from(
    new Set(
      rawPrayers.filter((p) => !p.is_anonymous).map((p) => p.author_id)
    )
  );

  const authorNameMap = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, nickname")
      .in("id", authorIds);
    for (const a of authors ?? []) {
      authorNameMap.set(a.id, a.nickname || a.full_name);
    }
  }

  const amenList = amensRes.data ?? [];
  const prayers: PrayerViewItem[] = rawPrayers.map((p) => {
    const forThis = amenList.filter((a) => a.prayer_id === p.id);
    return {
      id: p.id,
      authorId: p.author_id,
      authorName: p.is_anonymous
        ? "Anonymous"
        : authorNameMap.get(p.author_id) ?? "SYCC Youth",
      content: p.content,
      isAnonymous: p.is_anonymous,
      isAnswered: p.is_answered,
      answeredTestimony: p.answered_testimony,
      createdAt: p.created_at,
      amenCount: forThis.length,
      hasPrayed: forThis.some((a) => a.profile_id === profile.id),
    };
  });

  const allEventRsvps = rsvpsRes.data ?? [];
  const events: EventViewItem[] = (eventsRes.data ?? []).map((ev) => {
    const evRsvps = allEventRsvps.filter((r) => r.event_id === ev.id);
    const mine = evRsvps.find((r) => r.profile_id === profile.id);
    return {
      id: ev.id,
      title: ev.title,
      description: ev.description,
      eventDate: ev.event_date,
      location: ev.location,
      goingCount: evRsvps.filter((r) => r.status === "going").length,
      myStatus: mine?.status ?? null,
    };
  });

  return (
    <KoinoniaClient
      currentProfileId={profile.id}
      prayers={prayers}
      events={events}
    />
  );
}

export default function KoinoniaPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      }
    >
      <KoinoniaContent />
    </Suspense>
  );
}

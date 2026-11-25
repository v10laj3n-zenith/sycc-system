import { Suspense } from "react";
import Link from "next/link";
import {
  Calendar,
  Flame,
  GitFork,
  HeartHandshake,
  MapPin,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveTheme } from "@/lib/theme";
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import { formatManilaDate, formatManilaDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CellMeetupRsvpBar } from "@/components/koinonia/CellMeetupRsvpBar";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Home",
};

function StreakMilestoneCard({
  tier,
  streak,
  longest,
  total,
}: {
  tier: string;
  streak: number;
  longest: number;
  total: number;
}) {
  const isLeaderOrAlumni = tier === "cell_leader" || tier === "alumni";
  const nextMilestone = tier === "new_invite" ? 4 : tier === "invite" ? 8 : 8;
  const clamped = Math.min(streak, nextMilestone);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-500" />
            Saturday Attendance Journey
          </CardTitle>
          <Badge variant="secondary">{total} Total Saturdays</Badge>
        </div>
        <CardDescription>
          Consistency builds relational roots — never graded, always celebrated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs font-medium text-slate-500">Current Streak</p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {streak}{" "}
              <span className="text-xs font-semibold text-slate-500">
                {streak === 1 ? "week" : "weeks"}
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs font-medium text-slate-500">Best Streak</p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {longest}{" "}
              <span className="text-xs font-semibold text-slate-500">
                {longest === 1 ? "week" : "weeks"}
              </span>
            </p>
          </div>
        </div>

        {!isLeaderOrAlumni && tier !== "disciple" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>
                {tier === "new_invite"
                  ? "Next Milestone: Regular Invite (4 consecutive Saturdays)"
                  : "Next Milestone: Consistent Disciple (8 consecutive Saturdays)"}
              </span>
              <span>
                {clamped}/{nextMilestone} wks
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => {
                const filled = i < streak;
                const isFourMark = i === 3;
                return (
                  <div
                    key={i}
                    className={cn(
                      "h-2.5 rounded-full transition-colors",
                      filled
                        ? "bg-[var(--color-accent)]"
                        : isFourMark && tier === "new_invite"
                        ? "bg-amber-200"
                        : "bg-slate-200"
                    )}
                  />
                );
              })}
            </div>
          </div>
        )}

        {tier === "disciple" && (
          <div className="rounded-xl border border-slate-200 bg-[#F1F5F9] px-3.5 py-2.5 text-xs font-medium text-[#334155]">
            Consistent Disciple — Keep growing and inviting friends into
            fellowship!
          </div>
        )}

        {tier === "cell_leader" && (
          <div className="rounded-xl border border-[#93C5FD] bg-[#DBEAFE]/70 px-3.5 py-2.5 text-xs font-semibold text-[#1E3A8A]">
            Serving as Cell Leader — Shepherd your cell with grace and
            consistency.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function HomeContent() {
  const [profile, theme] = await Promise.all([
    requireProfile(),
    getActiveTheme(),
  ]);

  const supabase = await createServerSupabaseClient();
  const hierarchy = getHierarchyStyle(profile.tier, profile.current_leader_id);

  // Fetch Cell Leader name, upcoming cell meetups, and upcoming church events
  const [leaderRes, meetupsRes, eventsRes] = await Promise.all([
    profile.current_leader_id
      ? supabase
          .from("profiles")
          .select("full_name, nickname")
          .eq("id", profile.current_leader_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile.current_leader_id
      ? supabase
          .from("cell_meetups")
          .select("id, title, topic, location, scheduled_at")
          .eq("leader_id", profile.current_leader_id)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(2)
      : Promise.resolve({ data: [] }),
    supabase
      .from("church_events")
      .select("id, title, event_date, location")
      .eq("is_published", true)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(3),
  ]);

  const upcomingMeetups = meetupsRes.data ?? [];
  let rsvpMap = new Map<string, "going" | "maybe" | "not_going">();
  if (upcomingMeetups.length > 0) {
    const { data: myRsvps } = await supabase
      .from("cell_meetup_rsvps")
      .select("meetup_id, status")
      .eq("member_id", profile.id)
      .in(
        "meetup_id",
        upcomingMeetups.map((m) => m.id)
      );
    rsvpMap = new Map((myRsvps ?? []).map((r) => [r.meetup_id, r.status]));
  }

  return (
    <div className="space-y-5">
      {/* Dynamic Seasonal Theme Hero Banner */}
      <section
        className="rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs"
        style={{ background: theme.banner_gradient }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-[#1E3A8A] shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{theme.season_title}</span>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs",
              hierarchy.badgeClass
            )}
          >
            {hierarchy.label}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
          Welcome, {profile.nickname || profile.full_name.split(" ")[0]}!
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700 italic">
          &ldquo;{theme.anchor_verse}&rdquo;{" "}
          {theme.verse_reference && (
            <span className="not-italic font-semibold text-slate-900">
              — {theme.verse_reference}
            </span>
          )}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/qr-pass">
              <QrCode className="h-4 w-4" />
              Open Weekly QR Pass
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/koinonia">
              <HeartHandshake className="h-4 w-4" />
              Koinonia Wall
            </Link>
          </Button>
          {(profile.role === "cell_leader" ||
            profile.role === "system_admin") && (
            <Button asChild variant="accent" size="sm">
              <Link href="/cell-care">
                <Users className="h-4 w-4" />
                My Cell Care
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Streak & Ministry Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <StreakMilestoneCard
          tier={profile.tier}
          streak={profile.consecutive_saturday_streak}
          longest={profile.longest_saturday_streak}
          total={profile.total_saturdays_attended}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--color-accent)]" />
              Cell &amp; Ministry Roots
            </CardTitle>
            <CardDescription>
              Your active cell shepherd and ministry participation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
              <span className="text-slate-500">Cell Leader</span>
              <span className="font-bold text-slate-900">
                {leaderRes.data?.full_name ?? "Unassigned"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
              <span className="text-slate-500">Ministry Team</span>
              <span className="font-semibold text-slate-900">
                {profile.ministry_team || "Exploring Ministry"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
              <span className="text-slate-500">Last Check-In</span>
              <span className="font-medium text-slate-800">
                {formatManilaDate(profile.last_attended_saturday)}
              </span>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/tree">
                <GitFork className="h-4 w-4" />
                Explore Discipleship Family Tree
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Cell Meetups */}
      {upcomingMeetups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[var(--color-primary)]" />
              Upcoming Cell Meetups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingMeetups.map((meetup) => (
              <div
                key={meetup.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{meetup.title}</p>
                    {meetup.topic && (
                      <p className="text-xs text-slate-600">{meetup.topic}</p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {formatManilaDateTime(meetup.scheduled_at)}
                  </Badge>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-slate-600">
                  <MapPin className="h-3.5 w-3.5" />
                  {meetup.location}
                </p>
                <CellMeetupRsvpBar
                  meetupId={meetup.id}
                  initialStatus={rsvpMap.get(meetup.id) ?? null}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Church Events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Upcoming Church Events</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/koinonia">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(eventsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">
              No upcoming events posted yet. Check back soon!
            </p>
          ) : (
            <div className="space-y-2.5">
              {(eventsRes.data ?? []).map((ev) => (
                <Link
                  key={ev.id}
                  href="/koinonia"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm text-slate-900">
                      {ev.title}
                    </p>
                    <p className="text-xs text-slate-500">{ev.location}</p>
                  </div>
                  <Badge variant="secondary">
                    {formatManilaDate(ev.event_date)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarPlus,
  Flame,
  Lock,
  MapPin,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCellMeetupAction,
  getMemberCareNotesAction,
  updateMemberMinistryAction,
  upsertCareNoteAction,
} from "@/actions/care";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  CareNoteCategory,
  DecryptedCareNote,
  MinistryStatus,
  ProfileRow,
  RetentionRadarItem,
  UmbrellaCellCount,
} from "@/types/database.types";

export interface MeetupSummary {
  id: string;
  title: string;
  topic: string | null;
  location: string;
  scheduled_at: string;
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
}

export function CellCareClient({
  umbrellaSummary,
  cellMembers,
  retentionRadar,
  meetups,
}: {
  umbrellaSummary: UmbrellaCellCount | null;
  cellMembers: ProfileRow[];
  retentionRadar: RetentionRadarItem[];
  meetups: MeetupSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Encrypted Care Vault Drawer State
  const [vaultMember, setVaultMember] = useState<ProfileRow | null>(null);
  const [vaultNotes, setVaultNotes] = useState<DecryptedCareNote[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] =
    useState<CareNoteCategory>("pastoral");
  const [followUpDate, setFollowUpDate] = useState("");

  // Ministry Quick-Edit State
  const [ministryMember, setMinistryMember] = useState<ProfileRow | null>(null);
  const [ministryTeam, setMinistryTeam] = useState("");
  const [ministryStatus, setMinistryStatus] =
    useState<MinistryStatus>("active");

  // Meetup Scheduler State
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [meetupTitle, setMeetupTitle] = useState("");
  const [meetupTopic, setMeetupTopic] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [meetupDate, setMeetupDate] = useState("");
  const [notifyCell, setNotifyCell] = useState(true);

  async function openCareVault(member: ProfileRow) {
    setVaultMember(member);
    setVaultNotes([]);
    setNoteText("");
    setFollowUpDate("");
    setLoadingVault(true);
    const res = await getMemberCareNotesAction(member.id);
    setLoadingVault(false);
    if (!res.success) {
      toast.error(res.error ?? "Unable to unlock Care Vault.");
      return;
    }
    setVaultNotes(res.data ?? []);
  }

  function handleSaveCareNote(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultMember) return;

    startTransition(async () => {
      const res = await upsertCareNoteAction({
        memberId: vaultMember.id,
        plaintext: noteText,
        category: noteCategory,
        followUpDate: followUpDate || null,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to encrypt care note.");
        return;
      }
      setNoteText("");
      setFollowUpDate("");
      toast.success("Encrypted care note saved safely to Care Vault.");
      const refreshed = await getMemberCareNotesAction(vaultMember.id);
      if (refreshed.success) {
        setVaultNotes(refreshed.data ?? []);
      }
    });
  }

  function openMinistrySheet(member: ProfileRow) {
    setMinistryMember(member);
    setMinistryTeam(member.ministry_team ?? "");
    setMinistryStatus(member.ministry_status);
  }

  function handleSaveMinistry(e: React.FormEvent) {
    e.preventDefault();
    if (!ministryMember) return;
    startTransition(async () => {
      const res = await updateMemberMinistryAction({
        memberId: ministryMember.id,
        ministry_team: ministryTeam,
        ministry_status: ministryStatus,
      });
      if (!res.success) {
        toast.error(res.error ?? "Could not update ministry status.");
        return;
      }
      toast.success("Ministry involvement updated.");
      setMinistryMember(null);
      router.refresh();
    });
  }

  function handleCreateMeetup(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCellMeetupAction({
        title: meetupTitle,
        topic: meetupTopic,
        location: meetupLocation,
        scheduled_at: meetupDate,
        notifyCell,
      });
      if (!res.success) {
        toast.error(res.error ?? "Could not schedule cell meetup.");
        return;
      }
      setMeetupOpen(false);
      setMeetupTitle("");
      setMeetupTopic("");
      setMeetupLocation("");
      setMeetupDate("");
      toast.success(
        `Cell meetup scheduled!${
          res.data?.notifiedCount
            ? ` Push sent to ${res.data.notifiedCount} device(s).`
            : ""
        }`
      );
      router.refresh();
    });
  }

  const missedAlerts = retentionRadar.filter(
    (r) => r.alert_type === "missed_2_plus_weeks"
  );
  const milestoneAlerts = retentionRadar.filter(
    (r) =>
      r.alert_type === "milestone_4wk_next" ||
      r.alert_type === "milestone_8wk_next"
  );

  return (
    <div className="space-y-5">
      {/* Header + Umbrella Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--color-primary)]" />
            My Cell &amp; Care Vault
          </h1>
          <p className="text-xs text-slate-500">
            Shepherd your disciples, track retention radar, and keep private
            pgcrypto-encrypted care notes.
          </p>
        </div>

        <Sheet open={meetupOpen} onOpenChange={setMeetupOpen}>
          <SheetTrigger asChild>
            <Button variant="accent">
              <CalendarPlus className="h-4 w-4" />
              Schedule Meetup
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Schedule Cell Meetup</SheetTitle>
              <SheetDescription>
                Your cell members can RSVP directly from their Home screen.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleCreateMeetup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="meetup-title">Meetup Title</Label>
                <Input
                  id="meetup-title"
                  required
                  placeholder="e.g., Friday Night Cell Fellowship"
                  value={meetupTitle}
                  onChange={(e) => setMeetupTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meetup-topic">Bible Study / Topic</Label>
                <Input
                  id="meetup-topic"
                  placeholder="e.g., John 15 — Abiding in the Vine"
                  value={meetupTopic}
                  onChange={(e) => setMeetupTopic(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="meetup-location">Location</Label>
                  <Input
                    id="meetup-location"
                    required
                    placeholder="Church Youth Hall / Cafe"
                    value={meetupLocation}
                    onChange={(e) => setMeetupLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meetup-date">Date &amp; Time</Label>
                  <Input
                    id="meetup-date"
                    type="datetime-local"
                    required
                    value={meetupDate}
                    onChange={(e) => setMeetupDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Notify Cell via Web Push
                  </p>
                  <p className="text-xs text-slate-500">
                    Send an instant RSVP alert to subscribed cell members
                  </p>
                </div>
                <Switch checked={notifyCell} onCheckedChange={setNotifyCell} />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isPending}
              >
                {isPending ? "Scheduling..." : "Publish Cell Meetup"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Umbrella KPI Strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-[#DBEAFE]/40 border-[#93C5FD]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#1E3A8A]">
              Umbrella Total
            </p>
            <p className="mt-1 text-2xl font-black text-[#1E3A8A]">
              {umbrellaSummary?.umbrella_total ?? cellMembers.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#DCFCE7]/50 border-[#86EFAC]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#14532D]">
              Direct Cell
            </p>
            <p className="mt-1 text-2xl font-black text-[#14532D]">
              {umbrellaSummary?.direct_count ?? cellMembers.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF9C3]/60 border-[#FDE047]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#854D0E]">
              Radar Alerts
            </p>
            <p className="mt-1 text-2xl font-black text-[#854D0E]">
              {missedAlerts.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roster" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="roster">
            My Cell ({cellMembers.length})
          </TabsTrigger>
          <TabsTrigger value="radar">
            Radar ({retentionRadar.length})
          </TabsTrigger>
          <TabsTrigger value="meetups">
            Meetups ({meetups.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CELL ROSTER (Soft Pastel Light Mode Palette) */}
        <TabsContent value="roster" className="space-y-2.5">
          {cellMembers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                No cell members are currently assigned under your leadership.
              </CardContent>
            </Card>
          ) : (
            cellMembers.map((member) => {
              const style = getHierarchyStyle(
                member.tier,
                member.current_leader_id
              );
              return (
                <div
                  key={member.id}
                  className={cn(
                    "rounded-2xl border p-4 shadow-2xs transition-colors",
                    style.rowClass,
                    style.borderClass
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base">{member.full_name}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] not-italic",
                            style.badgeClass
                          )}
                        >
                          {style.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs opacity-80 not-italic font-normal">
                        Streak: <strong>{member.consecutive_saturday_streak} wks</strong>{" "}
                        · Last attended:{" "}
                        {formatManilaDate(member.last_attended_saturday)}
                      </p>
                      <p className="text-xs opacity-80 not-italic font-normal">
                        Ministry: {member.ministry_team || "None"} (
                        {member.ministry_status})
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 not-italic">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-white/90"
                        onClick={() => openMinistrySheet(member)}
                      >
                        Ministry
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openCareVault(member)}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Care Vault
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* TAB 2: RETENTION RADAR */}
        <TabsContent value="radar" className="space-y-3">
          {retentionRadar.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-emerald-800">
                Praise God! Every member in your cell is actively attending.
              </CardContent>
            </Card>
          ) : (
            <>
              {missedAlerts.map((item) => {
                const member = cellMembers.find((m) => m.id === item.member_id);
                return (
                  <Card
                    key={item.member_id}
                    className="border-amber-300 bg-[#FEF9C3]/50"
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-900">
                            {item.full_name}
                          </p>
                          <p className="text-xs text-amber-900">
                            {item.last_attended_saturday
                              ? `Missed ${item.weeks_missed} Saturday(s) · Last seen ${formatManilaDate(item.last_attended_saturday)}`
                              : "No Saturday check-in recorded yet"}
                          </p>
                        </div>
                      </div>
                      {member && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openCareVault(member)}
                        >
                          Log Care
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {milestoneAlerts.map((item) => (
                <Card
                  key={item.member_id}
                  className="border-emerald-300 bg-[#DCFCE7]/50"
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[#14532D]">
                          {item.full_name}
                        </p>
                        <p className="text-xs text-emerald-900 flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5" />
                          {item.alert_type === "milestone_4wk_next"
                            ? "1 Saturday away from 4-Week Invite Milestone!"
                            : "1 Saturday away from 8-Week Disciple Milestone!"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* TAB 3: CELL MEETUPS */}
        <TabsContent value="meetups" className="space-y-3">
          {meetups.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                No cell meetups scheduled yet. Tap &ldquo;Schedule Meetup&rdquo;
                above!
              </CardContent>
            </Card>
          ) : (
            meetups.map((m) => (
              <Card key={m.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{m.title}</CardTitle>
                    <Badge variant="outline">
                      {formatManilaDateTime(m.scheduled_at)}
                    </Badge>
                  </div>
                  {m.topic && <CardDescription>{m.topic}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {m.location}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="success">{m.goingCount} Going</Badge>
                    <Badge variant="warning">{m.maybeCount} Maybe</Badge>
                    <Badge variant="secondary">
                      {m.notGoingCount} Can&apos;t Go
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ENCRYPTED CARE VAULT BOTTOM SHEET */}
      <Sheet
        open={Boolean(vaultMember)}
        onOpenChange={(open) => !open && setVaultMember(null)}
      >
        <SheetContent side="bottom">
          {vaultMember && (
            <>
              <SheetHeader>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <Shield className="h-4 w-4" />
                  PGCRYPTO ENCRYPTED CARE VAULT
                </div>
                <SheetTitle>{vaultMember.full_name}</SheetTitle>
                <SheetDescription>
                  Private pastoral notes encrypted at rest. Hidden from Pastor,
                  Registrar, Treasurer, and other Cell Leaders.
                </SheetDescription>
              </SheetHeader>

              <form onSubmit={handleSaveCareNote} className="space-y-3 mb-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select
                      value={noteCategory}
                      onValueChange={(v) =>
                        setNoteCategory(v as CareNoteCategory)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pastoral">Pastoral Care</SelectItem>
                        <SelectItem value="prayer">Prayer Need</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="academic">School / Work</SelectItem>
                        <SelectItem value="discipleship">
                          Discipleship
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="care-followup">Follow-Up Date</Label>
                    <Input
                      id="care-followup"
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </div>
                </div>
                <Textarea
                  required
                  minLength={3}
                  placeholder="Write private pastoral follow-up notes..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <Button type="submit" className="w-full" disabled={isPending}>
                  <Lock className="h-4 w-4" />
                  {isPending ? "Encrypting & Saving..." : "Save Encrypted Note"}
                </Button>
              </form>

              <div className="space-y-2.5 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Decrypted History ({vaultNotes.length})
                </p>
                {loadingVault ? (
                  <p className="text-sm text-slate-500">
                    Decrypting vault entries...
                  </p>
                ) : vaultNotes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No care notes logged yet for this disciple.
                  </p>
                ) : (
                  vaultNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold uppercase text-slate-700">
                          {note.category}
                        </span>
                        <span>{formatManilaDateTime(note.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">
                        {note.plaintext_note}
                      </p>
                      {note.follow_up_date && (
                        <p className="text-[11px] font-semibold text-amber-700">
                          Follow-up: {formatManilaDate(note.follow_up_date)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* MINISTRY STATUS SHEET */}
      <Sheet
        open={Boolean(ministryMember)}
        onOpenChange={(open) => !open && setMinistryMember(null)}
      >
        <SheetContent side="bottom">
          {ministryMember && (
            <>
              <SheetHeader>
                <SheetTitle>Update Ministry Status</SheetTitle>
                <SheetDescription>{ministryMember.full_name}</SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSaveMinistry} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="min-team">Ministry Team</Label>
                  <Input
                    id="min-team"
                    placeholder="e.g., Worship, Media, Ushering, Kids"
                    value={ministryTeam}
                    onChange={(e) => setMinistryTeam(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Serving Status</Label>
                  <Select
                    value={ministryStatus}
                    onValueChange={(v) =>
                      setMinistryStatus(v as MinistryStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active Serving</SelectItem>
                      <SelectItem value="resting">Resting / Sabbatical</SelectItem>
                      <SelectItem value="inactive">Not Currently Serving</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  Save Ministry Status
                </Button>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Heart,
  HeartHandshake,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPrayerAction,
  markPrayerAnsweredAction,
  rsvpChurchEventAction,
  togglePrayerAmenAction,
} from "@/actions/koinonia";
import { formatManilaDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import type { RsvpStatus } from "@/types/database.types";

export interface PrayerViewItem {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  isAnonymous: boolean;
  isAnswered: boolean;
  answeredTestimony: string | null;
  createdAt: string;
  amenCount: number;
  hasPrayed: boolean;
}

export interface EventViewItem {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string;
  goingCount: number;
  myStatus: RsvpStatus | null;
}

export function KoinoniaClient({
  currentProfileId,
  prayers,
  events,
}: {
  currentProfileId: string;
  prayers: PrayerViewItem[];
  events: EventViewItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prayerText, setPrayerText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [testimony, setTestimony] = useState("");

  function handlePostPrayer(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createPrayerAction({
        content: prayerText,
        is_anonymous: isAnonymous,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to share prayer request.");
        return;
      }
      setPrayerText("");
      setIsAnonymous(false);
      setSheetOpen(false);
      toast.success("Prayer request shared on the Koinonia Wall.");
      router.refresh();
    });
  }

  function handleToggleAmen(prayerId: string) {
    startTransition(async () => {
      const res = await togglePrayerAmenAction(prayerId);
      if (!res.success) {
        toast.error(res.error ?? "Could not record prayer.");
        return;
      }
      router.refresh();
    });
  }

  function handleMarkAnswered(e: React.FormEvent) {
    e.preventDefault();
    if (!answeringId) return;
    startTransition(async () => {
      const res = await markPrayerAnsweredAction({
        prayerId: answeringId,
        testimony,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to update prayer.");
        return;
      }
      setAnsweringId(null);
      setTestimony("");
      toast.success("Praise God! Answered testimony saved.");
      router.refresh();
    });
  }

  function handleEventRsvp(eventId: string, status: RsvpStatus) {
    startTransition(async () => {
      const res = await rsvpChurchEventAction({ id: eventId, status });
      if (!res.success) {
        toast.error(res.error ?? "Failed to update RSVP.");
        return;
      }
      toast.success("Event RSVP saved!");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-[var(--color-primary)]" />
            Koinonia Prayer &amp; Events
          </h1>
          <p className="text-xs text-slate-500">
            Carry one another&apos;s burdens in prayer and gather together.
          </p>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Post Prayer
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Share a Prayer Request</SheetTitle>
              <SheetDescription>
                Your SYCC family will lift this up with you. Toggle anonymous
                anytime for privacy.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handlePostPrayer} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="prayer-content">How can we pray for you?</Label>
                <Textarea
                  id="prayer-content"
                  required
                  minLength={5}
                  maxLength={600}
                  placeholder="Share your prayer request or praise report..."
                  value={prayerText}
                  onChange={(e) => setPrayerText(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Post Anonymously
                  </p>
                  <p className="text-xs text-slate-500">
                    Hide your name from the community prayer feed
                  </p>
                </div>
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                  aria-label="Post anonymously"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isPending}
              >
                {isPending ? "Posting..." : "Share to Prayer Wall"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Tabs defaultValue="prayers" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="prayers">
            Prayer Wall ({prayers.length})
          </TabsTrigger>
          <TabsTrigger value="events">
            Church Events ({events.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prayers" className="space-y-3">
          {prayers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                No prayers posted yet. Be the first to invite your youth family
                to pray!
              </CardContent>
            </Card>
          ) : (
            prayers.map((prayer) => (
              <Card key={prayer.id} className="overflow-hidden">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {prayer.isAnonymous
                          ? "Anonymous Brother / Sister"
                          : prayer.authorName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatManilaDateTime(prayer.createdAt)}
                      </p>
                    </div>
                    {prayer.isAnswered && (
                      <Badge variant="success">
                        <Sparkles className="h-3 w-3" />
                        Answered
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {prayer.content}
                  </p>

                  {prayer.isAnswered && prayer.answeredTestimony && (
                    <div className="rounded-xl border border-emerald-200 bg-[#DCFCE7]/60 p-3 text-xs text-[#14532D]">
                      <strong>Praise Testimony:</strong>{" "}
                      {prayer.answeredTestimony}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={prayer.hasPrayed ? "default" : "outline"}
                      disabled={isPending}
                      onClick={() => handleToggleAmen(prayer.id)}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          prayer.hasPrayed ? "fill-current" : ""
                        }`}
                      />
                      {prayer.hasPrayed ? "Prayed" : "I Prayed"} (
                      {prayer.amenCount})
                    </Button>

                    {!prayer.isAnswered &&
                      prayer.authorId === currentProfileId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setAnsweringId(prayer.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Mark Answered
                        </Button>
                      )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-3">
          {events.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                No upcoming church events scheduled yet.
              </CardContent>
            </Card>
          ) : (
            events.map((ev) => (
              <Card key={ev.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle>{ev.title}</CardTitle>
                    <Badge variant="secondary">{ev.goingCount} Going</Badge>
                  </div>
                  <CardDescription className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatManilaDateTime(ev.eventDate)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {ev.location}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ev.description && (
                    <p className="text-sm text-slate-700">{ev.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: "going", label: "Going" },
                        { key: "maybe", label: "Maybe" },
                        { key: "not_going", label: "Can't Go" },
                      ] as const
                    ).map((opt) => (
                      <Button
                        key={opt.key}
                        type="button"
                        size="sm"
                        variant={
                          ev.myStatus === opt.key ? "default" : "outline"
                        }
                        disabled={isPending}
                        onClick={() => handleEventRsvp(ev.id, opt.key)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Mark Prayer Answered Sheet */}
      <Sheet
        open={Boolean(answeringId)}
        onOpenChange={(open) => !open && setAnsweringId(null)}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Celebrate an Answered Prayer</SheetTitle>
            <SheetDescription>
              Share a brief praise report to encourage the whole youth group.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleMarkAnswered} className="space-y-4">
            <Textarea
              placeholder="How did God answer this prayer?"
              value={testimony}
              onChange={(e) => setTestimony(e.target.value)}
            />
            <Button
              type="submit"
              variant="accent"
              className="w-full"
              size="lg"
              disabled={isPending}
            >
              Save Praise Testimony
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  GitFork,
  Lock,
  MapPin,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  createChurchEventAction,
  deleteChurchEventAction,
} from "@/actions/events";
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import { formatManilaDate, formatManilaDateTime, formatPhp } from "@/lib/format";
import { SeasonalThemeStudio } from "@/components/admin/SeasonalThemeStudio";
import {
  PastorReportPdfButton,
  type PastorStatsSnapshot,
} from "@/components/reports/PastorReportPdf";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AppThemeSettingsRow,
  ChurchEventRow,
  PastorFinancialSummaryRow,
  UmbrellaCellCount,
} from "@/types/database.types";

export function PastorWorkspace({
  theme,
  stats,
  umbrellas,
  financials,
  events,
}: {
  theme: AppThemeSettingsRow;
  stats: PastorStatsSnapshot;
  umbrellas: UmbrellaCellCount[];
  financials: PastorFinancialSummaryRow[];
  events: ChurchEventRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [notifyAll, setNotifyAll] = useState(true);

  function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createChurchEventAction({
        title,
        description,
        event_date: eventDate,
        location,
        notifyAllYouth: notifyAll,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to publish church event.");
        return;
      }
      setTitle("");
      setDescription("");
      setEventDate("");
      setLocation("");
      toast.success(
        `Event published!${
          res.data?.notifiedCount
            ? ` Alert sent to ${res.data.notifiedCount} device(s).`
            : ""
        }`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[var(--color-primary)]" />
            Pastor Ministry Overview
          </h1>
          <p className="text-sm text-slate-500">
            Umbrella discipleship health, events, seasonal theme studio, and
            masked aggregate finances.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/tree">
              <GitFork className="h-4 w-4" />
              Global Discipleship Tree
            </Link>
          </Button>
          <PastorReportPdfButton
            seasonTitle={theme.season_title}
            stats={stats}
            umbrellas={umbrellas}
            financials={financials}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-slate-500">
              Total Youth
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {stats.totalYouth}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#DBEAFE] border-[#93C5FD]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#1E3A8A]">
              Cell Leaders
            </p>
            <p className="mt-1 text-2xl font-black text-[#1E3A8A]">
              {stats.cellLeaders}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#F1F5F9] border-[#CBD5E1]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#334155]">
              Disciples
            </p>
            <p className="mt-1 text-2xl font-black text-[#334155]">
              {stats.disciples}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-300">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#374151]">
              Invites
            </p>
            <p className="mt-1 text-2xl font-black text-[#374151]">
              {stats.invites}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF9C3] border-[#FDE047]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#854D0E]">
              New Invites
            </p>
            <p className="mt-1 text-2xl font-black text-[#854D0E]">
              {stats.newInvites}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#DCFCE7] border-[#86EFAC]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#14532D]">
              Active Ministry
            </p>
            <p className="mt-1 text-2xl font-black text-[#14532D]">
              {stats.activeInMinistry}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="umbrella" className="w-full">
        <TabsList className="w-full max-w-2xl">
          <TabsTrigger value="umbrella">Umbrella Cells</TabsTrigger>
          <TabsTrigger value="finance">Masked Finances</TabsTrigger>
          <TabsTrigger value="events">Church Events</TabsTrigger>
          <TabsTrigger value="theme">Theme Studio</TabsTrigger>
        </TabsList>

        {/* UMBRELLA CELLS */}
        <TabsContent value="umbrella">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--color-primary)]" />
                Umbrella Cell Multiplication Health (Recursive)
              </CardTitle>
              <CardDescription>
                Emerging Cell Leaders roll up into their mentor&apos;s umbrella
                total via PostgreSQL <code>WITH RECURSIVE</code>. Private Cell
                Leader Care Vault notes remain strictly confidential.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cell Leader</TableHead>
                    <TableHead>Hierarchy</TableHead>
                    <TableHead className="text-right">Direct Cell</TableHead>
                    <TableHead className="text-right">
                      Emerging Leaders
                    </TableHead>
                    <TableHead className="text-right">Umbrella Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {umbrellas.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-slate-500"
                      >
                        No Cell Leaders appointed yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    umbrellas.map((u) => {
                      const style = getHierarchyStyle(
                        "cell_leader",
                        u.is_top_level ? null : "mentor"
                      );
                      return (
                        <TableRow key={u.leader_id} className={style.rowClass}>
                          <TableCell>{u.leader_name}</TableCell>
                          <TableCell className="not-italic">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[11px]",
                                style.badgeClass
                              )}
                            >
                              {style.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {u.direct_count}
                          </TableCell>
                          <TableCell className="text-right">
                            {u.emerging_leaders_count}
                          </TableCell>
                          <TableCell className="text-right text-base">
                            {u.umbrella_total}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MASKED FINANCIAL SUMMARY */}
        <TabsContent value="finance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-700" />
                Aggregated Giving Summary (Individual Tithes Masked)
              </CardTitle>
              <CardDescription>
                Shows church-wide stewardship totals per Saturday while keeping
                individual youth giving strictly private.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Date</TableHead>
                    <TableHead className="text-right">Tithes</TableHead>
                    <TableHead className="text-right">Offerings</TableHead>
                    <TableHead className="text-right">GCash</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Turn-Over</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financials.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-slate-500"
                      >
                        No financial liquidations recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    financials.map((f) => (
                      <TableRow key={f.service_date}>
                        <TableCell className="font-semibold">
                          {formatManilaDate(f.service_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPhp(f.total_tithes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPhp(
                            Number(f.total_offerings) +
                              Number(f.total_missions) +
                              Number(f.total_special)
                          )}
                        </TableCell>
                        <TableCell className="text-right text-emerald-700">
                          {formatPhp(f.gcash_total)}
                        </TableCell>
                        <TableCell className="text-right text-red-700">
                          {formatPhp(f.total_expenses)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-[#1E3A8A]">
                          {formatPhp(f.net_turnover)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={f.is_locked ? "success" : "warning"}>
                            {f.is_locked ? "Verified" : "Open"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHURCH EVENTS CRUD */}
        <TabsContent value="events">
          <div className="grid gap-5 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarPlus className="h-5 w-5 text-[var(--color-primary)]" />
                  Publish Church Event
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEvent} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="ev-title">Event Title</Label>
                    <Input
                      id="ev-title"
                      required
                      placeholder="e.g., SYCC Youth Camp 2026"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ev-date">Date &amp; Time</Label>
                    <Input
                      id="ev-date"
                      type="datetime-local"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ev-loc">Location</Label>
                    <Input
                      id="ev-loc"
                      required
                      placeholder="Main Sanctuary / Venue"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ev-desc">Details</Label>
                    <Textarea
                      id="ev-desc"
                      placeholder="What should youth bring or expect?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Push Broadcast
                      </p>
                      <p className="text-xs text-slate-500">
                        Notify all subscribed youth devices
                      </p>
                    </div>
                    <Switch
                      checked={notifyAll}
                      onCheckedChange={setNotifyAll}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending}>
                    Publish Event
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Published Events ({events.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {events.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No events published yet.
                  </p>
                ) : (
                  events.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{ev.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatManilaDateTime(ev.event_date)}
                        </p>
                        <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {ev.location}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await deleteChurchEventAction(ev.id);
                            if (res.success) {
                              toast.info("Event removed.");
                              router.refresh();
                            }
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SEASONAL THEME STUDIO */}
        <TabsContent value="theme">
          <SeasonalThemeStudio currentTheme={theme} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardCheck,
  QrCode,
  Search,
  Sparkles,
  Undo2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  checkInByQrAction,
  checkInMemberAction,
  registerWalkInAction,
  undoCheckInAction,
  type CheckInFeedback,
} from "@/actions/attendance";
import { getHierarchyStyle, HIERARCHY_LEGEND } from "@/lib/hierarchy-styles";
import { formatManilaDate } from "@/lib/format";
import {
  AttendanceReportPdfButton,
  type AttendanceReportRow,
} from "@/components/reports/AttendanceReportPdf";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  AttendanceLogRow,
  ProfileRow,
} from "@/types/database.types";

export interface HistoricalSaturdayStat {
  serviceDate: string;
  count: number;
}

export function RegistrarWorkspace({
  serviceDate,
  roster,
  todayLogs,
  history,
}: {
  serviceDate: string;
  roster: ProfileRow[];
  todayLogs: AttendanceLogRow[];
  history: HistoricalSaturdayStat[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // QR Scanner
  const [cameraActive, setCameraActive] = useState(false);
  const [manualQr, setManualQr] = useState("");
  const [lastScan, setLastScan] = useState<CheckInFeedback | null>(null);
  const lastCodeRef = useRef<{ value: string; at: number }>({
    value: "",
    at: 0,
  });

  // Walk-In Form
  const [walkName, setWalkName] = useState("");
  const [walkNick, setWalkNick] = useState("");
  const [walkEmail, setWalkEmail] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkInviter, setWalkInviter] = useState<string>("none");
  const [walkLeader, setWalkLeader] = useState<string>("none");

  const logByProfile = useMemo(
    () => new Map(todayLogs.map((l) => [l.profile_id, l])),
    [todayLogs]
  );

  const profileMap = useMemo(
    () => new Map(roster.map((p) => [p.id, p])),
    [roster]
  );

  const cellLeaders = useMemo(
    () => roster.filter((p) => p.tier === "cell_leader"),
    [roster]
  );

  // Order strictly by hierarchy (Top Cell Leaders -> Emerging Cell Leaders -> Disciples -> Invites -> New Invites -> Alumni)
  const filteredRoster = useMemo(() => {
    const rank = (p: ProfileRow): number => {
      if (p.tier === "cell_leader" && !p.current_leader_id) return 0;
      if (p.tier === "cell_leader" && p.current_leader_id) return 1;
      if (p.tier === "disciple") return 2;
      if (p.tier === "invite") return 3;
      if (p.tier === "new_invite") return 4;
      return 5;
    };

    const q = search.trim().toLowerCase();
    return [...roster]
      .filter((p) => {
        if (tierFilter !== "all" && p.tier !== tierFilter) return false;
        if (!q) return true;
        return (
          p.full_name.toLowerCase().includes(q) ||
          (p.nickname ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => rank(a) - rank(b) || a.full_name.localeCompare(b.full_name));
  }, [roster, search, tierFilter]);

  const presentRows: AttendanceReportRow[] = useMemo(() => {
    return todayLogs
      .map((log) => {
        const p = profileMap.get(log.profile_id);
        if (!p) return null;
        return {
          fullName: p.full_name,
          tier: p.tier,
          currentLeaderId: p.current_leader_id,
          leaderName: p.current_leader_id
            ? profileMap.get(p.current_leader_id)?.full_name ?? "—"
            : "Top-Level",
          streak: p.consecutive_saturday_streak,
          method: log.method,
        };
      })
      .filter(Boolean) as AttendanceReportRow[];
  }, [todayLogs, profileMap]);

  const stats = useMemo(() => {
    const presentProfiles = todayLogs
      .map((l) => profileMap.get(l.profile_id))
      .filter(Boolean) as ProfileRow[];
    return {
      total: presentProfiles.length,
      leaders: presentProfiles.filter((p) => p.tier === "cell_leader").length,
      disciples: presentProfiles.filter((p) => p.tier === "disciple").length,
      invites: presentProfiles.filter((p) => p.tier === "invite").length,
      newInvites: presentProfiles.filter((p) => p.tier === "new_invite").length,
    };
  }, [todayLogs, profileMap]);

  function notifyFeedback(fb: CheckInFeedback) {
    setLastScan(fb);
    if (fb.alreadyCheckedIn) {
      toast.info(`${fb.fullName} is already checked in today.`);
    } else if (fb.upgraded) {
      toast.success(
        `${fb.fullName} checked in! MILESTONE UPGRADE -> ${fb.newTier.replace("_", " ").toUpperCase()} (${fb.streak} wks)!`
      );
    } else {
      toast.success(
        `${fb.fullName} checked in! (${fb.streak}-week Saturday streak)`
      );
    }
  }

  function handleManualCheckIn(profileId: string) {
    startTransition(async () => {
      const res = await checkInMemberAction({
        profileId,
        serviceDate,
        method: "manual_search",
      });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Check-in failed.");
        return;
      }
      notifyFeedback(res.data);
      router.refresh();
    });
  }

  function handleUndo(profileId: string, fullName: string) {
    startTransition(async () => {
      const res = await undoCheckInAction(profileId, serviceDate);
      if (!res.success) {
        toast.error(res.error ?? "Undo failed.");
        return;
      }
      toast.info(`Removed today's check-in for ${fullName}.`);
      router.refresh();
    });
  }

  function processQrValue(raw: string) {
    const now = Date.now();
    if (
      lastCodeRef.current.value === raw &&
      now - lastCodeRef.current.at < 3000
    ) {
      return;
    }
    lastCodeRef.current = { value: raw, at: now };

    startTransition(async () => {
      const res = await checkInByQrAction(raw, serviceDate);
      if (!res.success || !res.data) {
        toast.error(res.error ?? "QR check-in failed.");
        return;
      }
      notifyFeedback(res.data);
      router.refresh();
    });
  }

  function handleWalkInSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await registerWalkInAction({
        full_name: walkName,
        nickname: walkNick || null,
        email: walkEmail || "",
        phone: walkPhone || null,
        invited_by_id: walkInviter === "none" ? null : walkInviter,
        current_leader_id: walkLeader === "none" ? null : walkLeader,
        serviceDate,
      });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Walk-in registration failed.");
        return;
      }
      notifyFeedback(res.data);
      setWalkName("");
      setWalkNick("");
      setWalkEmail("");
      setWalkPhone("");
      setWalkInviter("none");
      setWalkLeader("none");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Header & KPI Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[var(--color-primary)]" />
            Saturday Registration Desk
          </h1>
          <p className="text-sm text-slate-500">
            Active Service Saturday:{" "}
            <strong className="text-slate-900">
              {formatManilaDate(serviceDate)}
            </strong>{" "}
            · Real-time synced to Treasury.
          </p>
        </div>

        <AttendanceReportPdfButton
          serviceDate={serviceDate}
          rows={presentRows}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-white">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-slate-500">
              Present Today
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {stats.total}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#DBEAFE] border-[#93C5FD]">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#1E3A8A]">
              Cell Leaders
            </p>
            <p className="mt-1 text-2xl font-black text-[#1E3A8A]">
              {stats.leaders}
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
      </div>

      {/* Laptop Split-Screen Operational Workspace */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* LEFT PANE (7 cols): Pastel Light-Mode Attendance Roster */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Youth Attendance Roster ({filteredRoster.length})</CardTitle>
              <div className="flex flex-wrap gap-1">
                {HIERARCHY_LEGEND.map((item) => {
                  const st = getHierarchyStyle(item.tier, item.currentLeaderId);
                  return (
                    <span
                      key={item.key}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        st.badgeClass
                      )}
                    >
                      {item.caption.split(" (")[0]}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="relative sm:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search name or nickname..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="cell_leader">Cell Leader</SelectItem>
                  <SelectItem value="disciple">Disciple</SelectItem>
                  <SelectItem value="invite">Invite</SelectItem>
                  <SelectItem value="new_invite">New Invite</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 sm:p-5 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Youth Name</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="hidden sm:table-cell">Streak</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoster.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-slate-500"
                    >
                      No matching youth profiles found. Use &ldquo;Walk-In
                      Entry&rdquo; to add a first-time guest!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoster.map((person) => {
                    const style = getHierarchyStyle(
                      person.tier,
                      person.current_leader_id
                    );
                    const checkedLog = logByProfile.get(person.id);

                    return (
                      <TableRow key={person.id} className={style.rowClass}>
                        <TableCell>
                          <div className="leading-tight">
                            <p>{person.full_name}</p>
                            {person.current_leader_id && (
                              <p className="text-[11px] opacity-75 not-italic font-normal">
                                Cell:{" "}
                                {profileMap.get(person.current_leader_id)
                                  ?.full_name ?? "Assigned"}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="not-italic">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px]",
                              style.badgeClass
                            )}
                          >
                            {style.label}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell not-italic font-semibold">
                          {person.consecutive_saturday_streak}w
                        </TableCell>
                        <TableCell className="text-right not-italic">
                          {checkedLog ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Badge variant="success">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Present
                              </Badge>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-slate-600 bg-white/70"
                                disabled={isPending}
                                onClick={() =>
                                  handleUndo(person.id, person.full_name)
                                }
                                title="Undo Check-In"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleManualCheckIn(person.id)}
                            >
                              Check In
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* RIGHT PANE (5 cols): QR Scanner / Walk-In Entry / Attendance Reports */}
        <div className="lg:col-span-5 space-y-4">
          {lastScan && (
            <Card
              className={cn(
                "border-2",
                lastScan.upgraded
                  ? "border-emerald-400 bg-[#DCFCE7]"
                  : "border-blue-300 bg-[#DBEAFE]/60"
              )}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    {lastScan.upgraded ? (
                      <>
                        <Sparkles className="h-4 w-4 text-emerald-700" />
                        Automated Tier Upgrade!
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-[#1E3A8A]" />
                        Last Check-In Confirmed
                      </>
                    )}
                  </p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">
                    {lastScan.fullName}
                  </p>
                  <p className="text-xs text-slate-700">
                    Streak: <strong>{lastScan.streak} consecutive wks</strong> ·
                    Tier:{" "}
                    <strong className="uppercase">
                      {lastScan.newTier.replace("_", " ")}
                    </strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <Tabs defaultValue="scanner" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="scanner">
                    <QrCode className="h-4 w-4" />
                    QR Scanner
                  </TabsTrigger>
                  <TabsTrigger value="walkin">
                    <UserPlus className="h-4 w-4" />
                    Walk-In
                  </TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>

                {/* QR SCANNER TAB */}
                <TabsContent value="scanner" className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-600">
                      Accepts <code>SYCC:&lt;id&gt;:{serviceDate}</code>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant={cameraActive ? "destructive" : "default"}
                      onClick={() => setCameraActive((prev) => !prev)}
                    >
                      {cameraActive ? (
                        <>
                          <CameraOff className="h-4 w-4" />
                          Stop Camera
                        </>
                      ) : (
                        <>
                          <Camera className="h-4 w-4" />
                          Start Scanner
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-square max-h-[320px] flex items-center justify-center">
                    {cameraActive ? (
                      <Scanner
                        formats={["qr_code"]}
                        scanDelay={1500}
                        onScan={(codes) => {
                          const raw = codes[0]?.rawValue;
                          if (raw) processQrValue(raw);
                        }}
                        onError={() => {
                          toast.error(
                            "Camera unavailable. Check browser permission or use manual QR input."
                          );
                          setCameraActive(false);
                        }}
                      />
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                        <QrCode className="h-10 w-10 mx-auto text-slate-400" />
                        <p>
                          Click <strong>Start Scanner</strong> to open the
                          laptop webcam for Saturday check-in.
                        </p>
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (manualQr.trim()) {
                        processQrValue(manualQr.trim());
                        setManualQr("");
                      }
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder={`SYCC:<uuid>:${serviceDate}`}
                      value={manualQr}
                      onChange={(e) => setManualQr(e.target.value)}
                    />
                    <Button type="submit" variant="outline" disabled={isPending}>
                      Verify
                    </Button>
                  </form>
                </TabsContent>

                {/* WALK-IN ENTRY TAB */}
                <TabsContent value="walkin" className="pt-2">
                  <form onSubmit={handleWalkInSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="walk-name">Full Name *</Label>
                      <Input
                        id="walk-name"
                        required
                        placeholder="First & Last Name"
                        value={walkName}
                        onChange={(e) => setWalkName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="walk-nick">Nickname</Label>
                        <Input
                          id="walk-nick"
                          placeholder="Optional"
                          value={walkNick}
                          onChange={(e) => setWalkNick(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="walk-phone">Mobile #</Label>
                        <Input
                          id="walk-phone"
                          placeholder="09XX..."
                          value={walkPhone}
                          onChange={(e) => setWalkPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="walk-email">
                        Email (for automatic account claim later)
                      </Label>
                      <Input
                        id="walk-email"
                        type="email"
                        placeholder="Optional — youth can claim later"
                        value={walkEmail}
                        onChange={(e) => setWalkEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Invited By (Permanent Genealogy)</Label>
                      <Select value={walkInviter} onValueChange={setWalkInviter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select inviter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Walk-in / None</SelectItem>
                          {roster.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Assigned Cell Leader</Label>
                      <Select value={walkLeader} onValueChange={setWalkLeader}>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign Cell Leader" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned for now</SelectItem>
                          {cellLeaders.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      variant="accent"
                      className="w-full"
                      disabled={isPending}
                    >
                      <UserPlus className="h-4 w-4" />
                      {isPending
                        ? "Registering..."
                        : "Register as New Invite & Check In"}
                    </Button>
                  </form>
                </TabsContent>

                {/* HISTORICAL ATTENDANCE REPORTS TAB */}
                <TabsContent value="reports" className="space-y-3 pt-2">
                  <CardDescription>
                    Recent Saturday attendance headcounts. Export today&apos;s
                    pastel hierarchy sheet as a client-side PDF.
                  </CardDescription>
                  <div className="space-y-2">
                    {history.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">
                        No historical Saturday logs yet.
                      </p>
                    ) : (
                      history.map((h) => (
                        <div
                          key={h.serviceDate}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm"
                        >
                          <span className="font-semibold text-slate-800">
                            {formatManilaDate(h.serviceDate)}
                          </span>
                          <Badge variant="secondary">{h.count} Present</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

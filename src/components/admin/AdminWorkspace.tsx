"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileClock,
  GraduationCap,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminGraduateLeaderAction,
  adminUnlockLiquidationAction,
  adminUpdateProfileOverrideAction,
} from "@/actions/admin";
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import { formatManilaDate, formatManilaDateTime, formatPhp } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/rbac";
import { SeasonalThemeStudio } from "@/components/admin/SeasonalThemeStudio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AppRole,
  AppThemeSettingsRow,
  CashLiquidationRow,
  DiscipleshipTier,
  ProfileRow,
  SystemAuditLogRow,
} from "@/types/database.types";

export function AdminWorkspace({
  theme,
  profiles,
  lockedSheets,
  auditLogs,
}: {
  theme: AppThemeSettingsRow;
  profiles: ProfileRow[];
  lockedSheets: CashLiquidationRow[];
  auditLogs: SystemAuditLogRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // Profile Override Modal
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [ovRole, setOvRole] = useState<AppRole>("member");
  const [ovTier, setOvTier] = useState<DiscipleshipTier>("new_invite");
  const [ovLeader, setOvLeader] = useState<string>("none");
  const [ovStreak, setOvStreak] = useState<number>(0);
  const [ovReason, setOvReason] = useState("");

  // Leader Graduation Form
  const [gradLeaderId, setGradLeaderId] = useState("");
  const [incomingLeaderId, setIncomingLeaderId] = useState("");
  const [gradReason, setGradReason] = useState("");

  // Unlock Sheet Modal
  const [unlockingSheet, setUnlockingSheet] =
    useState<CashLiquidationRow | null>(null);
  const [unlockReason, setUnlockReason] = useState("");

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  const cellLeaders = useMemo(
    () => profiles.filter((p) => p.tier === "cell_leader"),
    [profiles]
  );

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  function openOverrideDialog(p: ProfileRow) {
    setEditing(p);
    setOvRole(p.role);
    setOvTier(p.tier);
    setOvLeader(p.current_leader_id ?? "none");
    setOvStreak(p.consecutive_saturday_streak);
    setOvReason("");
  }

  function handleSaveOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    startTransition(async () => {
      const res = await adminUpdateProfileOverrideAction({
        profileId: editing.id,
        role: ovRole,
        tier: ovTier,
        current_leader_id: ovLeader === "none" ? null : ovLeader,
        consecutive_saturday_streak: ovStreak,
        reason: ovReason,
      });
      if (!res.success) {
        toast.error(res.error ?? "Override failed.");
        return;
      }
      toast.success("Override applied and recorded in system_audit_logs.");
      setEditing(null);
      router.refresh();
    });
  }

  function handleGraduateLeader(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminGraduateLeaderAction({
        leaderId: gradLeaderId,
        incomingLeaderId,
        reason: gradReason,
      });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Graduation failed.");
        return;
      }
      toast.success(
        `Leader graduated to Alumni! ${res.data.reassignedMembers} member(s) reassigned & ${res.data.archivedNotes} private care note(s) archived.`
      );
      setGradLeaderId("");
      setIncomingLeaderId("");
      setGradReason("");
      router.refresh();
    });
  }

  function handleUnlockSheet(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockingSheet) return;
    startTransition(async () => {
      const res = await adminUnlockLiquidationAction({
        liquidationId: unlockingSheet.id,
        reason: unlockReason,
      });
      if (!res.success) {
        toast.error(res.error ?? "Unlock failed.");
        return;
      }
      toast.success("Cash liquidation sheet unlocked & audited.");
      setUnlockingSheet(null);
      setUnlockReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-[var(--color-primary)]" />
          System Admin Root Console
        </h1>
        <p className="text-sm text-slate-500">
          Unrestricted developer root overrides, Leader Graduation, Seasonal
          Theme Studio, and immutable audit ledger. Every override writes to{" "}
          <code>system_audit_logs</code>.
        </p>
      </div>

      <Tabs defaultValue="overrides" className="w-full">
        <TabsList className="w-full max-w-2xl">
          <TabsTrigger value="overrides">Admin Overrides</TabsTrigger>
          <TabsTrigger value="graduation">Leader Graduation</TabsTrigger>
          <TabsTrigger value="theme">Seasonal Theme</TabsTrigger>
          <TabsTrigger value="audit">
            Audit Logs ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PROFILE & LIQUIDATION OVERRIDES */}
        <TabsContent value="overrides" className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Member Roles, Tiers &amp; Streaks</CardTitle>
                  <CardDescription>
                    Manually assign RBAC roles, promote emerging Cell Leaders,
                    or correct attendance streaks with mandatory audit reasons.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search profiles..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>App Role</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Cell Leader</TableHead>
                    <TableHead className="text-right">Streak</TableHead>
                    <TableHead className="text-right">Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((p) => {
                    const style = getHierarchyStyle(
                      p.tier,
                      p.current_leader_id
                    );
                    return (
                      <TableRow key={p.id} className={style.rowClass}>
                        <TableCell>
                          <div>
                            <p>{p.full_name}</p>
                            <p className="text-[11px] opacity-75 not-italic font-normal">
                              {p.email || "Unclaimed walk-in"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="not-italic">
                          <Badge variant="outline">{ROLE_LABELS[p.role]}</Badge>
                        </TableCell>
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
                        <TableCell className="not-italic font-normal text-xs">
                          {p.current_leader_id
                            ? profileMap.get(p.current_leader_id)?.full_name ??
                              "—"
                            : "Top-Level / None"}
                        </TableCell>
                        <TableCell className="text-right not-italic font-semibold">
                          {p.consecutive_saturday_streak}w
                        </TableCell>
                        <TableCell className="text-right not-italic">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-white/90"
                            onClick={() => openOverrideDialog(p)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Locked Cash Sheets Override */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-amber-600" />
                Locked Treasury Liquidations ({lockedSheets.length})
              </CardTitle>
              <CardDescription>
                Emergency unlock for 2-Counter PIN locked Saturday liquidation
                sheets. Requires an audited reason.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {lockedSheets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No locked cash liquidation sheets currently exist.
                </p>
              ) : (
                lockedSheets.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {formatManilaDate(s.service_date)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Physical Cash: {formatPhp(s.actual_physical_cash)} · Net
                        Turn-Over: {formatPhp(s.net_turnover)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setUnlockingSheet(s);
                        setUnlockReason("");
                      }}
                    >
                      <Unlock className="h-3.5 w-3.5" />
                      Emergency Unlock
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: LEADER GRADUATION WORKFLOW */}
        <TabsContent value="graduation">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-[var(--color-primary)]" />
                Cell Leader Graduation &amp; Care Vault Archival
              </CardTitle>
              <CardDescription>
                Transitions a Cell Leader to <strong>Alumni</strong>, reassigns
                their direct disciples&apos; <code>current_leader_id</code>{" "}
                (never overwriting permanent <code>invited_by_id</code>), and
                sets <code>is_archived = TRUE</code> on their old encrypted{" "}
                <code>care_notes</code> so the incoming leader begins with a
                clean, private Care Vault.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGraduateLeader} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Graduating Cell Leader</Label>
                  <Select value={gradLeaderId} onValueChange={setGradLeaderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose graduating Cell Leader" />
                    </SelectTrigger>
                    <SelectContent>
                      {cellLeaders.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Incoming Cell Leader (New Active Shepherd)</Label>
                  <Select
                    value={incomingLeaderId}
                    onValueChange={setIncomingLeaderId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose incoming Cell Leader" />
                    </SelectTrigger>
                    <SelectContent>
                      {cellLeaders
                        .filter((l) => l.id !== gradLeaderId)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="grad-reason">Audit Reason *</Label>
                  <Input
                    id="grad-reason"
                    required
                    minLength={3}
                    placeholder="e.g., Transitioning to Young Adults ministry (Q4 Graduation)"
                    value={gradReason}
                    onChange={(e) => setGradReason(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    isPending || !gradLeaderId || !incomingLeaderId || !gradReason
                  }
                >
                  <GraduationCap className="h-4 w-4" />
                  Execute Leader Graduation &amp; Archive Vault
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SEASONAL THEME STUDIO */}
        <TabsContent value="theme">
          <SeasonalThemeStudio currentTheme={theme} />
        </TabsContent>

        {/* TAB 4: SYSTEM AUDIT LOGS */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileClock className="h-5 w-5 text-[var(--color-primary)]" />
                Immutable System Audit Ledger
              </CardTitle>
              <CardDescription>
                Append-only history of every System Admin override, Leader
                Graduation, cash sheet unlock, and seasonal theme change.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {auditLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No audit events logged yet.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{log.action}</Badge>
                        <code className="text-xs text-slate-600">
                          {log.target_table}
                        </code>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatManilaDateTime(log.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-900 font-medium">
                      Reason: {log.reason}
                    </p>
                    <p className="text-xs text-slate-500">
                      Actor:{" "}
                      {profileMap.get(log.actor_id)?.full_name ?? log.actor_id}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PROFILE OVERRIDE DIALOG */}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                  Admin Override — {editing.full_name}
                </DialogTitle>
                <DialogDescription>
                  Changes take effect immediately and are logged permanently to{" "}
                  <code>system_audit_logs</code>.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveOverride} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>App Role</Label>
                    <Select
                      value={ovRole}
                      onValueChange={(v) => setOvRole(v as AppRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="cell_leader">Cell Leader</SelectItem>
                        <SelectItem value="registrar">Registrar</SelectItem>
                        <SelectItem value="treasurer">Treasurer</SelectItem>
                        <SelectItem value="pastor">Pastor</SelectItem>
                        <SelectItem value="system_admin">
                          System Admin
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Discipleship Tier</Label>
                    <Select
                      value={ovTier}
                      onValueChange={(v) => setOvTier(v as DiscipleshipTier)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_invite">New Invite</SelectItem>
                        <SelectItem value="invite">Invite</SelectItem>
                        <SelectItem value="disciple">Disciple</SelectItem>
                        <SelectItem value="cell_leader">Cell Leader</SelectItem>
                        <SelectItem value="alumni">Alumni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Active Cell Leader</Label>
                    <Select value={ovLeader} onValueChange={setOvLeader}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          None (Top-Level / Unassigned)
                        </SelectItem>
                        {cellLeaders
                          .filter((l) => l.id !== editing.id)
                          .map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="ov-streak">Consecutive Streak (wks)</Label>
                    <Input
                      id="ov-streak"
                      type="number"
                      min={0}
                      value={ovStreak}
                      onChange={(e) =>
                        setOvStreak(
                          Math.max(0, Number.parseInt(e.target.value || "0", 10))
                        )
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ov-reason">Mandatory Audit Reason *</Label>
                  <Input
                    id="ov-reason"
                    required
                    minLength={3}
                    placeholder="Why is this manual override needed?"
                    value={ovReason}
                    onChange={(e) => setOvReason(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  Apply Audited Override
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* UNLOCK LIQUIDATION DIALOG */}
      <Dialog
        open={Boolean(unlockingSheet)}
        onOpenChange={(open) => !open && setUnlockingSheet(null)}
      >
        <DialogContent>
          {unlockingSheet && (
            <>
              <DialogHeader>
                <DialogTitle>Unlock Locked Cash Liquidation</DialogTitle>
                <DialogDescription>
                  Service Date:{" "}
                  {formatManilaDate(unlockingSheet.service_date)}. Both counter
                  signatures will be cleared and logged to{" "}
                  <code>system_audit_logs</code>.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUnlockSheet} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="unlock-reason">Mandatory Audit Reason *</Label>
                  <Input
                    id="unlock-reason"
                    required
                    minLength={3}
                    placeholder="e.g., Late GCash entry correction requested by Treasurer"
                    value={unlockReason}
                    onChange={(e) => setUnlockReason(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="destructive"
                  className="w-full"
                  disabled={isPending}
                >
                  Confirm Unlock &amp; Log Audit Entry
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

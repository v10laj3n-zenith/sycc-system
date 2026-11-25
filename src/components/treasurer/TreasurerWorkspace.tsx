"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Coins,
  KeyRound,
  Lock,
  Plus,
  Radio,
  Receipt,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { createClient, isSupabaseEnvReady } from "@/lib/supabase/client";
import { compressImageToWebp } from "@/lib/image-compress";
import { formatManilaDate, formatPhp } from "@/lib/format";
import {
  addLiquidationExpenseAction,
  deleteGivingAction,
  deleteLiquidationExpenseAction,
  recordGivingAction,
  saveDenominationCountsAction,
  setTreasurerPinAction,
  signAndLockLiquidationAction,
} from "@/actions/treasury";
import { LiquidationReportPdfButton } from "@/components/reports/LiquidationReportPdf";
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
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  CashLiquidationRow,
  EligibleCounter,
  GivingType,
  LiquidationExpenseRow,
  PaymentMethod,
  TitheOfferingRow,
} from "@/types/database.types";

export interface SimpleRosterPerson {
  id: string;
  full_name: string;
  nickname: string | null;
}

const PHP_DENOMS = [
  { key: "count_1000", label: "₱1,000", value: 1000 },
  { key: "count_500", label: "₱500", value: 500 },
  { key: "count_200", label: "₱200", value: 200 },
  { key: "count_100", label: "₱100", value: 100 },
  { key: "count_50", label: "₱50", value: 50 },
  { key: "count_20", label: "₱20", value: 20 },
  { key: "count_10", label: "₱10", value: 10 },
  { key: "count_5", label: "₱5", value: 5 },
  { key: "count_1", label: "₱1", value: 1 },
] as const;

type DenomKey = (typeof PHP_DENOMS)[number]["key"];

export function TreasurerWorkspace({
  currentProfileId,
  serviceDate,
  roster,
  initialPresentIds,
  todayEntries,
  liquidation,
  expenses,
  eligibleCounters,
  recentSheets,
}: {
  currentProfileId: string;
  serviceDate: string;
  roster: SimpleRosterPerson[];
  initialPresentIds: string[];
  todayEntries: TitheOfferingRow[];
  liquidation: CashLiquidationRow | null;
  expenses: LiquidationExpenseRow[];
  eligibleCounters: EligibleCounter[];
  recentSheets: CashLiquidationRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Live Realtime Present Giver IDs (merged cleanly with server-rendered initialPresentIds)
  const [realtimeAddedIds, setRealtimeAddedIds] = useState<string[]>([]);
  const [realtimeRemovedIds, setRealtimeRemovedIds] = useState<string[]>([]);
  const [realtimeLive, setRealtimeLive] = useState(false);
  const [giverSearch, setGiverSearch] = useState("");

  const presentIds = useMemo(() => {
    const removedSet = new Set(realtimeRemovedIds);
    const merged = [...realtimeAddedIds, ...initialPresentIds].filter(
      (id) => !removedSet.has(id)
    );
    return Array.from(new Set(merged));
  }, [initialPresentIds, realtimeAddedIds, realtimeRemovedIds]);

  // Quick Giving Form
  const [selectedGiverId, setSelectedGiverId] = useState<string>("anonymous");
  const [amount, setAmount] = useState("");
  const [givingType, setGivingType] = useState<GivingType>("tithe");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [refNumber, setRefNumber] = useState("");

  // PHP Bill/Coin Counter State
  const [counts, setCounts] = useState<Record<DenomKey, number>>({
    count_1000: liquidation?.count_1000 ?? 0,
    count_500: liquidation?.count_500 ?? 0,
    count_200: liquidation?.count_200 ?? 0,
    count_100: liquidation?.count_100 ?? 0,
    count_50: liquidation?.count_50 ?? 0,
    count_20: liquidation?.count_20 ?? 0,
    count_10: liquidation?.count_10 ?? 0,
    count_5: liquidation?.count_5 ?? 0,
    count_1: liquidation?.count_1 ?? 0,
  });

  // Petty Cash Expense State
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmt, setExpenseAmt] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);

  // PIN Registration & 2-Counter Sign-Off Dialogs
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [myNewPin, setMyNewPin] = useState("");
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [counter1Id, setCounter1Id] = useState(currentProfileId);
  const [counter1Pin, setCounter1Pin] = useState("");
  const [counter2Id, setCounter2Id] = useState("");
  const [counter2Pin, setCounter2Pin] = useState("");

  const isLocked = Boolean(liquidation?.is_locked);

  // Supabase Realtime subscription on attendance_logs for live Present Today roster
  useEffect(() => {
    if (!isSupabaseEnvReady()) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`treasurer-attendance-${serviceDate}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_logs",
          filter: `service_date=eq.${serviceDate}`,
        },
        (payload) => {
          const newProfileId = (payload.new as { profile_id?: string })
            ?.profile_id;
          if (!newProfileId) return;
          setRealtimeRemovedIds((prev) =>
            prev.filter((id) => id !== newProfileId)
          );
          setRealtimeAddedIds((prev) =>
            prev.includes(newProfileId) ? prev : [newProfileId, ...prev]
          );
          toast.info("New youth checked in at door — Present Givers updated!");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "attendance_logs",
        },
        (payload) => {
          const removedId = (payload.old as { profile_id?: string })?.profile_id;
          if (!removedId) return;
          setRealtimeAddedIds((prev) => prev.filter((id) => id !== removedId));
          setRealtimeRemovedIds((prev) =>
            prev.includes(removedId) ? prev : [...prev, removedId]
          );
        }
      )
      .subscribe((status) => {
        setRealtimeLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serviceDate]);

  const rosterMap = useMemo(
    () => new Map(roster.map((p) => [p.id, p])),
    [roster]
  );

  const presentPeople = useMemo(() => {
    const q = giverSearch.trim().toLowerCase();
    return presentIds
      .map((id) => rosterMap.get(id))
      .filter(Boolean)
      .filter((p) =>
        q
          ? p!.full_name.toLowerCase().includes(q) ||
            (p!.nickname ?? "").toLowerCase().includes(q)
          : true
      ) as SimpleRosterPerson[];
  }, [presentIds, rosterMap, giverSearch]);

  const expectedCashTotal = useMemo(
    () =>
      todayEntries
        .filter((e) => e.payment_method === "cash")
        .reduce((sum, e) => sum + Number(e.amount), 0),
    [todayEntries]
  );

  const gcashTotal = useMemo(
    () =>
      todayEntries
        .filter((e) => e.payment_method === "gcash_ewallet")
        .reduce((sum, e) => sum + Number(e.amount), 0),
    [todayEntries]
  );

  const actualPhysicalCash = useMemo(
    () =>
      PHP_DENOMS.reduce(
        (sum, denom) => sum + (counts[denom.key] || 0) * denom.value,
        0
      ),
    [counts]
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [expenses]
  );

  const variance = actualPhysicalCash - expectedCashTotal;
  const netTurnover = actualPhysicalCash - totalExpenses;

  const counterNameMap = useMemo(
    () => new Map(eligibleCounters.map((c) => [c.profile_id, c.full_name])),
    [eligibleCounters]
  );

  function handleRecordGiving(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordGivingAction({
        giverId: selectedGiverId === "anonymous" ? null : selectedGiverId,
        serviceDate,
        amount: Number(amount),
        givingType,
        paymentMethod,
        referenceNumber: paymentMethod === "gcash_ewallet" ? refNumber : null,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to record giving.");
        return;
      }
      setAmount("");
      setRefNumber("");
      toast.success("Giving entry recorded & reconciliation updated.");
      router.refresh();
    });
  }

  function handleSaveDenominations() {
    startTransition(async () => {
      const res = await saveDenominationCountsAction({
        serviceDate,
        ...counts,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to save cash counts.");
        return;
      }
      toast.success("PHP denomination counts saved.");
      router.refresh();
    });
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setReceiptUploading(true);
    try {
      const compressed = await compressImageToWebp(rawFile);
      const supabase = createClient();
      const path = `${serviceDate}/receipt-${Date.now()}.webp`;
      const { error } = await supabase.storage
        .from("receipts")
        .upload(path, compressed, { contentType: "image/webp" });

      if (error) {
        toast.error(error.message);
        return;
      }
      setReceiptPath(path);
      toast.success(
        `Receipt compressed (${Math.round(compressed.size / 1024)} KB WebP) & attached!`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not compress receipt."
      );
    } finally {
      setReceiptUploading(false);
    }
  }

  function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addLiquidationExpenseAction({
        serviceDate,
        description: expenseDesc,
        amount: Number(expenseAmt),
        receiptImageUrl: receiptPath,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to add petty cash expense.");
        return;
      }
      setExpenseDesc("");
      setExpenseAmt("");
      setReceiptPath(null);
      toast.success("Petty cash expense deducted from Net Turn-Over.");
      router.refresh();
    });
  }

  function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await setTreasurerPinAction(myNewPin);
      if (!res.success) {
        toast.error(res.error ?? "Could not save PIN.");
        return;
      }
      setMyNewPin("");
      setPinDialogOpen(false);
      toast.success("Your Treasury Counter PIN is now registered.");
      router.refresh();
    });
  }

  function handleLockLiquidation(e: React.FormEvent) {
    e.preventDefault();
    if (!liquidation) {
      toast.error("Save denomination counts or record an entry first.");
      return;
    }

    startTransition(async () => {
      const res = await signAndLockLiquidationAction({
        liquidationId: liquidation.id,
        counter1Id,
        counter1Pin,
        counter2Id,
        counter2Pin,
      });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "2-Counter PIN sign-off failed.");
        return;
      }
      setLockDialogOpen(false);
      setCounter1Pin("");
      setCounter2Pin("");
      toast.success(
        `Liquidation LOCKED! Receipts dispatched: ${res.data.emailsSent} email(s), ${res.data.pushesSent} push alert(s).`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Coins className="h-6 w-6 text-[var(--color-primary)]" />
            Treasury &amp; PHP Liquidation Desk
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>
              Service Date: <strong>{formatManilaDate(serviceDate)}</strong>
            </span>
            <Badge variant={realtimeLive ? "success" : "secondary"}>
              <Radio className="h-3 w-3" />
              {realtimeLive ? "Realtime Sync Live" : "Connecting Realtime"}
            </Badge>
            {isLocked && (
              <Badge variant="default">
                <Lock className="h-3 w-3" />
                Locked by 2-Counter PIN
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <KeyRound className="h-4 w-4" />
                Set My PIN
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register Treasury Counter PIN</DialogTitle>
                <DialogDescription>
                  Stored securely with bcrypt (pgcrypto). Required for 2-Counter
                  liquidation sign-off.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSetPin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="treasurer-pin">4–8 Digit Numeric PIN</Label>
                  <Input
                    id="treasurer-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4,8}"
                    required
                    placeholder="••••••"
                    value={myNewPin}
                    onChange={(e) => setMyNewPin(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  Save Secure PIN
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <LiquidationReportPdfButton
            serviceDate={serviceDate}
            sheet={liquidation}
            expenses={expenses}
            counter1Name={
              liquidation?.counter_1_id
                ? counterNameMap.get(liquidation.counter_1_id) ?? "Verified"
                : "Pending"
            }
            counter2Name={
              liquidation?.counter_2_id
                ? counterNameMap.get(liquidation.counter_2_id) ?? "Verified"
                : "Pending"
            }
          />
        </div>
      </div>

      {/* Top Financial KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-slate-500">
              Expected Cash
            </p>
            <p className="mt-1 text-xl font-black text-slate-900">
              {formatPhp(expectedCashTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-slate-500">
              Counted Physical Cash
            </p>
            <p className="mt-1 text-xl font-black text-[#1E3A8A]">
              {formatPhp(actualPhysicalCash)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            variance === 0
              ? "bg-[#DCFCE7] border-[#86EFAC]"
              : "bg-[#FEF9C3] border-[#FDE047]"
          )}
        >
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-slate-700">
              Cash Variance
            </p>
            <p className="mt-1 text-xl font-black text-slate-900">
              {formatPhp(variance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-slate-500">
              GCash / E-Wallet
            </p>
            <p className="mt-1 text-xl font-black text-emerald-700">
              {formatPhp(gcashTotal)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#DBEAFE] border-[#93C5FD] col-span-2 lg:col-span-1">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-bold uppercase text-[#1E3A8A]">
              Net Cash Turn-Over
            </p>
            <p className="mt-1 text-xl font-black text-[#1E3A8A]">
              {formatPhp(netTurnover)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Split-Screen Operational Workspace */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* LEFT PANE (5 cols): Live "Present Today" Giver Roster + Quick Entry */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Record Tithe / Offering</CardTitle>
              <CardDescription>
                Click any present youth below to auto-fill their name, or record
                an anonymous loose plate offering.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRecordGiving} className="space-y-3">
                <div className="space-y-1">
                  <Label>Giver</Label>
                  <Select
                    value={selectedGiverId}
                    onValueChange={setSelectedGiverId}
                    disabled={isLocked}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anonymous">
                        Anonymous / Loose Plate Offering
                      </SelectItem>
                      {roster.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                          {presentIds.includes(p.id) ? " (Present)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="give-amount">Amount (₱ PHP)</Label>
                    <Input
                      id="give-amount"
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      disabled={isLocked}
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select
                      value={givingType}
                      onValueChange={(v) => setGivingType(v as GivingType)}
                      disabled={isLocked}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tithe">Tithe</SelectItem>
                        <SelectItem value="offering">Offering</SelectItem>
                        <SelectItem value="missions">Missions</SelectItem>
                        <SelectItem value="special">Special Giving</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label>Payment Method</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(v) =>
                        setPaymentMethod(v as PaymentMethod)
                      }
                      disabled={isLocked}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Physical Cash</SelectItem>
                        <SelectItem value="gcash_ewallet">
                          GCash / E-Wallet
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentMethod === "gcash_ewallet" && (
                    <div className="space-y-1">
                      <Label htmlFor="gcash-ref">Reference #</Label>
                      <Input
                        id="gcash-ref"
                        disabled={isLocked}
                        placeholder="GCash Ref"
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending || isLocked}
                >
                  <Plus className="h-4 w-4" />
                  {isLocked ? "Sheet Locked" : "Record Giving Entry"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Present Today ({presentIds.length})</CardTitle>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Live from Registration
                </span>
              </div>
              <div className="relative pt-1">
                <Search className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Filter present youth..."
                  className="pl-9"
                  value={giverSearch}
                  onChange={(e) => setGiverSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-[340px] overflow-y-auto space-y-1.5">
              {presentPeople.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Waiting for youth check-ins from the Registrar Desk...
                </p>
              ) : (
                presentPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setSelectedGiverId(person.id)}
                    className={cn(
                      "flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3.5 py-2 text-left text-sm transition-colors cursor-pointer",
                      selectedGiverId === person.id
                        ? "border-[#93C5FD] bg-[#DBEAFE] font-bold text-[#1E3A8A]"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                    )}
                  >
                    <span>{person.full_name}</span>
                    <span className="text-xs text-slate-500">Select</span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANE (7 cols): PHP Bill Counter, Expenses & Liquidation, Ledger */}
        <Card className="lg:col-span-7">
          <CardContent className="p-4 sm:p-5">
            <Tabs defaultValue="counter" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="counter">PHP Counter</TabsTrigger>
                <TabsTrigger value="liquidation">
                  Expenses &amp; Lock
                </TabsTrigger>
                <TabsTrigger value="entries">
                  Today ({todayEntries.length})
                </TabsTrigger>
                <TabsTrigger value="history">Reports</TabsTrigger>
              </TabsList>

              {/* TAB 1: PHP BILL & COIN COUNTER */}
              <TabsContent value="counter" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {PHP_DENOMS.map((denom) => {
                    const qty = counts[denom.key] || 0;
                    return (
                      <div
                        key={denom.key}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold text-slate-900">
                            {denom.label}
                          </span>
                          <span className="text-xs font-semibold text-slate-600">
                            {formatPhp(qty * denom.value)}
                          </span>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          disabled={isLocked}
                          value={qty}
                          onChange={(e) =>
                            setCounts((prev) => ({
                              ...prev,
                              [denom.key]: Math.max(
                                0,
                                Number.parseInt(e.target.value || "0", 10) || 0
                              ),
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#DBEAFE]/50 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#1E3A8A]">
                      Physical Cash Counted vs. Expected Cash
                    </p>
                    <p className="text-lg font-black text-slate-900">
                      {formatPhp(actualPhysicalCash)}{" "}
                      <span className="text-xs font-semibold text-slate-600">
                        (Expected: {formatPhp(expectedCashTotal)} · Variance:{" "}
                        {formatPhp(variance)})
                      </span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={isPending || isLocked}
                    onClick={handleSaveDenominations}
                  >
                    <Save className="h-4 w-4" />
                    Save Count
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 2: PETTY CASH EXPENSES & 2-COUNTER PIN LOCK */}
              <TabsContent value="liquidation" className="space-y-5 pt-3">
                <form
                  onSubmit={handleAddExpense}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <p className="text-sm font-bold text-slate-900">
                    Deduct Saturday Petty Cash Expense
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <Input
                      className="sm:col-span-2"
                      required
                      disabled={isLocked}
                      placeholder="e.g., Snacks for band / printed handouts"
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      disabled={isLocked}
                      placeholder="Amount (₱)"
                      value={expenseAmt}
                      onChange={(e) => setExpenseAmt(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <Upload className="h-4 w-4" />
                      {receiptUploading
                        ? "Compressing <= 30 KB WebP..."
                        : receiptPath
                        ? "WebP Receipt Attached"
                        : "Attach Receipt Photo (WebP)"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isLocked || receiptUploading}
                        className="sr-only"
                        onChange={handleReceiptUpload}
                      />
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isPending || isLocked || receiptUploading}
                    >
                      <Plus className="h-4 w-4" />
                      Add Expense
                    </Button>
                  </div>
                </form>

                {/* Expense List */}
                <div className="space-y-2">
                  {expenses.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {ex.description}
                        </p>
                        {ex.receipt_image_url && (
                          <p className="text-[11px] text-emerald-700">
                            Receipt WebP uploaded
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-700">
                          - {formatPhp(ex.amount)}
                        </span>
                        {!isLocked && liquidation && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                await deleteLiquidationExpenseAction(
                                  ex.id,
                                  liquidation.id
                                );
                                router.refresh();
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Net Turn-Over & 2-Counter PIN Sign-Off Box */}
                <div className="rounded-2xl border-2 border-[#93C5FD] bg-[#DBEAFE]/60 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#1E3A8A]">
                        Gross Physical Cash ({formatPhp(actualPhysicalCash)}) −
                        Expenses ({formatPhp(totalExpenses)})
                      </p>
                      <p className="text-2xl font-black text-[#1E3A8A] mt-0.5">
                        Net Turn-Over: {formatPhp(netTurnover)}
                      </p>
                    </div>

                    {isLocked ? (
                      <Badge variant="success" className="px-3 py-1.5 text-xs">
                        <ShieldCheck className="h-4 w-4" />
                        Locked &amp; Receipts Dispatched
                      </Badge>
                    ) : (
                      <Dialog
                        open={lockDialogOpen}
                        onOpenChange={setLockDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button variant="default" size="lg">
                            <Lock className="h-4 w-4" />
                            2-Counter PIN Sign-Off &amp; Lock
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              2-Counter PIN Verification &amp; Receipt Dispatch
                            </DialogTitle>
                            <DialogDescription>
                              Two distinct authorized counters must enter their
                              PINs to lock this Saturday&apos;s liquidation
                              sheet and automatically send HTML email &amp; push
                              receipts to givers.
                            </DialogDescription>
                          </DialogHeader>
                          <form
                            onSubmit={handleLockLiquidation}
                            className="space-y-4"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>Counter 1</Label>
                                <Select
                                  value={counter1Id}
                                  onValueChange={setCounter1Id}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Counter 1" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {eligibleCounters.map((c) => (
                                      <SelectItem
                                        key={c.profile_id}
                                        value={c.profile_id}
                                      >
                                        {c.full_name}{" "}
                                        {c.has_pin ? "(PIN Set)" : "(No PIN)"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="pin-1">Counter 1 PIN</Label>
                                <Input
                                  id="pin-1"
                                  type="password"
                                  inputMode="numeric"
                                  required
                                  placeholder="••••"
                                  value={counter1Pin}
                                  onChange={(e) =>
                                    setCounter1Pin(e.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>Counter 2 (Must be different)</Label>
                                <Select
                                  value={counter2Id}
                                  onValueChange={setCounter2Id}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Counter 2" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {eligibleCounters
                                      .filter(
                                        (c) => c.profile_id !== counter1Id
                                      )
                                      .map((c) => (
                                        <SelectItem
                                          key={c.profile_id}
                                          value={c.profile_id}
                                        >
                                          {c.full_name}{" "}
                                          {c.has_pin ? "(PIN Set)" : "(No PIN)"}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="pin-2">Counter 2 PIN</Label>
                                <Input
                                  id="pin-2"
                                  type="password"
                                  inputMode="numeric"
                                  required
                                  placeholder="••••"
                                  value={counter2Pin}
                                  onChange={(e) =>
                                    setCounter2Pin(e.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <Button
                              type="submit"
                              className="w-full"
                              size="lg"
                              disabled={isPending}
                            >
                              <ShieldCheck className="h-4 w-4" />
                              {isPending
                                ? "Verifying PINs & Sending Receipts..."
                                : "Verify Both PINs & Lock Sheet"}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: TODAY'S GIVING LEDGER */}
              <TabsContent value="entries" className="space-y-2 pt-3">
                {todayEntries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No giving entries recorded for{" "}
                    {formatManilaDate(serviceDate)} yet.
                  </p>
                ) : (
                  todayEntries.map((entry) => {
                    const giverName = entry.giver_id
                      ? rosterMap.get(entry.giver_id)?.full_name ?? "Member"
                      : "Anonymous / Loose Plate";
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {giverName}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">
                            {entry.giving_type} ·{" "}
                            {entry.payment_method === "gcash_ewallet"
                              ? `GCash${
                                  entry.reference_number
                                    ? ` (${entry.reference_number})`
                                    : ""
                                }`
                              : "Cash"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-extrabold text-slate-900">
                              {formatPhp(entry.amount)}
                            </p>
                            {entry.receipt_sent_at && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Receipt Sent
                              </span>
                            )}
                          </div>
                          {!isLocked && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() =>
                                startTransition(async () => {
                                  await deleteGivingAction(
                                    entry.id,
                                    serviceDate
                                  );
                                  router.refresh();
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-slate-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* TAB 4: HISTORICAL FINANCIAL REPORTS */}
              <TabsContent value="history" className="space-y-2 pt-3">
                {recentSheets.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No previous Saturday liquidation sheets yet.
                  </p>
                ) : (
                  recentSheets.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
                          {formatManilaDate(s.service_date)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Cash: {formatPhp(s.actual_physical_cash)} · GCash:{" "}
                          {formatPhp(s.gcash_ewallet_total)} · Exp:{" "}
                          {formatPhp(s.total_expenses)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-[#1E3A8A]">
                          Net: {formatPhp(s.net_turnover)}
                        </p>
                        <Badge variant={s.is_locked ? "success" : "warning"}>
                          {s.is_locked ? "Locked" : "Open"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

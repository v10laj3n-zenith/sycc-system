"use client";

import { useState } from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { formatManilaDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import type {
  CashLiquidationRow,
  LiquidationExpenseRow,
} from "@/types/database.types";

function pdfPhp(val: number): string {
  return `PHP ${Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  title: { fontSize: 16, fontWeight: "bold", color: "#1E3A8A" },
  sub: { fontSize: 10, color: "#475569", marginTop: 3, marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 6,
    color: "#1E3A8A",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  boldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    backgroundColor: "#DBEAFE",
    marginTop: 4,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 22,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#CBD5E1",
    fontSize: 9,
    color: "#475569",
  },
});

const DENOMS: Array<{
  label: string;
  key: keyof Pick<
    CashLiquidationRow,
    | "count_1000"
    | "count_500"
    | "count_200"
    | "count_100"
    | "count_50"
    | "count_20"
    | "count_10"
    | "count_5"
    | "count_1"
  >;
  value: number;
}> = [
  { label: "PHP 1,000 Bills", key: "count_1000", value: 1000 },
  { label: "PHP 500 Bills", key: "count_500", value: 500 },
  { label: "PHP 200 Bills", key: "count_200", value: 200 },
  { label: "PHP 100 Bills", key: "count_100", value: 100 },
  { label: "PHP 50 Bills", key: "count_50", value: 50 },
  { label: "PHP 20 Bills / Coins", key: "count_20", value: 20 },
  { label: "PHP 10 Coins", key: "count_10", value: 10 },
  { label: "PHP 5 Coins", key: "count_5", value: 5 },
  { label: "PHP 1 Coins", key: "count_1", value: 1 },
];

function LiquidationPdfDoc({
  serviceDate,
  sheet,
  expenses,
  counter1Name,
  counter2Name,
}: {
  serviceDate: string;
  sheet: CashLiquidationRow;
  expenses: LiquidationExpenseRow[];
  counter1Name: string;
  counter2Name: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          SYCC Youth Treasury — Cash Liquidation Report
        </Text>
        <Text style={styles.sub}>
          Service Date: {formatManilaDate(serviceDate)} · Status:{" "}
          {sheet.is_locked ? "LOCKED (2-Counter PIN Verified)" : "DRAFT / OPEN"}
        </Text>

        <Text style={styles.sectionTitle}>
          1. Physical PHP Denomination Breakdown
        </Text>
        {DENOMS.map((d) => {
          const qty = Number(sheet[d.key] ?? 0);
          return (
            <View key={d.key} style={styles.row}>
              <Text>
                {d.label} × {qty}
              </Text>
              <Text>{pdfPhp(qty * d.value)}</Text>
            </View>
          );
        })}
        <View style={styles.boldRow}>
          <Text>Actual Physical Cash Counted</Text>
          <Text>{pdfPhp(sheet.actual_physical_cash)}</Text>
        </View>

        <Text style={styles.sectionTitle}>
          2. Cash Reconciliation &amp; GCash / E-Wallet
        </Text>
        <View style={styles.row}>
          <Text>Expected Cash Total (Recorded Cash Entries)</Text>
          <Text>{pdfPhp(sheet.expected_cash_total)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Cash Variance (Actual - Expected)</Text>
          <Text>{pdfPhp(sheet.variance)}</Text>
        </View>
        <View style={styles.row}>
          <Text>GCash / E-Wallet Total (Non-Physical)</Text>
          <Text>{pdfPhp(sheet.gcash_ewallet_total)}</Text>
        </View>

        <Text style={styles.sectionTitle}>
          3. Saturday Petty Cash Expenses
        </Text>
        {expenses.length === 0 ? (
          <View style={styles.row}>
            <Text>No petty cash expenses recorded</Text>
            <Text>{pdfPhp(0)}</Text>
          </View>
        ) : (
          expenses.map((ex) => (
            <View key={ex.id} style={styles.row}>
              <Text>{ex.description}</Text>
              <Text>- {pdfPhp(ex.amount)}</Text>
            </View>
          ))
        )}
        <View style={styles.boldRow}>
          <Text>NET CASH TURN-OVER (Gross Physical Cash - Expenses)</Text>
          <Text>{pdfPhp(sheet.net_turnover)}</Text>
        </View>

        <View style={styles.footer}>
          <Text>
            Counter 1 Sign-Off: {counter1Name} · Counter 2 Sign-Off:{" "}
            {counter2Name}
          </Text>
          <Text>
            Generated locally in browser via SYCC Youth Growth &amp; Discipleship
            System (₱0/mo Free Tier).
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export function LiquidationReportPdfButton({
  serviceDate,
  sheet,
  expenses,
  counter1Name,
  counter2Name,
}: {
  serviceDate: string;
  sheet: CashLiquidationRow | null;
  expenses: LiquidationExpenseRow[];
  counter1Name: string;
  counter2Name: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!sheet) return;
    setBusy(true);
    try {
      const blob = await pdf(
        <LiquidationPdfDoc
          serviceDate={serviceDate}
          sheet={sheet}
          expenses={expenses}
          counter1Name={counter1Name}
          counter2Name={counter2Name}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SYCC-Liquidation-${serviceDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Liquidation PDF exported.");
    } catch {
      toast.error("Failed to export Liquidation PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!sheet || busy}
      onClick={handleExport}
    >
      <FileDown className="h-4 w-4" />
      {busy ? "Building PDF..." : "Export Liquidation PDF"}
    </Button>
  );
}

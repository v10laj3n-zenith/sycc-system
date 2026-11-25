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
  PastorFinancialSummaryRow,
  UmbrellaCellCount,
} from "@/types/database.types";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  title: { fontSize: 16, fontWeight: "bold", color: "#1E3A8A" },
  sub: { fontSize: 10, color: "#475569", marginTop: 3, marginBottom: 14 },
  h2: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    paddingBottom: 3,
  },
  grid: { flexDirection: "row", gap: 8, marginBottom: 8 },
  box: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
  },
  boxLabel: { fontSize: 8, color: "#64748B", textTransform: "uppercase" },
  boxVal: { fontSize: 13, fontWeight: "bold", marginTop: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
  },
});

function phpText(n: number): string {
  return `PHP ${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface PastorStatsSnapshot {
  totalYouth: number;
  cellLeaders: number;
  disciples: number;
  invites: number;
  newInvites: number;
  activeInMinistry: number;
}

function PastorPdfDocument({
  seasonTitle,
  stats,
  umbrellas,
  financials,
}: {
  seasonTitle: string;
  stats: PastorStatsSnapshot;
  umbrellas: UmbrellaCellCount[];
  financials: PastorFinancialSummaryRow[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          SYCC Youth Ministry — Pastoral Overview Report
        </Text>
        <Text style={styles.sub}>
          Season: {seasonTitle} · Masked Financial Totals &amp; Umbrella Cell
          Health
        </Text>

        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Total Youth</Text>
            <Text style={styles.boxVal}>{stats.totalYouth}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Cell Leaders</Text>
            <Text style={styles.boxVal}>{stats.cellLeaders}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Disciples (8w+)</Text>
            <Text style={styles.boxVal}>{stats.disciples}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Serving in Ministry</Text>
            <Text style={styles.boxVal}>{stats.activeInMinistry}</Text>
          </View>
        </View>

        <Text style={styles.h2}>Umbrella Cell Group Counts (Recursive)</Text>
        {umbrellas.map((u) => (
          <View
            key={u.leader_id}
            style={[
              styles.row,
              { backgroundColor: u.is_top_level ? "#DBEAFE" : "#DCFCE7" },
            ]}
          >
            <Text>
              {u.leader_name} ({u.is_top_level ? "Cell Leader" : "Cell Leader · Emerging"})
            </Text>
            <Text>
              Direct: {u.direct_count} | Umbrella Total: {u.umbrella_total}
            </Text>
          </View>
        ))}

        <Text style={styles.h2}>
          Aggregated Giving Summary (Individual Tithes Masked)
        </Text>
        {financials.map((f) => (
          <View key={f.service_date} style={styles.row}>
            <Text>{formatManilaDate(f.service_date)}</Text>
            <Text>
              Gross Cash: {phpText(f.gross_cash)} | GCash:{" "}
              {phpText(f.gcash_total)} | Net: {phpText(f.net_turnover)}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function PastorReportPdfButton({
  seasonTitle,
  stats,
  umbrellas,
  financials,
}: {
  seasonTitle: string;
  stats: PastorStatsSnapshot;
  umbrellas: UmbrellaCellCount[];
  financials: PastorFinancialSummaryRow[];
}) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const blob = await pdf(
        <PastorPdfDocument
          seasonTitle={seasonTitle}
          stats={stats}
          umbrellas={umbrellas}
          financials={financials}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SYCC-Pastor-Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Pastor Overview PDF downloaded.");
    } catch {
      toast.error("Failed to generate Pastor PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={busy} onClick={handleExport}>
      <FileDown className="h-4 w-4" />
      {busy ? "Generating PDF..." : "Export Pastor Report PDF"}
    </Button>
  );
}

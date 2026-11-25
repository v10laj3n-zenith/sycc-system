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
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import { formatManilaDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import type { DiscipleshipTier } from "@/types/database.types";

export interface AttendanceReportRow {
  fullName: string;
  tier: DiscipleshipTier;
  currentLeaderId: string | null;
  leaderName: string;
  streak: number;
  method: string;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
  },
  title: { fontSize: 16, fontWeight: "bold", color: "#1E3A8A" },
  subtitle: { fontSize: 10, color: "#475569", marginTop: 3 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#F8FAFC",
  },
  summaryLabel: { fontSize: 8, color: "#64748B", textTransform: "uppercase" },
  summaryValue: { fontSize: 13, fontWeight: "bold", marginTop: 2 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    padding: 6,
    fontWeight: "bold",
    fontSize: 9,
  },
  row: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
  },
  colName: { flex: 2.3 },
  colTier: { flex: 1.3 },
  colLeader: { flex: 1.6 },
  colStreak: { flex: 0.8, textAlign: "right" },
  colMethod: { flex: 1, textAlign: "right" },
});

function AttendancePdfDocument({
  serviceDate,
  rows,
}: {
  serviceDate: string;
  rows: AttendanceReportRow[];
}) {
  const leaders = rows.filter((r) => r.tier === "cell_leader").length;
  const disciples = rows.filter((r) => r.tier === "disciple").length;
  const invites = rows.filter((r) => r.tier === "invite").length;
  const newInvites = rows.filter((r) => r.tier === "new_invite").length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            SYCC Youth — Saturday Attendance Report
          </Text>
          <Text style={styles.subtitle}>
            Service Date: {formatManilaDate(serviceDate)} · Total Checked In:{" "}
            {rows.length}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Cell Leaders</Text>
            <Text style={styles.summaryValue}>{leaders}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Disciples</Text>
            <Text style={styles.summaryValue}>{disciples}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Invites</Text>
            <Text style={styles.summaryValue}>{invites}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>New Invites</Text>
            <Text style={styles.summaryValue}>{newInvites}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colName}>Name</Text>
          <Text style={styles.colTier}>Tier</Text>
          <Text style={styles.colLeader}>Cell Leader</Text>
          <Text style={styles.colStreak}>Streak</Text>
          <Text style={styles.colMethod}>Method</Text>
        </View>

        {rows.map((r, idx) => {
          const visual = getHierarchyStyle(r.tier, r.currentLeaderId);
          return (
            <View
              key={`${r.fullName}-${idx}`}
              style={[
                styles.row,
                { backgroundColor: visual.bgHex, color: visual.textHex },
              ]}
            >
              <Text style={styles.colName}>{r.fullName}</Text>
              <Text style={styles.colTier}>{visual.label}</Text>
              <Text style={styles.colLeader}>{r.leaderName}</Text>
              <Text style={styles.colStreak}>{r.streak}w</Text>
              <Text style={styles.colMethod}>{r.method.replace("_", " ")}</Text>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export function AttendanceReportPdfButton({
  serviceDate,
  rows,
}: {
  serviceDate: string;
  rows: AttendanceReportRow[];
}) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      const blob = await pdf(
        <AttendancePdfDocument serviceDate={serviceDate} rows={rows} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SYCC-Attendance-${serviceDate}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Attendance PDF generated locally.");
    } catch {
      toast.error("Failed to generate PDF report.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={generating || rows.length === 0}
      onClick={handleDownload}
    >
      <FileDown className="h-4 w-4" />
      {generating ? "Generating PDF..." : "Export Attendance PDF"}
    </Button>
  );
}

import type { DiscipleshipTier } from "@/types/database.types";

export interface HierarchyVisualStyle {
  /** Exact light-mode background hex */
  bgHex: string;
  /** Exact light-mode foreground hex */
  textHex: string;
  /** Tailwind row classes strictly enforcing Soft Pastel Light Mode Hierarchy Palette */
  rowClass: string;
  /** Tailwind badge classes */
  badgeClass: string;
  /** Canonical display title (never uses "Sub-Leader") */
  label: string;
  /** Border accent for tree nodes and cards */
  borderClass: string;
}

/**
 * Mandatory Soft Pastel Light Mode Hierarchy Palette:
 * - Top-Level Cell Leader (tier = 'cell_leader', current_leader_id IS NULL):
 *     Soft Sky Blue #DBEAFE bg, Bold Deep Navy #1E3A8A text -> "Cell Leader"
 * - Emerging Cell Leader (tier = 'cell_leader', current_leader_id IS NOT NULL):
 *     Light Mint Green #DCFCE7 bg, Bold Forest Green #14532D text -> "Cell Leader"
 * - Consistent Disciple (tier = 'disciple'):
 *     Soft Slate #F1F5F9 bg, Regular Dark Slate #334155 text -> "Disciple"
 * - Regular Invite (tier = 'invite'):
 *     Pure White #FFFFFF bg, Regular Charcoal #374151 text -> "Invite"
 * - New Invite (tier = 'new_invite'):
 *     Light Butter Yellow #FEF9C3 bg, Italic Warm Amber #854D0E text -> "New Invite"
 */
export function getHierarchyStyle(
  tier: DiscipleshipTier,
  currentLeaderId: string | null | undefined
): HierarchyVisualStyle {
  if (tier === "cell_leader" && !currentLeaderId) {
    return {
      bgHex: "#DBEAFE",
      textHex: "#1E3A8A",
      rowClass: "bg-[#DBEAFE] text-[#1E3A8A] font-bold hover:bg-[#BFDBFE]/80",
      badgeClass:
        "bg-[#DBEAFE] text-[#1E3A8A] border border-[#93C5FD] font-bold",
      borderClass: "border-[#93C5FD]",
      label: "Cell Leader",
    };
  }

  if (tier === "cell_leader" && Boolean(currentLeaderId)) {
    return {
      bgHex: "#DCFCE7",
      textHex: "#14532D",
      rowClass: "bg-[#DCFCE7] text-[#14532D] font-bold hover:bg-[#BBF7D0]/80",
      badgeClass:
        "bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC] font-bold",
      borderClass: "border-[#86EFAC]",
      label: "Cell Leader",
    };
  }

  if (tier === "disciple") {
    return {
      bgHex: "#F1F5F9",
      textHex: "#334155",
      rowClass: "bg-[#F1F5F9] text-[#334155] font-normal hover:bg-[#E2E8F0]/70",
      badgeClass:
        "bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] font-medium",
      borderClass: "border-[#CBD5E1]",
      label: "Disciple",
    };
  }

  if (tier === "invite") {
    return {
      bgHex: "#FFFFFF",
      textHex: "#374151",
      rowClass: "bg-[#FFFFFF] text-[#374151] font-normal hover:bg-slate-50",
      badgeClass:
        "bg-[#FFFFFF] text-[#374151] border border-slate-300 font-medium",
      borderClass: "border-slate-300",
      label: "Invite",
    };
  }

  if (tier === "new_invite") {
    return {
      bgHex: "#FEF9C3",
      textHex: "#854D0E",
      rowClass: "bg-[#FEF9C3] text-[#854D0E] italic hover:bg-[#FEF08A]/70",
      badgeClass:
        "bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047] italic font-medium",
      borderClass: "border-[#FDE047]",
      label: "New Invite",
    };
  }

  return {
    bgHex: "#F8FAFC",
    textHex: "#475569",
    rowClass: "bg-[#F8FAFC] text-[#475569] font-normal hover:bg-slate-100",
    badgeClass:
      "bg-[#F8FAFC] text-[#475569] border border-slate-200 font-medium",
    borderClass: "border-slate-200",
    label: "Alumni",
  };
}

export const HIERARCHY_LEGEND: Array<{
  key: string;
  tier: DiscipleshipTier;
  currentLeaderId: string | null;
  caption: string;
}> = [
  {
    key: "top_leader",
    tier: "cell_leader",
    currentLeaderId: null,
    caption: "Cell Leader (Primary)",
  },
  {
    key: "emerging_leader",
    tier: "cell_leader",
    currentLeaderId: "mentor",
    caption: "Cell Leader (Emerging)",
  },
  {
    key: "disciple",
    tier: "disciple",
    currentLeaderId: "mentor",
    caption: "Disciple (8+ Consecutive Wks)",
  },
  {
    key: "invite",
    tier: "invite",
    currentLeaderId: "mentor",
    caption: "Invite (4+ Consecutive Wks)",
  },
  {
    key: "new_invite",
    tier: "new_invite",
    currentLeaderId: "mentor",
    caption: "New Invite (< 4 Wks)",
  },
];

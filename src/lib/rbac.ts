import type { AppRole } from "@/types/database.types";

export type NavIconName =
  | "home"
  | "qr"
  | "tree"
  | "koinonia"
  | "profile"
  | "cell"
  | "registrar"
  | "treasurer"
  | "pastor"
  | "admin";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIconName;
  /** Highlighted floating center QR Pass button on MobileBottomNav */
  isCenterFab?: boolean;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  member: "Youth Member",
  cell_leader: "Cell Leader",
  registrar: "Registrar",
  treasurer: "Treasurer",
  pastor: "Youth Pastor",
  system_admin: "System Admin",
};

export const ROLE_DEFAULT_HOME: Record<AppRole, string> = {
  member: "/",
  cell_leader: "/",
  registrar: "/registrar",
  treasurer: "/treasurer",
  pastor: "/pastor",
  system_admin: "/admin",
};

/**
 * Roles designed primarily around the Mobile-First Bottom Navigation shell (< 768px).
 */
export function usesMobileBottomNav(role: AppRole): boolean {
  return role === "member" || role === "cell_leader";
}

/**
 * Strict UI Navigation Isolation:
 * Every role receives ONLY the links and icons it is authorized to access.
 */
export const ROLE_NAV_ITEMS: Record<AppRole, NavItem[]> = {
  member: [
    { href: "/", label: "Home", shortLabel: "Home", icon: "home" },
    { href: "/tree", label: "My Tree", shortLabel: "My Tree", icon: "tree" },
    {
      href: "/qr-pass",
      label: "My QR Pass",
      shortLabel: "QR Pass",
      icon: "qr",
      isCenterFab: true,
    },
    {
      href: "/koinonia",
      label: "Prayer & Events",
      shortLabel: "Koinonia",
      icon: "koinonia",
    },
    { href: "/profile", label: "Profile", shortLabel: "Profile", icon: "profile" },
  ],
  cell_leader: [
    { href: "/", label: "Home", shortLabel: "Home", icon: "home" },
    { href: "/cell-care", label: "My Cell", shortLabel: "My Cell", icon: "cell" },
    {
      href: "/qr-pass",
      label: "My QR Pass",
      shortLabel: "QR Pass",
      icon: "qr",
      isCenterFab: true,
    },
    { href: "/tree", label: "My Tree", shortLabel: "Tree", icon: "tree" },
    {
      href: "/koinonia",
      label: "Prayer & Events",
      shortLabel: "Koinonia",
      icon: "koinonia",
    },
    { href: "/profile", label: "Profile", shortLabel: "Profile", icon: "profile" },
  ],
  registrar: [
    {
      href: "/registrar",
      label: "Saturday Check-In",
      shortLabel: "Check-In",
      icon: "registrar",
    },
    { href: "/qr-pass", label: "My QR Pass", shortLabel: "QR Pass", icon: "qr" },
    {
      href: "/koinonia",
      label: "Prayer & Events",
      shortLabel: "Koinonia",
      icon: "koinonia",
    },
    { href: "/profile", label: "Profile", shortLabel: "Profile", icon: "profile" },
  ],
  treasurer: [
    {
      href: "/treasurer",
      label: "Treasury & Liquidation",
      shortLabel: "Treasury",
      icon: "treasurer",
    },
    { href: "/qr-pass", label: "My QR Pass", shortLabel: "QR Pass", icon: "qr" },
    {
      href: "/koinonia",
      label: "Prayer & Events",
      shortLabel: "Koinonia",
      icon: "koinonia",
    },
    { href: "/profile", label: "Profile", shortLabel: "Profile", icon: "profile" },
  ],
  pastor: [
    {
      href: "/pastor",
      label: "Ministry Overview",
      shortLabel: "Overview",
      icon: "pastor",
    },
    {
      href: "/tree",
      label: "Discipleship Tree",
      shortLabel: "Tree",
      icon: "tree",
    },
    {
      href: "/koinonia",
      label: "Prayer & Events",
      shortLabel: "Events",
      icon: "koinonia",
    },
    { href: "/profile", label: "Profile", shortLabel: "Profile", icon: "profile" },
  ],
  system_admin: [
    {
      href: "/admin",
      label: "Admin & Theme Studio",
      shortLabel: "Admin",
      icon: "admin",
    },
    { href: "/", label: "Home", shortLabel: "Home", icon: "home" },
    {
      href: "/registrar",
      label: "Registrar Desk",
      shortLabel: "Registrar",
      icon: "registrar",
    },
    {
      href: "/treasurer",
      label: "Treasurer Desk",
      shortLabel: "Treasury",
      icon: "treasurer",
    },
    {
      href: "/cell-care",
      label: "Cell Care Vault",
      shortLabel: "My Cell",
      icon: "cell",
    },
    {
      href: "/pastor",
      label: "Pastor Overview",
      shortLabel: "Pastor",
      icon: "pastor",
    },
    {
      href: "/tree",
      label: "Discipleship Tree",
      shortLabel: "Tree",
      icon: "tree",
    },
    {
      href: "/koinonia",
      label: "Prayer & Events",
      shortLabel: "Koinonia",
      icon: "koinonia",
    },
    { href: "/qr-pass", label: "My QR Pass", shortLabel: "QR Pass", icon: "qr" },
    { href: "/profile", label: "Profile", shortLabel: "Profile", icon: "profile" },
  ],
};

/**
 * Route-level RBAC matrix enforced in both src/proxy.ts and Server Components / Actions.
 */
const ROUTE_ACCESS_RULES: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/admin", roles: ["system_admin"] },
  { prefix: "/registrar", roles: ["registrar", "system_admin"] },
  { prefix: "/treasurer", roles: ["treasurer", "system_admin"] },
  { prefix: "/cell-care", roles: ["cell_leader", "system_admin"] },
  { prefix: "/pastor", roles: ["pastor", "system_admin"] },
  {
    prefix: "/tree",
    roles: ["member", "cell_leader", "pastor", "system_admin"],
  },
  {
    prefix: "/qr-pass",
    roles: [
      "member",
      "cell_leader",
      "registrar",
      "treasurer",
      "pastor",
      "system_admin",
    ],
  },
  {
    prefix: "/koinonia",
    roles: [
      "member",
      "cell_leader",
      "registrar",
      "treasurer",
      "pastor",
      "system_admin",
    ],
  },
  {
    prefix: "/profile",
    roles: [
      "member",
      "cell_leader",
      "registrar",
      "treasurer",
      "pastor",
      "system_admin",
    ],
  },
];

export function canRoleAccessPath(role: AppRole, pathname: string): boolean {
  if (role === "system_admin") return true;
  if (pathname === "/") return true;

  for (const rule of ROUTE_ACCESS_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.roles.includes(role);
    }
  }
  return true;
}

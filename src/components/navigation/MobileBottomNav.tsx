"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { ROLE_LABELS, ROLE_NAV_ITEMS } from "@/lib/rbac";
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import { NavIcon } from "@/components/navigation/NavIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "@/types/database.types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function MobileBottomNav({ profile }: { profile: ProfileRow }) {
  const pathname = usePathname();
  const allItems = ROLE_NAV_ITEMS[profile.role];
  const hierarchy = getHierarchyStyle(profile.tier, profile.current_leader_id);

  // Keep bottom bar to 5 ergonomic thumb-friendly items (with center floating QR button)
  const bottomBarItems =
    profile.role === "cell_leader"
      ? allItems.filter((item) => item.href !== "/profile")
      : allItems.slice(0, 5);

  return (
    <>
      {/* Clean Mobile-First Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5 min-h-[44px]">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-black text-xs shadow-xs"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              SYCC
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">SYCC Youth</p>
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[10px]",
                  hierarchy.badgeClass
                )}
              >
                {hierarchy.label}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            {/* Desktop quick links for member/cell_leader on wider screens */}
            <nav className="hidden md:flex items-center gap-1 mr-2">
              {allItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4" />
                    {item.shortLabel}
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/profile"
              aria-label="My Profile"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
            >
              <Avatar className="h-9 w-9 border-2 border-white shadow-xs">
                {profile.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                )}
                <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
              </Avatar>
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                title={`Sign out (${ROLE_LABELS[profile.role]})`}
                aria-label="Sign out"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Fixed Mobile Bottom Navigation Bar (< 768px) with center floating QR Pass */}
      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden pb-safe"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1.5">
          {bottomBarItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            if (item.isCenterFab) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-6 pb-1"
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ring-4 ring-white transition-transform active:scale-95",
                      active && "scale-105"
                    )}
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    <NavIcon name={item.icon} className="h-6 w-6" />
                  </span>
                  <span className="mt-1 text-[10px] font-bold text-slate-800">
                    {item.shortLabel}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold transition-colors",
                  active
                    ? "text-[var(--color-primary)]"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <NavIcon
                  name={item.icon}
                  className={cn("h-5 w-5", active && "stroke-[2.5]")}
                />
                <span className="truncate max-w-[64px]">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { ROLE_LABELS, ROLE_NAV_ITEMS } from "@/lib/rbac";
import { getHierarchyStyle } from "@/lib/hierarchy-styles";
import { NavIcon } from "@/components/navigation/NavIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export function LaptopSidebar({ profile }: { profile: ProfileRow }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = ROLE_NAV_ITEMS[profile.role];
  const hierarchy = getHierarchyStyle(profile.tier, profile.current_leader_id);

  const navLinks = (
    <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
      {navItems.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
              active
                ? "text-white shadow-xs"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            )}
            style={
              active ? { backgroundColor: "var(--color-primary)" } : undefined
            }
          >
            <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile / Tablet Header (< 1024px) for Pastor, Admin, Registrar, Treasurer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2.5">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetHeader className="border-b border-slate-200 p-5 mb-0">
                <SheetTitle className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    SYCC
                  </span>
                  <span>{ROLE_LABELS[profile.role]}</span>
                </SheetTitle>
              </SheetHeader>
              {navLinks}
              <div className="border-t border-slate-200 p-4">
                <form action={signOutAction}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </form>
              </div>
            </SheetContent>
          </Sheet>

          <div>
            <p className="text-sm font-bold text-slate-900">SYCC Youth</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>

        <Avatar className="h-9 w-9">
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
          )}
          <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
        </Avatar>
      </header>

      {/* Fixed Laptop Left Sidebar (>= 1024px) */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-slate-200 bg-white sticky top-0 h-dvh">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black text-white shadow-xs"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            SYCC
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              SYCC Youth System
            </p>
            <p className="truncate text-xs font-medium text-slate-500">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        </div>

        {navLinks}

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
              )}
              <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">
                {profile.full_name}
              </p>
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[10px]",
                  hierarchy.badgeClass
                )}
              >
                {hierarchy.label}
              </span>
            </div>
          </div>

          <form action={signOutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full justify-start text-slate-700"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}

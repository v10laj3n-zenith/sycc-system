"use client";

import {
  BookHeart,
  ClipboardCheck,
  Coins,
  GitFork,
  HeartHandshake,
  Home,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Users,
} from "lucide-react";
import type { NavIconName } from "@/lib/rbac";

export function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: NavIconName;
  className?: string;
}) {
  switch (name) {
    case "home":
      return <Home className={className} />;
    case "qr":
      return <QrCode className={className} />;
    case "tree":
      return <GitFork className={className} />;
    case "koinonia":
      return <HeartHandshake className={className} />;
    case "profile":
      return <UserCircle2 className={className} />;
    case "cell":
      return <Users className={className} />;
    case "registrar":
      return <ClipboardCheck className={className} />;
    case "treasurer":
      return <Coins className={className} />;
    case "pastor":
      return <Sparkles className={className} />;
    case "admin":
      return <ShieldCheck className={className} />;
    default:
      return <BookHeart className={className} />;
  }
}

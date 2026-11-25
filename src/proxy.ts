import type { NextRequest } from "next/server";
import { updateSessionAndGuard } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Proxy convention (replaces deprecated middleware.ts).
 * Refreshes Supabase SSR session cookies and enforces optimistic RBAC route gating.
 */
export async function proxy(request: NextRequest) {
  return updateSessionAndGuard(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

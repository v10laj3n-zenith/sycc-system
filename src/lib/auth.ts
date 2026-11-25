import "server-only";
import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/server";
import { ROLE_DEFAULT_HOME } from "@/lib/rbac";
import type { AppRole, ProfileRow } from "@/types/database.types";

/**
 * Central Data Access Layer (DAL) for authenticated SYCC user profile.
 * Always called behind a <Suspense> boundary in Next.js 16 Cache Components.
 */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  if (!isServerSupabaseConfigured()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return profile ?? null;
}

/**
 * Requires an authenticated profile inside Server Components.
 * Redirects unauthenticated visitors to /login.
 */
export async function requireProfile(): Promise<ProfileRow> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

/**
 * Enforces role-based authorization inside Server Components.
 * system_admin automatically satisfies any role gate.
 */
export async function requirePageRole(
  allowedRoles: AppRole[]
): Promise<ProfileRow> {
  const profile = await requireProfile();
  if (
    profile.role !== "system_admin" &&
    !allowedRoles.includes(profile.role)
  ) {
    redirect(ROLE_DEFAULT_HOME[profile.role]);
  }
  return profile;
}

/**
 * Enforces role-based authorization inside Server Actions.
 * Returns null if unauthorized instead of throwing unhandled redirects.
 */
export async function verifyActionRole(
  allowedRoles: AppRole[]
): Promise<ProfileRow | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (
    profile.role !== "system_admin" &&
    !allowedRoles.includes(profile.role)
  ) {
    return null;
  }
  return profile;
}

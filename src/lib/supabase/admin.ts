import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Service Role Supabase Client.
 * STRICTLY SERVER-ONLY (admin overrides, push dispatch, receipt automation).
 * NEVER import into any Client Component.
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || serviceRoleKey.includes("<")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured in server environment."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

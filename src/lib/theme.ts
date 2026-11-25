import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { AppThemeSettingsRow, Database } from "@/types/database.types";

export const DEFAULT_SEASONAL_THEME: AppThemeSettingsRow = {
  id: "default-theme",
  season_title: "Rooted & Multiplying",
  anchor_verse:
    "Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.",
  verse_reference: "Matthew 28:19",
  primary_color: "#1E3A8A",
  accent_color: "#059669",
  banner_gradient: "linear-gradient(135deg, #DBEAFE 0%, #DCFCE7 100%)",
  is_active: true,
  updated_by: null,
  updated_at: "2026-01-01T00:00:00.000Z",
};

/**
 * Reads active theme from app_theme_settings using Next.js 16 'use cache'.
 * Invalidated instantly via updateTag('theme') whenever Pastor or System Admin publishes a new theme.
 */
export async function getActiveTheme(): Promise<AppThemeSettingsRow> {
  "use cache";
  cacheTag("theme");
  cacheLife("hours");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (
    !url.startsWith("https://") ||
    url.includes("<") ||
    anonKey.length < 20 ||
    anonKey.includes("<")
  ) {
    return DEFAULT_SEASONAL_THEME;
  }

  try {
    const supabase = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("app_theme_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_SEASONAL_THEME;
    }

    return data;
  } catch {
    return DEFAULT_SEASONAL_THEME;
  }
}

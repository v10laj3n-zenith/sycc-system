"use client";

import * as React from "react";
import type { AppThemeSettingsRow } from "@/types/database.types";

const ThemeContext = React.createContext<AppThemeSettingsRow | null>(null);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: AppThemeSettingsRow;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", theme.primary_color);
    root.style.setProperty("--color-accent", theme.accent_color);
    root.style.setProperty("--banner-gradient", theme.banner_gradient);
  }, [theme.primary_color, theme.accent_color, theme.banner_gradient]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useSeasonalTheme(): AppThemeSettingsRow {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useSeasonalTheme must be used within ThemeProvider");
  }
  return ctx;
}

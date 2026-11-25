"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { updateSeasonalThemeAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppThemeSettingsRow } from "@/types/database.types";

const PRESETS = [
  {
    name: "Rooted & Multiplying",
    primary: "#1E3A8A",
    accent: "#059669",
    gradient: "linear-gradient(135deg, #DBEAFE 0%, #DCFCE7 100%)",
  },
  {
    name: "Ablaze Summer Camp",
    primary: "#9A3412",
    accent: "#D97706",
    gradient: "linear-gradient(135deg, #FEF9C3 0%, #FFEDD5 100%)",
  },
  {
    name: "Harvest & Missions",
    primary: "#14532D",
    accent: "#0D9488",
    gradient: "linear-gradient(135deg, #DCFCE7 0%, #CCFBF1 100%)",
  },
  {
    name: "Emmanuel Christmas",
    primary: "#4C1D95",
    accent: "#2563EB",
    gradient: "linear-gradient(135deg, #EDE9FE 0%, #DBEAFE 100%)",
  },
];

export function SeasonalThemeStudio({
  currentTheme,
}: {
  currentTheme: AppThemeSettingsRow;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [seasonTitle, setSeasonTitle] = useState(currentTheme.season_title);
  const [anchorVerse, setAnchorVerse] = useState(currentTheme.anchor_verse);
  const [verseRef, setVerseRef] = useState(currentTheme.verse_reference);
  const [primaryColor, setPrimaryColor] = useState(currentTheme.primary_color);
  const [accentColor, setAccentColor] = useState(currentTheme.accent_color);
  const [bannerGradient, setBannerGradient] = useState(
    currentTheme.banner_gradient
  );

  function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSeasonalThemeAction({
        season_title: seasonTitle,
        anchor_verse: anchorVerse,
        verse_reference: verseRef,
        primary_color: primaryColor,
        accent_color: accentColor,
        banner_gradient: bannerGradient,
      });

      if (!res.success) {
        toast.error(res.error ?? "Could not publish theme.");
        return;
      }

      toast.success(
        `Seasonal theme "${seasonTitle}" published live across all devices!`
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-[var(--color-primary)]" />
          Dynamic Seasonal Theme Studio
        </CardTitle>
        <CardDescription>
          Switch quarterly youth themes, anchor verses, and root CSS variables
          instantly with zero code redeployment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Live Preview Banner */}
        <div
          className="rounded-3xl border border-slate-200 p-5 shadow-xs"
          style={{ background: bannerGradient }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold"
            style={{ color: primaryColor }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Live Theme Preview
          </span>
          <h3 className="mt-2.5 text-2xl font-extrabold text-slate-900">
            {seasonTitle || "Season Title"}
          </h3>
          <p className="mt-1 text-sm italic text-slate-700">
            &ldquo;{anchorVerse || "Anchor Scripture"}&rdquo;{" "}
            {verseRef && (
              <span className="not-italic font-semibold">— {verseRef}</span>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <span
              className="inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Primary Button
            </span>
            <span
              className="inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              Accent Button
            </span>
          </div>
        </div>

        {/* Quick Pastel Presets */}
        <div className="space-y-1.5">
          <Label>Quick Light-Mode Pastel Presets</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.name}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPrimaryColor(preset.primary);
                  setAccentColor(preset.accent);
                  setBannerGradient(preset.gradient);
                }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300"
                  style={{ background: preset.gradient }}
                />
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        <form onSubmit={handlePublish} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="theme-title">Season Title</Label>
              <Input
                id="theme-title"
                required
                value={seasonTitle}
                onChange={(e) => setSeasonTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theme-ref">Scripture Reference</Label>
              <Input
                id="theme-ref"
                placeholder="e.g., Matthew 28:19"
                value={verseRef}
                onChange={(e) => setVerseRef(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="theme-verse">Anchor Verse</Label>
            <Textarea
              id="theme-verse"
              required
              value={anchorVerse}
              onChange={(e) => setAnchorVerse(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="theme-primary">Primary Hex (--color-primary)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-11 w-12 cursor-pointer rounded-xl border border-slate-300 p-1"
                />
                <Input
                  id="theme-primary"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theme-accent">Accent Hex (--color-accent)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-11 w-12 cursor-pointer rounded-xl border border-slate-300 p-1"
                />
                <Input
                  id="theme-accent"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theme-grad">Banner CSS Gradient</Label>
              <Input
                id="theme-grad"
                required
                value={bannerGradient}
                onChange={(e) => setBannerGradient(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" size="lg" disabled={isPending}>
            <Sparkles className="h-4 w-4" />
            {isPending ? "Publishing Theme..." : "Publish Seasonal Theme Live"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

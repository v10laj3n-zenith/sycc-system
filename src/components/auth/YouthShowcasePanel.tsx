"use client";

import {
  Flame,
  GitFork,
  HeartHandshake,
  Laptop,
  QrCode,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import type { AppThemeSettingsRow } from "@/types/database.types";

/**
 * Laptop / Desktop Left Showcase Canvas (>= 1024px)
 * Expressive, youth-friendly light-mode editorial hero driven by the Seasonal Theme Studio.
 */
export function LaptopYouthShowcase({
  theme,
}: {
  theme: AppThemeSettingsRow;
}) {
  return (
    <section
      aria-label="SYCC Youth Ministry Overview"
      className="relative hidden lg:flex lg:col-span-7 flex-col justify-between overflow-hidden p-10 xl:p-14 border-r border-slate-200/80"
      style={{ background: theme.banner_gradient }}
    >
      {/* Layered soft ambient orbs + crisp editorial dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-youth-dots opacity-55"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/50 blur-3xl animate-float-slow"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-16 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30 animate-float-delayed"
        style={{ backgroundColor: "var(--color-accent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 right-12 h-56 w-56 rounded-full bg-[#FEF9C3]/70 blur-3xl animate-float-slow"
      />

      {/* Top Brand Bar */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white font-black text-sm shadow-md ring-4 ring-white/60"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            SYCC
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
              SYCC Youth
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Growth &amp; Discipleship Web App
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Saturday Youth Fellowship
        </div>
      </div>

      {/* Main Youth Story Hero + Live Feature Bento */}
      <div className="relative z-10 my-auto py-8 space-y-7 max-w-2xl">
        <div className="space-y-4">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider shadow-xs backdrop-blur-md"
            style={{ color: "var(--color-primary)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Season: {theme.season_title}</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-slate-900 leading-[1.08]">
            Grow in Faith.{" "}
            <span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, var(--color-primary), var(--color-accent))",
              }}
            >
              Walk Together.
            </span>
            <br />
            Disciple the Next.
          </h1>

          {/* Anchor Scripture Glass Card */}
          <blockquote className="rounded-3xl border border-white/90 bg-white/75 p-5 shadow-xs backdrop-blur-md">
            <p className="text-sm xl:text-[15px] leading-relaxed text-slate-800 italic">
              &ldquo;{theme.anchor_verse}&rdquo;
            </p>
            {theme.verse_reference && (
              <footer
                className="mt-2 text-xs font-extrabold uppercase tracking-wider"
                style={{ color: "var(--color-primary)" }}
              >
                — {theme.verse_reference}
              </footer>
            )}
          </blockquote>
        </div>

        {/* Youth Feature Bento Preview (Soft Pastel Light Mode Hierarchy Palette) */}
        <div className="grid grid-cols-3 gap-3.5">
          {/* Card 1: Offline QR Pass */}
          <div className="group rounded-3xl border border-white/90 bg-white/85 p-4 shadow-xs backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#1E3A8A]">
              <QrCode className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-slate-900">
              Instant QR Pass
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-600">
              Scan in seconds at the Saturday door — even with zero signal.
            </p>
          </div>

          {/* Card 2: Streak Milestones */}
          <div className="group rounded-3xl border border-white/90 bg-white/85 p-4 shadow-xs backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FEF9C3] text-[#854D0E]">
              <Flame className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-slate-900">
              Saturday Streaks
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-600">
              Celebrate 4-week Invite &amp; 8-week Disciple milestones together.
            </p>
            <div className="mt-2.5 flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
                <span
                  key={w}
                  className="h-1.5 flex-1 rounded-full"
                  style={{
                    backgroundColor:
                      w <= 5 ? "var(--color-accent)" : "rgba(148,163,184,0.35)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Card 3: Discipleship Family & Koinonia */}
          <div className="group rounded-3xl border border-white/90 bg-white/85 p-4 shadow-xs backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#14532D]">
              <GitFork className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-slate-900">
              Family Tree &amp; Care
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-600">
              See your spiritual lineage, join cell meetups &amp; lift prayers.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Adaptive Web App Footer */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-900/10 text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-[#1E3A8A]" />
            Members &amp; Cell Leaders
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HeartHandshake className="h-4 w-4 text-[#14532D]" />
            Koinonia Wall
          </span>
        </div>
        <div className="inline-flex items-center gap-3 text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Smartphone className="h-3.5 w-3.5" />
            Mobile PWA
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Laptop className="h-3.5 w-3.5" />
            Laptop Desk
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Mobile & Tablet Compact Youth Hero Header (< 1024px)
 * Designed to pair seamlessly with the elevated rounded auth sheet rising below it.
 */
export function MobileYouthHero({ theme }: { theme: AppThemeSettingsRow }) {
  return (
    <section
      aria-label="SYCC Youth Welcome"
      className="relative lg:hidden overflow-hidden px-5 pt-7 pb-14 md:pt-10 md:pb-16"
      style={{ background: theme.banner_gradient }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-youth-dots opacity-45"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/55 blur-2xl animate-float-slow"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#FEF9C3]/70 blur-2xl animate-float-delayed"
      />

      <div className="relative z-10 mx-auto max-w-lg space-y-4">
        {/* Top Row: Brand & Live Pill */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-black text-xs shadow-sm ring-2 ring-white/70"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              SYCC
            </div>
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-slate-900">
                SYCC Youth
              </p>
              <p className="text-[11px] font-medium text-slate-600">
                Discipleship Web App
              </p>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/85 px-3 py-1 text-[11px] font-bold shadow-2xs backdrop-blur-md"
            style={{ color: "var(--color-primary)" }}
          >
            <Sparkles className="h-3 w-3" />
            {theme.season_title}
          </span>
        </div>

        {/* Youth Headline & Anchor Verse */}
        <div className="space-y-2 pt-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
            Grow Together.{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, var(--color-primary), var(--color-accent))",
              }}
            >
              Disciple Others.
            </span>
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-700 italic line-clamp-3">
            &ldquo;{theme.anchor_verse}&rdquo;{" "}
            {theme.verse_reference && (
              <span className="not-italic font-bold text-slate-900">
                — {theme.verse_reference}
              </span>
            )}
          </p>
        </div>

        {/* Compact Youth Feature Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 border border-white px-3 py-1 text-[11px] font-bold text-[#1E3A8A] shadow-2xs">
            <QrCode className="h-3.5 w-3.5" />
            Offline QR Pass
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 border border-white px-3 py-1 text-[11px] font-bold text-[#854D0E] shadow-2xs">
            <Flame className="h-3.5 w-3.5" />
            Saturday Streaks
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 border border-white px-3 py-1 text-[11px] font-bold text-[#14532D] shadow-2xs">
            <GitFork className="h-3.5 w-3.5" />
            Family Tree &amp; Prayer
          </span>
        </div>
      </div>
    </section>
  );
}

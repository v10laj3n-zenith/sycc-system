"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  QrCode,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { signInAction, signUpAction } from "@/actions/auth";
import { useSeasonalTheme } from "@/components/providers/ThemeProvider";
import {
  LaptopYouthShowcase,
  MobileYouthHero,
} from "@/components/auth/YouthShowcasePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function resolveSafeRedirect(fallbackPath: string): string {
  if (typeof window === "undefined") return fallbackPath;
  const nextParam = new URLSearchParams(window.location.search).get("next");
  if (
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    nextParam !== "/login"
  ) {
    return nextParam;
  }
  return fallbackPath;
}

export function LoginForm({ isSupabaseReady }: { isSupabaseReady: boolean }) {
  const router = useRouter();
  const theme = useSeasonalTheme();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await signInAction({ email, password });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Sign in failed.");
        return;
      }
      toast.success("Welcome back to SYCC Youth!");
      router.replace(resolveSafeRedirect(res.data.redirectTo));
      router.refresh();
    });
  }

  function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await signUpAction({ fullName, email, password });
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Sign up failed.");
        return;
      }
      if (res.data.needsEmailConfirmation) {
        toast.success(
          "Account created! Check your inbox to verify, then sign in."
        );
        setActiveTab("signin");
      } else {
        toast.success("Welcome to the SYCC Youth family!");
        router.replace(res.data.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-dvh flex flex-col lg:grid lg:grid-cols-12 bg-[#F8FAFC]">
      {/* LAPTOP / DESKTOP LEFT PANEL (>= 1024px) */}
      <LaptopYouthShowcase theme={theme} />

      {/* MOBILE / TABLET HERO HEADER (< 1024px) */}
      <MobileYouthHero theme={theme} />

      {/* ADAPTIVE AUTH PANEL:
          - Mobile (< 768px): Elevated rounded bottom-sheet rising smoothly over the hero
          - Tablet (768px-1023px): Centered floating card over the hero edge
          - Laptop (>= 1024px): Clean full-height right split-screen workspace */}
      <main className="relative z-20 flex-1 flex flex-col justify-between lg:col-span-5 -mt-7 lg:mt-0 rounded-t-[2rem] md:rounded-3xl lg:rounded-none bg-white md:mx-auto md:w-full md:max-w-lg md:mb-10 md:shadow-xl md:border md:border-slate-200/80 lg:mx-0 lg:max-w-none lg:mb-0 lg:shadow-none lg:border-0 px-5 pt-7 pb-8 sm:px-8 lg:px-10 xl:px-14 lg:py-10 pb-safe">
        {/* Subtle drag-handle indicator on mobile sheet */}
        <div
          aria-hidden="true"
          className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200 md:hidden"
        />

        <div className="my-auto mx-auto w-full max-w-md space-y-6">
          {/* Context Heading */}
          <div className="space-y-1.5">
            <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              SYCC Youth Portal
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {activeTab === "signin"
                ? "Welcome back, fam!"
                : "Join the SYCC Family"}
            </h2>
            <p className="text-sm text-slate-500">
              {activeTab === "signin"
                ? "Sign in to access your QR pass, streaks, cell group, or ministry workspace."
                : "Create your youth profile in seconds and start tracking your discipleship journey."}
            </p>
          </div>

          {/* Pending Supabase Configuration Alert */}
          {!isSupabaseReady && (
            <div className="rounded-2xl border border-amber-300 bg-[#FEF9C3] p-4 text-xs text-[#854D0E] flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Supabase Connection Pending</p>
                <p className="mt-0.5 leading-relaxed">
                  Paste your keys into root <code>.env.local</code> and run the
                  SQL migrations in <code>supabase/migrations/</code> to enable
                  live sign-in.
                </p>
              </div>
            </div>
          )}

          {/* Segmented Auth Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "signin" | "signup")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-100 p-1.5 min-h-[50px]">
              <TabsTrigger
                value="signin"
                className="rounded-xl text-sm font-bold min-h-[40px]"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-xl text-sm font-bold min-h-[40px]"
              >
                Create Account
              </TabsTrigger>
            </TabsList>

            {/* SIGN IN FORM */}
            <TabsContent value="signin" className="mt-5">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="signin-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="min-h-[48px] pl-10 rounded-2xl bg-slate-50/70 focus-visible:bg-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="min-h-[48px] pl-10 pr-12 rounded-2xl bg-slate-50/70 focus-visible:bg-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full min-h-[50px] rounded-2xl text-base font-bold shadow-md"
                  size="lg"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing you in...
                    </>
                  ) : (
                    <>
                      Enter Youth Portal
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* SIGN UP / CLAIM WALK-IN FORM */}
            <TabsContent value="signup" className="mt-5 space-y-4">
              {/* Walk-in Auto-Claim Friendly Callout */}
              <div className="rounded-2xl border border-[#86EFAC] bg-[#DCFCE7]/70 p-3.5 text-xs text-[#14532D] flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Checked in as a Saturday walk-in before?</strong> Sign
                  up with the same email you gave at registration to
                  automatically keep your streak!
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Juan Dela Cruz"
                      className="min-h-[48px] pl-10 rounded-2xl bg-slate-50/70 focus-visible:bg-white"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="min-h-[48px] pl-10 rounded-2xl bg-slate-50/70 focus-visible:bg-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Create Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Minimum 6 characters"
                      className="min-h-[48px] pl-10 pr-12 rounded-2xl bg-slate-50/70 focus-visible:bg-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="accent"
                  className="w-full min-h-[50px] rounded-2xl text-base font-bold shadow-md"
                  size="lg"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating your profile...
                    </>
                  ) : (
                    <>
                      Join SYCC Youth
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Offline QR Quick Access & Adaptive Web App Hint */}
          <div className="pt-2 space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-slate-200" />
              <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                At Saturday Check-In?
              </span>
              <div className="w-full border-t border-slate-200" />
            </div>

            <Button
              asChild
              variant="outline"
              className="w-full min-h-[46px] rounded-2xl border-slate-200 bg-slate-50/70 hover:bg-[#DBEAFE]/50 hover:border-[#93C5FD] text-slate-700"
            >
              <Link href="/qr-pass">
                <QrCode className="h-4 w-4 text-[#1E3A8A]" />
                Open Cached Offline QR Pass
              </Link>
            </Button>
          </div>
        </div>

        {/* Footer Note */}
        <footer className="mt-8 pt-4 text-center text-[11px] text-slate-400">
          <p>
            Automatically adapts to your role — Member, Cell Leader, Registrar,
            Treasurer, or Pastor.
          </p>
        </footer>
      </main>
    </div>
  );
}

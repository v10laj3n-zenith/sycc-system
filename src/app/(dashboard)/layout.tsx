import { Suspense } from "react";
import { getCurrentProfile } from "@/lib/auth";
import { usesMobileBottomNav } from "@/lib/rbac";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { LaptopSidebar } from "@/components/navigation/LaptopSidebar";
import { Skeleton } from "@/components/ui/skeleton";

function ShellFallback() {
  return (
    <div className="min-h-dvh bg-[#F8FAFC] p-4 sm:p-6 space-y-4">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  );
}

async function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Allows offline cached /qr-pass page to render gracefully when network/session cannot be checked
  if (!profile) {
    return (
      <div className="min-h-dvh bg-[#F8FAFC]">
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </div>
    );
  }

  if (usesMobileBottomNav(profile.role)) {
    return (
      <div className="min-h-dvh flex flex-col bg-[#F8FAFC]">
        <MobileBottomNav profile={profile} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28 md:pb-10">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-[#F8FAFC]">
      <LaptopSidebar profile={profile} />
      <main className="flex-1 min-w-0 px-4 py-5 lg:px-8 lg:py-6">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

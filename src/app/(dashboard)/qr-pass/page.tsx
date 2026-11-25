import { Suspense } from "react";
import { getCurrentProfile } from "@/lib/auth";
import { OfflineQrPass } from "@/components/qr/OfflineQrPass";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "My Weekly QR Pass",
};

async function QrPassContent() {
  const profile = await getCurrentProfile();

  return (
    <OfflineQrPass
      serverProfile={
        profile
          ? {
              id: profile.id,
              full_name: profile.full_name,
              nickname: profile.nickname,
              tier: profile.tier,
              current_leader_id: profile.current_leader_id,
              consecutive_saturday_streak: profile.consecutive_saturday_streak,
            }
          : null
      }
    />
  );
}

export default function QrPassPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <Skeleton className="h-[460px] w-full rounded-3xl" />
        </div>
      }
    >
      <QrPassContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "My Profile",
};

async function ProfileContent() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const { data: giving } = await supabase
    .from("tithes_and_offerings")
    .select("*")
    .eq("giver_id", profile.id)
    .order("service_date", { ascending: false })
    .limit(50);

  return <ProfileClient profile={profile} givingHistory={giving ?? []} />;
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

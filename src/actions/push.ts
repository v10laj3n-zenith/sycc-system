"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
  userAgent: z.string().max(300).optional(),
});

export async function savePushSubscriptionAction(
  input: z.infer<typeof subscriptionSchema>
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Please sign in to enable notifications.");

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid browser push subscription.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        profile_id: profile.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: parsed.data.userAgent ?? null,
      },
      { onConflict: "endpoint" }
    );

    if (error) return fail(error.message);
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to save push subscription."
    );
  }
}

export async function removePushSubscriptionAction(
  endpoint: string
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("profile_id", profile.id)
      .eq("endpoint", endpoint);

    if (error) return fail(error.message);
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to remove push subscription."
    );
  }
}

export async function sendTestPushAction(): Promise<ActionResult<{ delivered: number }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  const result = await sendPushToProfiles([profile.id], {
    title: "SYCC Youth Alerts Active",
    body: `Hi ${profile.nickname || profile.full_name}! Lock-screen updates for Saturday check-ins, cell meetups, and receipts are ready.`,
    url: "/profile",
  });

  if (result.delivered === 0) {
    return fail(
      "Notification could not be delivered. Verify VAPID keys in .env.local and device permission."
    );
  }
  return ok({ delivered: result.delivered });
}

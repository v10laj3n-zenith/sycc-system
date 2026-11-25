"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyActionRole } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const createEventSchema = z.object({
  title: z.string().trim().min(2, "Event title is required."),
  description: z.string().trim().max(800).optional().nullable(),
  event_date: z.string().min(10, "Valid event date & time is required."),
  location: z.string().trim().min(2, "Location is required."),
  notifyAllYouth: z.boolean().default(false),
});

export async function createChurchEventAction(
  input: z.infer<typeof createEventSchema>
): Promise<ActionResult<{ notifiedCount: number }>> {
  const actor = await verifyActionRole(["pastor"]);
  if (!actor) return fail("Only Pastor or System Admin can create church events.");

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid event details.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("church_events").insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      event_date: new Date(parsed.data.event_date).toISOString(),
      location: parsed.data.location,
      banner_url: null,
      created_by: actor.id,
      is_published: true,
    });

    if (error) return fail(error.message);

    let notifiedCount = 0;
    if (parsed.data.notifyAllYouth) {
      const { data: activeProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_active", true);
      const ids = (activeProfiles ?? []).map((p) => p.id);
      const pushRes = await sendPushToProfiles(ids, {
        title: `New SYCC Event: ${parsed.data.title}`,
        body: `Join us at ${parsed.data.location}! Tap to RSVP.`,
        url: "/koinonia",
      });
      notifiedCount = pushRes.delivered;
    }

    revalidatePath("/pastor");
    revalidatePath("/koinonia");
    revalidatePath("/");
    return ok({ notifiedCount });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not create church event."
    );
  }
}

export async function deleteChurchEventAction(
  eventId: string
): Promise<ActionResult> {
  const actor = await verifyActionRole(["pastor"]);
  if (!actor) return fail("Unauthorized.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("church_events")
      .delete()
      .eq("id", eventId);
    if (error) return fail(error.message);

    revalidatePath("/pastor");
    revalidatePath("/koinonia");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not delete event."
    );
  }
}

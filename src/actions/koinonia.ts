"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const createPrayerSchema = z.object({
  content: z
    .string()
    .trim()
    .min(5, "Please share at least a short sentence for your prayer request.")
    .max(600, "Prayer request must be 600 characters or fewer."),
  is_anonymous: z.boolean().default(false),
});

const answeredSchema = z.object({
  prayerId: z.string().uuid(),
  testimony: z.string().trim().max(500).optional(),
});

const rsvpSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["going", "maybe", "not_going"]),
});

export async function createPrayerAction(
  input: z.infer<typeof createPrayerSchema>
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Please sign in to share a prayer request.");

  const parsed = createPrayerSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid prayer request.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("koinonia_prayers").insert({
      author_id: profile.id,
      content: parsed.data.content,
      is_anonymous: parsed.data.is_anonymous,
    });

    if (error) return fail(error.message);
    revalidatePath("/koinonia");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not post prayer request."
    );
  }
}

export async function togglePrayerAmenAction(
  prayerId: string
): Promise<ActionResult<{ prayed: boolean }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  try {
    const supabase = await createServerSupabaseClient();
    const { data: existing } = await supabase
      .from("prayer_amens")
      .select("prayer_id")
      .eq("prayer_id", prayerId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("prayer_amens")
        .delete()
        .eq("prayer_id", prayerId)
        .eq("profile_id", profile.id);
      if (error) return fail(error.message);
      revalidatePath("/koinonia");
      return ok({ prayed: false });
    }

    const { error } = await supabase.from("prayer_amens").insert({
      prayer_id: prayerId,
      profile_id: profile.id,
    });
    if (error) return fail(error.message);

    revalidatePath("/koinonia");
    return ok({ prayed: true });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not update prayer Amen."
    );
  }
}

export async function markPrayerAnsweredAction(
  input: z.infer<typeof answeredSchema>
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  const parsed = answeredSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid answered prayer input.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("koinonia_prayers")
      .update({
        is_answered: true,
        answered_testimony: parsed.data.testimony || "Praise God — prayer answered!",
      })
      .eq("id", parsed.data.prayerId);

    if (error) return fail(error.message);
    revalidatePath("/koinonia");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not update prayer status."
    );
  }
}

export async function rsvpChurchEventAction(
  input: z.infer<typeof rsvpSchema>
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid RSVP status.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("event_rsvps").upsert(
      {
        event_id: parsed.data.id,
        profile_id: profile.id,
        status: parsed.data.status,
      },
      { onConflict: "event_id,profile_id" }
    );

    if (error) return fail(error.message);
    revalidatePath("/koinonia");
    revalidatePath("/");
    return ok();
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save RSVP.");
  }
}

export async function rsvpCellMeetupAction(
  input: z.infer<typeof rsvpSchema>
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid cell meetup RSVP.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("cell_meetup_rsvps").upsert(
      {
        meetup_id: parsed.data.id,
        member_id: profile.id,
        status: parsed.data.status,
      },
      { onConflict: "meetup_id,member_id" }
    );

    if (error) return fail(error.message);
    revalidatePath("/");
    revalidatePath("/cell-care");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to update cell meetup RSVP."
    );
  }
}

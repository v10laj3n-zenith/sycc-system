"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyActionRole } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { DecryptedCareNote } from "@/types/database.types";

const careNoteSchema = z.object({
  memberId: z.string().uuid(),
  plaintext: z
    .string()
    .trim()
    .min(3, "Care note must be at least 3 characters.")
    .max(2000, "Care note is too long."),
  category: z.enum([
    "pastoral",
    "prayer",
    "family",
    "academic",
    "discipleship",
    "other",
  ]),
  followUpDate: z.string().optional().nullable(),
  noteId: z.string().uuid().optional().nullable(),
});

const ministryUpdateSchema = z.object({
  memberId: z.string().uuid(),
  ministry_team: z.string().trim().max(60).optional().nullable(),
  ministry_status: z.enum(["active", "resting", "inactive"]),
});

const createMeetupSchema = z.object({
  title: z.string().trim().min(2, "Meetup title is required."),
  topic: z.string().trim().max(120).optional().nullable(),
  location: z.string().trim().min(2, "Location is required."),
  scheduled_at: z.string().min(10, "Valid schedule date & time required."),
  notes: z.string().trim().max(500).optional().nullable(),
  notifyCell: z.boolean().default(true),
});

function getCareVaultKey(): string | null {
  const key = process.env.CARE_VAULT_ENCRYPTION_KEY;
  if (!key || key.includes("<") || key.length < 16) return null;
  return key;
}

export async function getMemberCareNotesAction(
  memberId: string,
  includeArchived = false
): Promise<ActionResult<DecryptedCareNote[]>> {
  const actor = await verifyActionRole(["cell_leader"]);
  if (!actor) return fail("Care Vault access is restricted to Cell Leaders.");

  const encKey = getCareVaultKey();
  if (!encKey) {
    return fail(
      "CARE_VAULT_ENCRYPTION_KEY is not configured in server .env.local."
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_member_care_notes", {
      p_member_id: memberId,
      p_encryption_key: encKey,
      p_include_archived: actor.role === "system_admin" ? includeArchived : false,
    });

    if (error) return fail(error.message);
    return ok((data ?? []) as DecryptedCareNote[]);
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Unable to decrypt care notes."
    );
  }
}

export async function upsertCareNoteAction(
  input: z.infer<typeof careNoteSchema>
): Promise<ActionResult<{ noteId: string }>> {
  const actor = await verifyActionRole(["cell_leader"]);
  if (!actor) return fail("Care Vault write denied.");

  const parsed = careNoteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid care note input.");
  }

  const encKey = getCareVaultKey();
  if (!encKey) {
    return fail(
      "CARE_VAULT_ENCRYPTION_KEY is not configured in server .env.local."
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("upsert_care_note", {
      p_member_id: parsed.data.memberId,
      p_plaintext: parsed.data.plaintext,
      p_category: parsed.data.category,
      p_follow_up_date: parsed.data.followUpDate || null,
      p_encryption_key: encKey,
      p_note_id: parsed.data.noteId ?? null,
    });

    if (error) return fail(error.message);
    revalidatePath("/cell-care");
    return ok({ noteId: String(data) });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not encrypt & save care note."
    );
  }
}

export async function updateMemberMinistryAction(
  input: z.infer<typeof ministryUpdateSchema>
): Promise<ActionResult> {
  const actor = await verifyActionRole(["cell_leader"]);
  if (!actor) return fail("Unauthorized.");

  const parsed = ministryUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid ministry status update.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        ministry_team: parsed.data.ministry_team || null,
        ministry_status: parsed.data.ministry_status,
      })
      .eq("id", parsed.data.memberId);

    if (error) return fail(error.message);
    revalidatePath("/cell-care");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not update ministry status."
    );
  }
}

export async function createCellMeetupAction(
  input: z.infer<typeof createMeetupSchema>
): Promise<ActionResult<{ notifiedCount: number }>> {
  const actor = await verifyActionRole(["cell_leader"]);
  if (!actor) return fail("Only Cell Leaders can schedule cell meetups.");

  const parsed = createMeetupSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid meetup details.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("cell_meetups").insert({
      leader_id: actor.id,
      title: parsed.data.title,
      topic: parsed.data.topic || null,
      location: parsed.data.location,
      scheduled_at: new Date(parsed.data.scheduled_at).toISOString(),
      notes: parsed.data.notes || null,
    });

    if (error) return fail(error.message);

    let notifiedCount = 0;
    if (parsed.data.notifyCell) {
      const { data: cellMembers } = await supabase
        .from("profiles")
        .select("id")
        .eq("current_leader_id", actor.id)
        .eq("is_active", true);

      const ids = (cellMembers ?? []).map((m) => m.id);
      if (ids.length > 0) {
        const pushRes = await sendPushToProfiles(ids, {
          title: `Cell Meetup: ${parsed.data.title}`,
          body: `${parsed.data.location} — Tap to RSVP!`,
          url: "/",
        });
        notifiedCount = pushRes.delivered;
      }
    }

    revalidatePath("/cell-care");
    revalidatePath("/");
    return ok({ notifiedCount });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not create cell meetup."
    );
  }
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyActionRole } from "@/lib/auth";
import { parseQrPayload } from "@/lib/format";
import { sendPushToProfiles } from "@/lib/push";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { DiscipleshipTier } from "@/types/database.types";

const checkInSchema = z.object({
  profileId: z.string().uuid(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(["qr_scan", "manual_search", "walk_in"]),
  notes: z.string().trim().max(250).optional().nullable(),
});

const walkInSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required."),
  nickname: z.string().trim().max(40).optional().nullable(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email or leave blank.")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(25).optional().nullable(),
  invited_by_id: z.string().uuid().optional().nullable(),
  current_leader_id: z.string().uuid().optional().nullable(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export interface CheckInFeedback {
  profileId: string;
  fullName: string;
  previousTier: DiscipleshipTier;
  newTier: DiscipleshipTier;
  streak: number;
  alreadyCheckedIn: boolean;
  upgraded: boolean;
}

export async function checkInMemberAction(
  input: z.infer<typeof checkInSchema>
): Promise<ActionResult<CheckInFeedback>> {
  const actor = await verifyActionRole(["registrar"]);
  if (!actor) return fail("Only Registrars or System Admin can check members in.");

  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid check-in request.");
  }

  try {
    const supabase = await createServerSupabaseClient();

    const { data: beforeProfile, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, full_name, tier, consecutive_saturday_streak")
      .eq("id", parsed.data.profileId)
      .maybeSingle();

    if (fetchErr || !beforeProfile) {
      return fail("Member profile not found.");
    }

    const { error: insertErr } = await supabase.from("attendance_logs").insert({
      profile_id: parsed.data.profileId,
      service_date: parsed.data.serviceDate,
      checked_in_by: actor.id,
      method: parsed.data.method,
      notes: parsed.data.notes ?? null,
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return ok({
          profileId: beforeProfile.id,
          fullName: beforeProfile.full_name,
          previousTier: beforeProfile.tier,
          newTier: beforeProfile.tier,
          streak: beforeProfile.consecutive_saturday_streak,
          alreadyCheckedIn: true,
          upgraded: false,
        });
      }
      return fail(insertErr.message);
    }

    // Re-read profile after PostgreSQL consecutive-streak trigger completes
    const { data: afterProfile } = await supabase
      .from("profiles")
      .select("tier, consecutive_saturday_streak")
      .eq("id", parsed.data.profileId)
      .single();

    const newTier = afterProfile?.tier ?? beforeProfile.tier;
    const newStreak = afterProfile?.consecutive_saturday_streak ?? 1;
    const upgraded = newTier !== beforeProfile.tier;

    if (upgraded) {
      await sendPushToProfiles([beforeProfile.id], {
        title: "Discipleship Milestone Reached!",
        body: `Praise God! Your ${newStreak}-week Saturday streak upgraded your tier to ${newTier.replace("_", " ").toUpperCase()}.`,
        url: "/",
      });
    }

    revalidatePath("/registrar");
    revalidatePath("/treasurer");
    revalidatePath("/");
    return ok({
      profileId: beforeProfile.id,
      fullName: beforeProfile.full_name,
      previousTier: beforeProfile.tier,
      newTier,
      streak: newStreak,
      alreadyCheckedIn: false,
      upgraded,
    });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to complete check-in."
    );
  }
}

export async function checkInByQrAction(
  rawQrText: string,
  expectedServiceDate: string
): Promise<ActionResult<CheckInFeedback>> {
  const actor = await verifyActionRole(["registrar"]);
  if (!actor) return fail("Only Registrars or System Admin can scan QR passes.");

  const parsed = parseQrPayload(rawQrText);
  if (!parsed) {
    return fail(
      "Invalid QR pass format. Expected SYCC:<member-id>:<YYYY-MM-DD>."
    );
  }

  if (parsed.serviceDate !== expectedServiceDate) {
    return fail(
      `QR pass is dated ${parsed.serviceDate}, not today's service (${expectedServiceDate}). Ask the youth to refresh their QR Pass.`
    );
  }

  return checkInMemberAction({
    profileId: parsed.profileId,
    serviceDate: expectedServiceDate,
    method: "qr_scan",
  });
}

export async function registerWalkInAction(
  input: z.infer<typeof walkInSchema>
): Promise<ActionResult<CheckInFeedback>> {
  const actor = await verifyActionRole(["registrar"]);
  if (!actor) return fail("Only Registrars or System Admin can add walk-ins.");

  const parsed = walkInSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid walk-in entry.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: created, error: createErr } = await supabase
      .from("profiles")
      .insert({
        full_name: parsed.data.full_name,
        nickname: parsed.data.nickname || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        invited_by_id: parsed.data.invited_by_id || null,
        current_leader_id: parsed.data.current_leader_id || null,
        role: "member",
        tier: "new_invite",
        auth_user_id: null,
      })
      .select("id")
      .single();

    if (createErr || !created) {
      return fail(createErr?.message ?? "Failed to register walk-in profile.");
    }

    return checkInMemberAction({
      profileId: created.id,
      serviceDate: parsed.data.serviceDate,
      method: "walk_in",
    });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Unexpected error creating walk-in."
    );
  }
}

export async function undoCheckInAction(
  profileId: string,
  serviceDate: string
): Promise<ActionResult> {
  const actor = await verifyActionRole(["registrar"]);
  if (!actor) return fail("Unauthorized.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("attendance_logs")
      .delete()
      .eq("profile_id", profileId)
      .eq("service_date", serviceDate);

    if (error) return fail(error.message);
    revalidatePath("/registrar");
    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not undo check-in."
    );
  }
}

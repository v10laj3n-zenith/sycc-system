"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyActionRole } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const themeSchema = z.object({
  season_title: z.string().trim().min(2, "Season title is required.").max(100),
  anchor_verse: z.string().trim().min(5, "Anchor verse text is required.").max(400),
  verse_reference: z.string().trim().max(80),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Valid hex color required."),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Valid hex color required."),
  banner_gradient: z.string().trim().min(10, "CSS gradient is required."),
});

const profileOverrideSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum([
    "member",
    "cell_leader",
    "registrar",
    "treasurer",
    "pastor",
    "system_admin",
  ]),
  tier: z.enum(["new_invite", "invite", "disciple", "cell_leader", "alumni"]),
  current_leader_id: z.string().uuid().optional().nullable(),
  consecutive_saturday_streak: z.coerce.number().int().min(0),
  reason: z.string().trim().min(3, "Audit reason is mandatory for all overrides."),
});

const graduateLeaderSchema = z.object({
  leaderId: z.string().uuid(),
  incomingLeaderId: z.string().uuid(),
  reason: z.string().trim().min(3, "Graduation reason is required for audit logs."),
});

const unlockLiquidationSchema = z.object({
  liquidationId: z.string().uuid(),
  reason: z.string().trim().min(3, "Unlock reason is mandatory for audit logs."),
});

export async function updateSeasonalThemeAction(
  input: z.infer<typeof themeSchema>
): Promise<ActionResult> {
  const actor = await verifyActionRole(["pastor"]);
  if (!actor) {
    return fail("Only Pastor or System Admin can publish Seasonal Themes.");
  }

  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid theme configuration.");
  }

  try {
    const supabase = await createServerSupabaseClient();

    const { data: previous } = await supabase
      .from("app_theme_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    // Deactivate previous active theme before activating new one
    if (previous) {
      await supabase
        .from("app_theme_settings")
        .update({ is_active: false })
        .eq("id", previous.id);
    }

    const { data: created, error } = await supabase
      .from("app_theme_settings")
      .insert({
        ...parsed.data,
        is_active: true,
        updated_by: actor.id,
      })
      .select("*")
      .single();

    if (error || !created) {
      return fail(error?.message ?? "Could not publish theme.");
    }

    await supabase.from("system_audit_logs").insert({
      actor_id: actor.id,
      action: "publish_seasonal_theme",
      target_table: "app_theme_settings",
      target_id: created.id,
      before_state: previous ? JSON.parse(JSON.stringify(previous)) : null,
      after_state: JSON.parse(JSON.stringify(created)),
      reason: `Published seasonal theme "${parsed.data.season_title}"`,
    });

    updateTag("theme");
    revalidatePath("/", "layout");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to update seasonal theme."
    );
  }
}

export async function adminUpdateProfileOverrideAction(
  input: z.infer<typeof profileOverrideSchema>
): Promise<ActionResult> {
  const actor = await verifyActionRole(["system_admin"]);
  if (!actor) return fail("Root System Admin access required.");

  const parsed = profileOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid override input.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: before } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", parsed.data.profileId)
      .single();

    if (!before) return fail("Profile not found.");

    const { data: after, error } = await supabase
      .from("profiles")
      .update({
        role: parsed.data.role,
        tier: parsed.data.tier,
        current_leader_id: parsed.data.current_leader_id ?? null,
        consecutive_saturday_streak: parsed.data.consecutive_saturday_streak,
      })
      .eq("id", parsed.data.profileId)
      .select("*")
      .single();

    if (error || !after) return fail(error?.message ?? "Override failed.");

    await supabase.from("system_audit_logs").insert({
      actor_id: actor.id,
      action: "profile_manual_override",
      target_table: "profiles",
      target_id: parsed.data.profileId,
      before_state: JSON.parse(JSON.stringify(before)),
      after_state: JSON.parse(JSON.stringify(after)),
      reason: parsed.data.reason,
    });

    revalidatePath("/admin");
    revalidatePath("/registrar");
    revalidatePath("/tree");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Profile override error."
    );
  }
}

export async function adminGraduateLeaderAction(
  input: z.infer<typeof graduateLeaderSchema>
): Promise<ActionResult<{ reassignedMembers: number; archivedNotes: number }>> {
  const actor = await verifyActionRole(["system_admin"]);
  if (!actor) return fail("Root System Admin access required.");

  const parsed = graduateLeaderSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid graduation request.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("graduate_cell_leader", {
      p_leader_id: parsed.data.leaderId,
      p_new_leader_id: parsed.data.incomingLeaderId,
      p_reason: parsed.data.reason,
    });

    if (error) return fail(error.message);

    const summary = (data ?? {}) as {
      reassigned_members?: number;
      archived_care_notes?: number;
    };

    revalidatePath("/admin");
    revalidatePath("/cell-care");
    revalidatePath("/tree");
    return ok({
      reassignedMembers: summary.reassigned_members ?? 0,
      archivedNotes: summary.archived_care_notes ?? 0,
    });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Leader graduation failed."
    );
  }
}

export async function adminUnlockLiquidationAction(
  input: z.infer<typeof unlockLiquidationSchema>
): Promise<ActionResult> {
  const actor = await verifyActionRole(["system_admin"]);
  if (!actor) return fail("Root System Admin access required.");

  const parsed = unlockLiquidationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid unlock request.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("admin_unlock_liquidation", {
      p_liquidation_id: parsed.data.liquidationId,
      p_reason: parsed.data.reason,
    });

    if (error) return fail(error.message);
    revalidatePath("/admin");
    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to unlock liquidation sheet."
    );
  }
}

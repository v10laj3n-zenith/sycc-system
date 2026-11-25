"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters."),
  nickname: z.string().trim().max(40).optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  birthday: z.string().optional().nullable(),
  bio: z.string().trim().max(300).optional().nullable(),
  ministry_team: z.string().trim().max(60).optional().nullable(),
});

export async function updateOwnProfileAction(
  input: z.infer<typeof updateProfileSchema>
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid profile input.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        nickname: parsed.data.nickname || null,
        phone: parsed.data.phone || null,
        birthday: parsed.data.birthday || null,
        bio: parsed.data.bio || null,
        ministry_team: parsed.data.ministry_team || null,
      })
      .eq("id", profile.id);

    if (error) return fail(error.message);

    revalidatePath("/profile");
    revalidatePath("/");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not update profile."
    );
  }
}

export async function updateAvatarUrlAction(
  avatarUrl: string
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Unauthorized.");

  const urlCheck = z.string().url().safeParse(avatarUrl);
  if (!urlCheck.success) return fail("Invalid avatar URL.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id);

    if (error) return fail(error.message);
    revalidatePath("/profile");
    revalidatePath("/");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not save avatar."
    );
  }
}

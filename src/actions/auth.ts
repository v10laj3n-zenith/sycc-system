"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/server";
import { ROLE_DEFAULT_HOME } from "@/lib/rbac";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export async function signInAction(
  payload: z.infer<typeof signInSchema>
): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isServerSupabaseConfigured()) {
    return fail(
      "Supabase environment variables are not configured yet in .env.local."
    );
  }

  const parsed = signInSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid credentials.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      return fail(error?.message ?? "Unable to sign in.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    const redirectTo = profile?.role ? ROLE_DEFAULT_HOME[profile.role] : "/";
    return ok({ redirectTo });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Unexpected error during sign in."
    );
  }
}

export async function signUpAction(
  payload: z.infer<typeof signUpSchema>
): Promise<ActionResult<{ needsEmailConfirmation: boolean; redirectTo: string }>> {
  if (!isServerSupabaseConfigured()) {
    return fail(
      "Supabase environment variables are not configured yet in .env.local."
    );
  }

  const parsed = signUpSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid registration details.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
        },
      },
    });

    if (error) {
      return fail(error.message);
    }

    const needsEmailConfirmation = !data.session;
    return ok({ needsEmailConfirmation, redirectTo: "/" });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Unexpected error during sign up."
    );
  }
}

export async function signOutAction(): Promise<void> {
  if (isServerSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

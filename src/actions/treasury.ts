"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyActionRole } from "@/lib/auth";
import { getActiveTheme } from "@/lib/theme";
import { sendGivingReceiptEmail } from "@/lib/mailer";
import { sendPushToProfiles } from "@/lib/push";
import { formatPhp } from "@/lib/format";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const recordGivingSchema = z.object({
  giverId: z.string().uuid().optional().nullable(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive("Amount must be greater than ₱0.00."),
  givingType: z.enum(["tithe", "offering", "missions", "special"]),
  paymentMethod: z.enum(["cash", "gcash_ewallet"]),
  referenceNumber: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(250).optional().nullable(),
});

const denominationsSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count_1000: z.coerce.number().int().min(0),
  count_500: z.coerce.number().int().min(0),
  count_200: z.coerce.number().int().min(0),
  count_100: z.coerce.number().int().min(0),
  count_50: z.coerce.number().int().min(0),
  count_20: z.coerce.number().int().min(0),
  count_10: z.coerce.number().int().min(0),
  count_5: z.coerce.number().int().min(0),
  count_1: z.coerce.number().int().min(0),
  notes: z.string().trim().max(400).optional().nullable(),
});

const addExpenseSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(2, "Expense description is required."),
  amount: z.coerce.number().positive("Expense amount must be positive."),
  receiptImageUrl: z.string().optional().nullable(),
});

const lockLiquidationSchema = z.object({
  liquidationId: z.string().uuid(),
  counter1Id: z.string().uuid(),
  counter1Pin: z.string().regex(/^\d{4,8}$/, "Counter 1 PIN must be 4–8 digits."),
  counter2Id: z.string().uuid(),
  counter2Pin: z.string().regex(/^\d{4,8}$/, "Counter 2 PIN must be 4–8 digits."),
});

async function ensureLiquidationSheet(serviceDate: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("cash_liquidations")
    .select("id")
    .eq("service_date", serviceDate)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("cash_liquidations")
    .insert({ service_date: serviceDate })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Could not initialize cash liquidation sheet.");
  }
  return created.id;
}

export async function recordGivingAction(
  input: z.infer<typeof recordGivingSchema>
): Promise<ActionResult> {
  const actor = await verifyActionRole(["treasurer"]);
  if (!actor) return fail("Only Treasurer or System Admin can record giving.");

  const parsed = recordGivingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid giving entry.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const liquidationId = await ensureLiquidationSheet(parsed.data.serviceDate);

    const { error } = await supabase.from("tithes_and_offerings").insert({
      giver_id: parsed.data.giverId ?? null,
      service_date: parsed.data.serviceDate,
      amount: parsed.data.amount,
      giving_type: parsed.data.givingType,
      payment_method: parsed.data.paymentMethod,
      reference_number: parsed.data.referenceNumber || null,
      recorded_by: actor.id,
      liquidation_id: liquidationId,
      receipt_sent_at: null,
      notes: parsed.data.notes || null,
    });

    if (error) return fail(error.message);

    await supabase.rpc("recompute_cash_liquidation", {
      p_liquidation_id: liquidationId,
    });

    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to record giving."
    );
  }
}

export async function deleteGivingAction(
  entryId: string,
  serviceDate: string
): Promise<ActionResult> {
  const actor = await verifyActionRole(["treasurer"]);
  if (!actor) return fail("Unauthorized.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("tithes_and_offerings")
      .delete()
      .eq("id", entryId);

    if (error) return fail(error.message);

    const { data: sheet } = await supabase
      .from("cash_liquidations")
      .select("id")
      .eq("service_date", serviceDate)
      .maybeSingle();

    if (sheet) {
      await supabase.rpc("recompute_cash_liquidation", {
        p_liquidation_id: sheet.id,
      });
    }

    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not delete entry."
    );
  }
}

export async function saveDenominationCountsAction(
  input: z.infer<typeof denominationsSchema>
): Promise<ActionResult> {
  const actor = await verifyActionRole(["treasurer"]);
  if (!actor) return fail("Only Treasurer or System Admin can update counts.");

  const parsed = denominationsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Denomination counts must be zero or positive whole numbers.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const liquidationId = await ensureLiquidationSheet(parsed.data.serviceDate);

    const { error } = await supabase
      .from("cash_liquidations")
      .update({
        count_1000: parsed.data.count_1000,
        count_500: parsed.data.count_500,
        count_200: parsed.data.count_200,
        count_100: parsed.data.count_100,
        count_50: parsed.data.count_50,
        count_20: parsed.data.count_20,
        count_10: parsed.data.count_10,
        count_5: parsed.data.count_5,
        count_1: parsed.data.count_1,
        notes: parsed.data.notes ?? null,
      })
      .eq("id", liquidationId);

    if (error) return fail(error.message);

    await supabase.rpc("recompute_cash_liquidation", {
      p_liquidation_id: liquidationId,
    });

    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to save PHP cash count."
    );
  }
}

export async function addLiquidationExpenseAction(
  input: z.infer<typeof addExpenseSchema>
): Promise<ActionResult> {
  const actor = await verifyActionRole(["treasurer"]);
  if (!actor) return fail("Unauthorized.");

  const parsed = addExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid expense details.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const liquidationId = await ensureLiquidationSheet(parsed.data.serviceDate);

    const { error } = await supabase.from("liquidation_expenses").insert({
      liquidation_id: liquidationId,
      description: parsed.data.description,
      amount: parsed.data.amount,
      receipt_image_url: parsed.data.receiptImageUrl ?? null,
      recorded_by: actor.id,
    });

    if (error) return fail(error.message);

    await supabase.rpc("recompute_cash_liquidation", {
      p_liquidation_id: liquidationId,
    });

    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not add petty cash expense."
    );
  }
}

export async function deleteLiquidationExpenseAction(
  expenseId: string,
  liquidationId: string
): Promise<ActionResult> {
  const actor = await verifyActionRole(["treasurer"]);
  if (!actor) return fail("Unauthorized.");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("liquidation_expenses")
      .delete()
      .eq("id", expenseId);

    if (error) return fail(error.message);

    await supabase.rpc("recompute_cash_liquidation", {
      p_liquidation_id: liquidationId,
    });

    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Could not remove expense."
    );
  }
}

export async function setTreasurerPinAction(pin: string): Promise<ActionResult> {
  const actor = await verifyActionRole(["treasurer", "pastor"]);
  if (!actor) return fail("Only Treasurer, Pastor, or System Admin can register a PIN.");

  if (!/^\d{4,8}$/.test(pin)) {
    return fail("PIN must be 4 to 8 numeric digits.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("set_treasurer_pin", { p_pin: pin });
    if (error) return fail(error.message);
    revalidatePath("/treasurer");
    return ok();
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to register Treasury PIN."
    );
  }
}

export async function signAndLockLiquidationAction(
  input: z.infer<typeof lockLiquidationSchema>
): Promise<ActionResult<{ emailsSent: number; pushesSent: number }>> {
  const actor = await verifyActionRole(["treasurer"]);
  if (!actor) return fail("Only Treasurer or System Admin can lock liquidation.");

  const parsed = lockLiquidationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid 2-Counter PIN input.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: lockedSheet, error: lockErr } = await supabase.rpc(
      "sign_and_lock_liquidation",
      {
        p_liquidation_id: parsed.data.liquidationId,
        p_counter_1_id: parsed.data.counter1Id,
        p_counter_1_pin: parsed.data.counter1Pin,
        p_counter_2_id: parsed.data.counter2Id,
        p_counter_2_pin: parsed.data.counter2Pin,
      }
    );

    if (lockErr || !lockedSheet) {
      return fail(lockErr?.message ?? "2-Counter PIN verification failed.");
    }

    // Dispatch giving acknowledgment receipts via Gmail SMTP + Web Push
    let emailsSent = 0;
    let pushesSent = 0;

    try {
      const theme = await getActiveTheme();
      const { data: entries } = await supabase
        .from("tithes_and_offerings")
        .select("id, giver_id, amount, giving_type, payment_method, reference_number, receipt_sent_at")
        .eq("service_date", lockedSheet.service_date)
        .not("giver_id", "is", null)
        .is("receipt_sent_at", null);

      if (entries && entries.length > 0) {
        const giverIds = Array.from(
          new Set(entries.map((e) => e.giver_id).filter(Boolean) as string[])
        );

        const { data: giverProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", giverIds);

        const profileMap = new Map(
          (giverProfiles ?? []).map((p) => [p.id, p])
        );

        const grouped = new Map<string, typeof entries>();
        for (const entry of entries) {
          if (!entry.giver_id) continue;
          const list = grouped.get(entry.giver_id) ?? [];
          list.push(entry);
          grouped.set(entry.giver_id, list);
        }

        const stampedEntryIds: string[] = [];

        for (const [giverId, giverEntries] of grouped.entries()) {
          const profile = profileMap.get(giverId);
          if (!profile) continue;
          const giverTotal = giverEntries.reduce(
            (sum, item) => sum + Number(item.amount),
            0
          );

          if (profile.email) {
            const emailRes = await sendGivingReceiptEmail({
              toEmail: profile.email,
              giverName: profile.full_name,
              serviceDate: lockedSheet.service_date,
              entries: giverEntries.map((item) => ({
                givingType: item.giving_type,
                paymentMethod: item.payment_method,
                amount: Number(item.amount),
                referenceNumber: item.reference_number,
              })),
              seasonTitle: theme.season_title,
            });
            if (emailRes.sent) emailsSent += 1;
          }

          const pushRes = await sendPushToProfiles([giverId], {
            title: "Thank You for Your Faithful Giving!",
            body: `Your ${formatPhp(giverTotal)} giving for ${lockedSheet.service_date} has been verified & recorded.`,
            url: "/profile",
          });
          pushesSent += pushRes.delivered;

          stampedEntryIds.push(...giverEntries.map((e) => e.id));
        }

        if (stampedEntryIds.length > 0) {
          const nowIso = new Date().toISOString();
          await supabase
            .from("tithes_and_offerings")
            .update({ receipt_sent_at: nowIso })
            .in("id", stampedEntryIds);
        }

        // Stamp receipts_dispatched_at on the locked sheet
        const admin = createAdminSupabaseClient();
        await admin
          .from("cash_liquidations")
          .update({ receipts_dispatched_at: new Date().toISOString() })
          .eq("id", lockedSheet.id);
      }
    } catch {
      // Sheet lock succeeded; receipt dispatch issues shouldn't roll back lock
    }

    revalidatePath("/treasurer");
    revalidatePath("/pastor");
    return ok({ emailsSent, pushesSent });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Failed to sign & lock liquidation."
    );
  }
}

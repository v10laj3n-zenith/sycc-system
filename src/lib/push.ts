import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

function configureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:sycc-youth@church.org";

  if (!pub || !priv || pub.includes("<") || priv.includes("<")) {
    return false;
  }

  setVapidDetails(subject, pub, priv);
  return true;
}

export async function sendPushToProfiles(
  profileIds: string[],
  payload: PushPayload
): Promise<{ delivered: number; skipped: number }> {
  if (profileIds.length === 0 || !configureVapid()) {
    return { delivered: 0, skipped: profileIds.length };
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("profile_id", profileIds);

    if (!subscriptions || subscriptions.length === 0) {
      return { delivered: 0, skipped: profileIds.length };
    }

    const staleIds: string[] = [];
    let delivered = 0;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              url: payload.url ?? "/",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
            })
          );
          delivered += 1;
        } catch (err: unknown) {
          const statusCode =
            typeof err === "object" && err !== null && "statusCode" in err
              ? Number((err as { statusCode: number }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          }
        }
      })
    );

    if (staleIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", staleIds);
    }

    return { delivered, skipped: Math.max(0, subscriptions.length - delivered) };
  } catch {
    return { delivered: 0, skipped: profileIds.length };
  }
}

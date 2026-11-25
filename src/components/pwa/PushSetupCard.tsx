"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Bell, BellOff, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/actions/push";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const emptySubscribe = () => () => {};

export function PushSetupCard() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const supported =
    isClient && "serviceWorker" in navigator && "PushManager" in window;
  const isIOS =
    isClient &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone =
    isClient && window.matchMedia("(display-mode: standalone)").matches;

  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!supported) return;
    let active = true;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (active) setSubscription(sub);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [supported]);

  function handleSubscribe() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey || vapidKey.includes("<")) {
      toast.error(
        "VAPID public key is not configured yet in .env.local."
      );
      return;
    }

    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission was not granted.");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          toast.error("Browser returned an incomplete push subscription.");
          return;
        }

        const res = await savePushSubscriptionAction({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent.slice(0, 280),
        });

        if (!res.success) {
          toast.error(res.error ?? "Could not save push subscription.");
          return;
        }

        setSubscription(sub);
        toast.success("Lock-screen push notifications enabled!");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to enable notifications."
        );
      }
    });
  }

  function handleUnsubscribe() {
    if (!subscription) return;
    startTransition(async () => {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await removePushSubscriptionAction(endpoint);
      setSubscription(null);
      toast.success("Push notifications turned off on this device.");
    });
  }

  function handleTestPush() {
    startTransition(async () => {
      const res = await sendTestPushAction();
      if (res.success) {
        toast.success("Test notification sent!");
      } else {
        toast.error(res.error ?? "Failed to send test alert.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[var(--color-primary)]" />
          PWA Lock-Screen Alerts
        </CardTitle>
        <CardDescription>
          Receive Saturday milestone celebrations, cell meetup reminders, and
          verified giving acknowledgments on Android &amp; iOS 16.4+.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isIOS && !isStandalone && (
          <div className="rounded-xl border border-blue-200 bg-[#DBEAFE]/60 p-3 text-xs text-[#1E3A8A] flex items-start gap-2.5">
            <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>iPhone / iPad Tip:</strong> Tap Safari&apos;s{" "}
              <strong>Share</strong> button and choose{" "}
              <strong>Add to Home Screen</strong> first, then open SYCC Youth
              from your Home Screen to enable iOS push alerts and offline QR
              access.
            </p>
          </div>
        )}

        {!supported ? (
          <p className="text-sm text-slate-500">
            Push notifications are not supported in this browser session.
          </p>
        ) : subscription ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestPush}
              disabled={isPending}
            >
              <Send className="h-4 w-4" />
              Send Test Alert
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleUnsubscribe}
              disabled={isPending}
            >
              <BellOff className="h-4 w-4" />
              Disable on Device
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleSubscribe}
            disabled={isPending}
          >
            <Bell className="h-4 w-4" />
            {isPending ? "Enabling..." : "Enable Push Alerts"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

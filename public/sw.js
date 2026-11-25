/// <reference lib="webworker" />

const CACHE_VERSION = "sycc-pwa-v1";
const APP_SHELL_URLS = [
  "/",
  "/qr-pass",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(APP_SHELL_URLS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Supabase auth/API or Next server actions
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for immutable Next static bundles & icons
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Network-first with offline cache fallback for navigations (especially /qr-pass)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const qrFallback = await caches.match("/qr-pass");
          if (qrFallback) return qrFallback;
          const rootFallback = await caches.match("/");
          if (rootFallback) return rootFallback;
          return new Response(
            "<html><body style='font-family:sans-serif;padding:24px'><h2>SYCC Youth — Offline</h2><p>Connect to the internet once to cache your QR pass for offline Saturday check-in.</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
  }
});

// Web Push Notification handler (Android & iOS 16.4+ Standalone PWA)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "SYCC Youth",
    body: "You have a new update.",
    url: "/",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
  };

  try {
    const parsed = event.data.json();
    payload = { ...payload, ...parsed };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      vibrate: [100, 50, 100],
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

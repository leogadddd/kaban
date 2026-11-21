/* Kaban service worker: offline app shell. Data lives in IndexedDB, so the shell is all we cache. */
const VERSION = "kaban-v9";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

const ROUTES = [
  "/",
  "/home",
  "/accounts",
  "/accounts/new",
  "/accounts/view",
  "/add",
  "/activity",
  "/people",
  "/owed",
  "/owed/person",
  "/instalments",
  "/payments",
  "/analytics",
  "/family",
  "/family/new",
  "/family/invite",
  "/family/join",
  "/family/members",
  "/family/settings",
  "/profile",
  "/profile/edit",
  "/sync",
  "/settings",
  "/settings/payday",
  "/welcome",
  "/ready",
  "/terms",
  "/privacy",
  "/login",
  "/login/verify",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon",
  "/banks/bdo.png", "/banks/bpi.png", "/banks/chinabank.png", "/banks/gcash.png", "/banks/gotyme.png", "/banks/landbank.png", "/banks/maribank.png", "/banks/metrobank.png", "/banks/pnb.png", "/banks/rcbc.png", "/banks/securitybank.png", "/banks/tonik.png", "/banks/atome.png", "/banks/shopee.png", "/banks/lazada.png",
];

/**
 * Cache key for an RSC payload. Every route is prerendered, so the payload depends only on the path and on
 * which segment a prefetch asks for, not on the `_rsc` cache-buster or the router state the request carries
 * (both differ per navigation, and the response Varies on them, so matching the raw request never hits).
 */
function rscKey(pathname, req) {
  const seg = req?.headers.get("Next-Router-Segment-Prefetch");
  return `${pathname}?__rsc${seg ? `&seg=${encodeURIComponent(seg)}` : ""}`;
}

/** Network, but give up after `ms` so a dead or flaky connection falls through to the cache. */
function fetchWithin(req, ms) {
  if (!self.navigator.onLine) return Promise.reject(new Error("offline"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Fetch each route and also cache every /_next/static asset its HTML references. */
async function precache() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);
  const seen = new Set();
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { cache: "no-store" });
        if (!res.ok) return;
        await shell.put(route, res.clone());
        if (!(res.headers.get("content-type") || "").includes("text/html")) return;
        // The page's client-navigation payload too, so tapping between screens offline stays a soft navigation.
        fetch(route, { headers: { RSC: "1" }, cache: "no-store" })
          .then((rsc) => rsc.ok && (rsc.headers.get("content-type") || "").includes("text/x-component") && assets.put(rscKey(route), rsc))
          .catch(() => {});
        const html = await res.text();
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) seen.add(m[0]);
      } catch {
        /* offline during install: cached lazily later */
      }
    }),
  );
  await Promise.all(
    [...seen].map(async (url) => {
      if (await assets.match(url)) return;
      try {
        const r = await fetch(url);
        if (r.ok) await assets.put(url, r);
      } catch {}
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "precache") event.waitUntil(precache());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(ASSETS).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // RSC payloads for client navigation: network first (briefly), then the cached payload for that path.
  // Only with nothing cached does it fail, and Next.js then falls back to a full navigation from the shell,
  // which reloads the app and loses the page animation.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    const key = rscKey(url.pathname, req);
    event.respondWith(
      fetchWithin(req, 1500)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(key, { ignoreVary: true })) || Response.error()),
    );
    return;
  }

  // Pages: network first (fresh build), fall back to cached shell for that path, then home.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(url.pathname, copy));
          }
          return res;
        } catch {
          const cache = await caches.open(SHELL);
          return (await cache.match(url.pathname)) || (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Everything else (icons, manifest, fonts): stale-while-revalidate.
  event.respondWith(
    caches.match(req, { ignoreSearch: false }).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || net;
    }),
  );
});

// Tapping a reminder (lib/notify.ts) focuses an open Kaban window, or opens one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return win ? win.focus() : self.clients.openWindow("/home");
    }),
  );
});

/* Kaban service worker: offline app shell. Data lives in IndexedDB, so the shell is all we cache. */
const VERSION = "kaban-v5";
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
  "/sync",
  "/settings",
  "/welcome",
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

  // RSC payloads for client navigation: network first, fall back to cache, else fail so
  // Next.js falls back to a full navigation (which the shell cache serves).
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(ASSETS).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) || Response.error()),
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

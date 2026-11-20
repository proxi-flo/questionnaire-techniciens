// Permet d'ouvrir le questionnaire sans réseau (après une première ouverture avec réseau).
const CACHE = "questionnaire-v1";
const FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-180.png", "./logo.png"];
const FONTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Polices : copie gardée en priorité (elles ne changent pas)
  if (FONTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => new Response("", { status: 504 }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Pages de l'appli : réseau d'abord (dernière version), mais si le réseau est absent
  // ou trop lent (plus de 4 s, ex. en sous-sol), on ouvre tout de suite la copie gardée.
  const reseau = fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
    return res;
  });
  const copie = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"));
  e.respondWith(new Promise(resolve => {
    let fini = false;
    const t = setTimeout(() => copie().then(r => { if (r && !fini) { fini = true; resolve(r); } }), 4000);
    reseau.then(res => { if (!fini) { fini = true; clearTimeout(t); resolve(res); } })
      .catch(() => copie().then(r => { if (!fini) { fini = true; clearTimeout(t); resolve(r || Response.error()); } }));
  }));
});

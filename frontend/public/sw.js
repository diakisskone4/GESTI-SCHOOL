/* Service worker Gesti-Scolaire : rend l'application installable et utilisable hors connexion
 * pour l'interface (les données de l'API, elles, ne sont jamais mises en cache).
 *
 * - Pages (navigation) : réseau d'abord, repli sur la dernière version de l'application en cache.
 * - Fichiers du build (/assets/*, nommés avec un hash) : cache d'abord, ils ne changent jamais.
 * - Tout le reste (API, autres domaines) : réseau uniquement.
 */
const CACHE = "gesti-scolaire-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API et ressources externes : pas de cache

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copie = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copie));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copie = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copie));
            }
            return response;
          })
      )
    );
  }
});

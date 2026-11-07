/* Service worker MA-RA : garde l'application disponible sans réseau.
   Les appels /api ne sont jamais mis en cache ici. */
const CACHE = 'mara-v4';
const BASES = [
  '/', '/logo1.png', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png',
  '/gifs/train-scene.gif', '/gifs/train-scene.jpg', '/gifs/train-petit.gif', '/gifs/train-petit.jpg',
  '/modeles/axe-voie-metrique.glb', '/modeles/axe-voie-metrique.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(BASES);
    // Les fichiers JS et CSS ont un nom haché : on les lit dans la page d'accueil.
    const page = await (await fetch('/', { cache: 'no-store' })).text();
    const ressources = [...page.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await cache.addAll(ressources);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const reponse = await fetch(request);
        const cache = await caches.open(CACHE);
        await cache.put('/', reponse.clone());
        return reponse;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const present = await caches.match(request);
    if (present) return present;
    const reponse = await fetch(request);
    if (reponse.ok) (await caches.open(CACHE)).put(request, reponse.clone());
    return reponse;
  })());
});

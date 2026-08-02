// ============================================================
// BFS Terrain — Service Worker (mode hors-ligne)
// ============================================================
// Stratégie "réseau d'abord, cache en secours" : les mises à jour
// arrivent normalement, et si le réseau manque, l'appli s'ouvre
// quand même avec la dernière version connue.
const CACHE='bfs-terrain-v1';

self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const shellLocal=url.origin===location.origin&&(url.pathname.endsWith('.html')||url.pathname.endsWith('.js')||url.pathname.endsWith('.json')||url.pathname.includes('/icons/'));
  const cdn=url.host.includes('cdn.jsdelivr.net')||url.host.includes('cdnjs.cloudflare.com');
  if(!shellLocal&&!cdn)return; // les appels Supabase ne sont jamais mis en cache
  e.respondWith(
    fetch(e.request).then(r=>{
      if(r&&r.ok){const cl=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cl))}
      return r;
    }).catch(()=>caches.match(e.request,{ignoreSearch:true}))
  );
});

const CACHE_NAME='control-gastos-v1';
const APP_SHELL=[
  '/control-gastos/',
  '/control-gastos/index.html',
  '/control-gastos/styles.css?v=20261006-nuevomes',
  '/control-gastos/app.js?v=20261006-nuevomes',
  '/control-gastos/manifest.webmanifest',
  '/control-gastos/icon.svg'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).catch(()=>{}));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put('/control-gastos/',copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match('/control-gastos/'))
    );
    return;
  }

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  event.respondWith(
    caches.match(request).then(cached=>{
      const network=fetch(request).then(response=>{
        if(response && response.status===200){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>cached);
      return cached||network;
    })
  );
});
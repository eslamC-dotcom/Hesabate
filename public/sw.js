const V='hesabaty-v1';
const SHELL=['./','./index.html','./app.js','./firebase-config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  const sdk=u.hostname==='www.gstatic.com'||u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';
  if(sdk){ // مكتبات وخطوط: من الكاش أولًا
    e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res})));
    return;
  }
  if(u.origin!==location.origin)return;
  // ملفات التطبيق: الشبكة أولًا عشان التحديثات توصل، والكاش لو مفيش نت
  const key=u.search?new Request(u.origin+u.pathname):r;
  e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(key,cp));return res}).catch(()=>caches.match(key,{ignoreSearch:true}).then(h=>h||caches.match('./index.html'))));
});

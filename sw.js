/* sw.js · avisos push del portal TRUST (Fase push: lead nuevo / reasignado). No guarda nada en caché. */
self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("push",function(e){
  var d={};try{d=e.data.json()}catch(_){d={title:"TRUST",body:e.data?e.data.text():""}}
  e.waitUntil(self.registration.showNotification(d.title||"TRUST",{
    body:d.body||"",icon:"/icon-192.png",badge:"/icon-192.png",tag:d.tag||"trust",renotify:true,
    data:{url:d.url||"/leads/asesores.html"}
  }));
});
self.addEventListener("notificationclick",function(e){
  e.notification.close();
  var url=new URL((e.notification.data&&e.notification.data.url)||"/leads/asesores.html",self.location.origin).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(cs){
    for(var i=0;i<cs.length;i++){var c=cs[i];if(c.url.indexOf(self.location.origin)===0&&"focus" in c){return c.focus().then(function(w){if(w&&w.url!==url&&w.navigate)return w.navigate(url)})}}
    return self.clients.openWindow(url);
  }));
});

/* push.js · avisos push al celular cuando le llega o le reasignan un lead al asesor.
   - Botón "Activar avisos": pide permiso, suscribe el dispositivo y guarda la suscripción (push_suscripciones).
   - Quien manda el aviso es la función push-lead de Supabase, disparada por un trigger al asignar un lead.
   - iPhone: solo funciona si el portal está instalado en la pantalla de inicio y se abre desde ese ícono.
   - No se muestra si la tabla aún no existe, ni en "Ver como" ni con código maestro. */
(function(){
  "use strict";
  var VAPID="BLg5ocDcEddC9z_qZtBy-8fo3FmZno4gITFX6RsVRyeY4izWQj2ZEj5idngV31-j48dRKauX0IR5jddfJfl3YyI";
  var SB_URL="https://xshhjvdmkuqesdlvczbb.supabase.co",SB_KEY="sb_publishable_5erZfpELyuncW1nrReTaZw_BQj0bc-P",_sb=null;
  function sb(){if(!_sb)_sb=window.SBC||(window.CITAS&&CITAS.sb&&(typeof CITAS.sb==="function"?CITAS.sb():CITAS.sb))||window.supabase.createClient(SB_URL,SB_KEY);return _sb}
  var ua=navigator.userAgent||"";
  var ios=/iphone|ipad|ipod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  var standalone=navigator.standalone===true||(window.matchMedia&&matchMedia("(display-mode: standalone)").matches);
  var soporta="serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
  function key(b64){var p="=".repeat((4-b64.length%4)%4),s=(b64+p).replace(/-/g,"+").replace(/_/g,"/"),r=atob(s),a=new Uint8Array(r.length);for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i);return a}
  function puede(){try{var A=window.AUTH;return !!(A&&A.nombre&&!A.viendoComo&&!localStorage.getItem("trust_sin_ping")&&!localStorage.getItem("trust_ver_como"))}catch(e){return false}}
  function disp(){return (ios?"iPhone/iPad":/android/i.test(ua)?"Android":/mac/i.test(ua)?"Mac":/windows/i.test(ua)?"Windows":"Otro")+(standalone?" (app)":"")}
  async function guardar(sub){
    var j=sub.toJSON(),k=j.keys||{};
    var r=await sb().from("push_suscripciones").upsert({asesor:window.AUTH.nombre,endpoint:j.endpoint,p256dh:k.p256dh,auth:k.auth,dispositivo:disp()},{onConflict:"endpoint"});
    if(r.error)throw r.error;
  }
  var el=null;
  function msg(html,cls,boton){
    el.hidden=false;
    el.innerHTML='<div class="pshb '+(cls||"")+'"><span class="psht">'+html+'</span>'+(boton?'<button type="button" class="pshbtn" id="pshGo">'+boton+'</button>':"")+'</div>';
    var b=document.getElementById("pshGo");if(b)b.onclick=activar;
  }
  async function activar(){
    var b=document.getElementById("pshGo");if(b){b.disabled=true;b.textContent="Activando…"}
    try{
      var perm=await Notification.requestPermission();
      if(perm!=="granted"){estado();return}
      var reg=await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;
      var sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(VAPID)});
      await guardar(sub);
      try{await reg.showNotification("Avisos activados",{body:"Así te llegará cada lead nuevo.",icon:"/icon-192.png",tag:"trust-prueba"})}catch(e){}
      estado();
    }catch(e){msg("No se pudieron activar los avisos: "+(e&&e.message?e.message:e),"mal","Reintentar")}
  }
  async function estado(){
    if(!el)return;
    if(!puede()){el.hidden=true;return}
    try{var t=await sb().from("push_suscripciones").select("id").limit(1);if(t.error){el.hidden=true;return}}catch(e){el.hidden=true;return}   /* aún no se corre el SQL */
    if(ios&&!standalone){msg("<b>Avisos en tu iPhone:</b> toca <b>Compartir</b> → <b>Agregar a pantalla de inicio</b> y abre TRUST desde ese ícono para activarlos.","info");return}
    if(!soporta){el.hidden=true;return}
    if(Notification.permission==="denied"){msg("Los avisos están bloqueados en este dispositivo. Actívalos en los ajustes del navegador o del teléfono.","mal");return}
    if(Notification.permission==="granted"){
      try{var reg=await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;var sub=await reg.pushManager.getSubscription();
        if(sub){try{await guardar(sub)}catch(e){}msg("🔔 Avisos de leads activos en este dispositivo","ok");return}}catch(e){}
    }
    msg("🔔 <b>Activa los avisos</b> para enterarte al instante cuando te llegue un lead.","","Activar avisos");
  }
  window.PUSH={montar:function(id){el=typeof id==="string"?document.getElementById(id):id;estado()}};
  var st=document.createElement("style");
  st.textContent=".pshb{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#fff;border:1px solid #E6E0D2;border-left:6px solid #B8956A;border-radius:12px;padding:10px 16px;margin-bottom:12px;font-size:14px;color:#173F35}.pshb.ok{border-left-color:#2E7D5B;background:#F4F9F6;font-size:13px;padding:7px 14px}.pshb.mal{border-left-color:#A8342A}.pshb.info{border-left-color:#173F35}.psht{flex:1;min-width:200px}.pshbtn{border:0;background:#173F35;color:#fff;border-radius:999px;padding:8px 18px;font:600 13px Poppins,system-ui,sans-serif;cursor:pointer}.pshbtn:disabled{opacity:.6}";
  (document.head||document.documentElement).appendChild(st);
})();

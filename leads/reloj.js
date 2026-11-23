/* reloj.js · Nuevo sistema de Lead Management · Fase 2: contacto y reloj
   - Al asignar un lead se guarda la hora (leads.asignado_en).
   - El primer toque de "Llamar" o "WhatsApp" guarda el primer contacto (primer_contacto_en / primer_contacto_canal).
   - Plazo: 30 minutos desde la asignación, contando solo horario hábil (lunes a viernes, 9:00 a 18:00).
   - Los leads sin hora de asignación (anteriores al arranque, o dados de alta por el propio asesor) no entran al reloj.
   Lo usan Mis leads (asesor) y Lead Management (admin). Depende de los globales de esas páginas: leads, patch(), render(). */
(function(){
  "use strict";
  var PLAZO=30,H_INI=9,H_FIN=18;
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  /* minutos hábiles entre dos momentos (hora local del dispositivo) */
  function minHabiles(a,b){
    a=new Date(a);b=new Date(b||Date.now());if(isNaN(a)||isNaN(b)||b<=a)return 0;
    var tot=0,d=new Date(a.getFullYear(),a.getMonth(),a.getDate()),guard=0;
    while(d<=b&&guard++<800){
      var dow=d.getDay();
      if(dow>=1&&dow<=5){
        var ini=new Date(d);ini.setHours(H_INI,0,0,0);var fin=new Date(d);fin.setHours(H_FIN,0,0,0);
        var x=Math.max(ini,a),y=Math.min(fin,b);if(y>x)tot+=(y-x)/60000;
      }
      d.setDate(d.getDate()+1);
    }
    return Math.floor(tot);
  }
  /* estado del reloj de un lead: null si no aplica */
  function estado(l){
    if(!l||!l.asignado_en)return null;
    if(l.primer_contacto_en){var m=minHabiles(l.asignado_en,l.primer_contacto_en);return {contactado:true,min:m,vencido:m>PLAZO,canal:l.primer_contacto_canal||""}}
    if(l.venta||l.apartado||l.perdido||l.futuro)return null;   /* ya cerrado por otra vía: no se persigue */
    var n=minHabiles(l.asignado_en);
    return {contactado:false,min:n,vencido:n>PLAZO,restan:Math.max(0,PLAZO-n)};
  }
  var pendiente=function(l){var e=estado(l);return !!e&&!e.contactado};
  var vencido=function(l){var e=estado(l);return !!e&&!e.contactado&&e.vencido};
  function dur(m){if(m<60)return m+" min";var h=Math.floor(m/60),r=m%60;if(h<9)return h+" h"+(r?" "+r+" min":"");var d=Math.floor(h/9);return d+" d háb."}
  function badge(l){
    var e=estado(l);if(!e)return "";
    if(e.contactado)return '<span class="rlj ok" title="Primer contacto por '+esc(e.canal||"contacto")+' a los '+dur(e.min)+' hábiles de asignado'+(e.vencido?" (fuera del plazo de "+PLAZO+" min)":"")+'">✓ '+dur(e.min)+'</span>';
    if(e.vencido)return '<span class="rlj bad" title="Asignado hace '+dur(e.min)+' hábiles sin contacto. El plazo es de '+PLAZO+' minutos.">Vencido · '+dur(e.min)+'</span>';
    return '<span class="rlj '+(e.restan<=10?"warn":"run")+'" title="Tienes '+PLAZO+' minutos hábiles desde la asignación para contactarlo">⏱ quedan '+e.restan+' min</span>';
  }
  function telLimpio(t){var d=String(t||"").replace(/[^\d+]/g,"");return d}
  function waNum(t){var d=String(t||"").replace(/\D/g,"");return d?(d.length===10?"52"+d:d):""}
  /* botones Llamar y WhatsApp: abren el teléfono o WhatsApp y registran el primer contacto */
  function botones(l){
    if(!l||!l.telefono)return "";
    var id=JSON.stringify(l.id).replace(/"/g,"&quot;"),w=waNum(l.telefono);
    return '<span class="rljb"><a class="rlb call" href="tel:'+esc(telLimpio(l.telefono))+'" draggable="false" title="Llamar a '+esc(l.nombre||"")+'" onclick="RELOJ.contacto(event,'+id+',\'llamada\')"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Llamar</a>'+
      (w?'<a class="rlb wa2" href="https://wa.me/'+w+'" target="_blank" rel="noopener" draggable="false" title="Escribir por WhatsApp" onclick="RELOJ.contacto(event,'+id+',\'whatsapp\')"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 3C7 3 3 6.6 3 11c0 2 .8 3.8 2.2 5.2L4.3 20l4-1.1c1.1.5 2.4.8 3.7.8 5 0 9-3.6 9-8S17 3 12 3z"/></svg>WhatsApp</a>':'')+
      '</span>'+badge(l);
  }
  /* registra el primer contacto (solo el primero; los siguientes toques no lo cambian). No interrumpe la llamada ni el chat. */
  function contacto(ev,id,canal){
    if(ev&&ev.stopPropagation)ev.stopPropagation();
    try{
      var ro=typeof READONLY!=="undefined"&&READONLY;if(ro)return;
      var l=(window.leads||(typeof leads!=="undefined"?leads:[])).filter(function(x){return String(x.id)===String(id)})[0];
      if(!l||!l.asignado_en||l.primer_contacto_en)return;
      /* en "Ver como" (un administrador viendo el portal del asesor) no se registra contacto a nombre del asesor */
      if(window.AUTH&&window.AUTH.viendoComo)return;
      var f={primer_contacto_en:new Date().toISOString(),primer_contacto_canal:canal};
      Promise.resolve(patch(l.id,f)).then(function(){if(typeof render==="function")render()}).catch(function(e){if(typeof toast==="function")toast("No se registró el contacto: "+(e.message||e),true)});
    }catch(e){}
  }
  function css(){
    var st=document.createElement("style");
    st.textContent=
      ".rljb{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}"+
      ".rlb{display:inline-flex;align-items:center;gap:4px;border:1px solid #D9D2C3;background:#fff;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:600;text-decoration:none;line-height:1.3;white-space:nowrap}"+
      ".rlb.call{color:#173F35}.rlb.call:hover{background:#173F35;color:#fff;border-color:#173F35}"+
      ".rlb.wa2{color:#128C4B}.rlb.wa2:hover{background:#25D366;color:#fff;border-color:#25D366}"+
      ".rlj{display:inline-block;margin-left:6px;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:700;line-height:1.2;white-space:nowrap;vertical-align:middle}"+
      ".rlj.run{background:#E3F1EA;color:#2E7D5B}.rlj.warn{background:#FBF0D6;color:#8A5D05}.rlj.bad{background:#A8342A;color:#fff}.rlj.ok{background:#F1EDE3;color:#6B706D;font-weight:600}"+
      "@media print{.rljb{display:none}}";
    document.head.appendChild(st);
  }
  if(document.head)css();else document.addEventListener("DOMContentLoaded",css);
  window.RELOJ={PLAZO:PLAZO,minHabiles:minHabiles,estado:estado,pendiente:pendiente,vencido:vencido,badge:badge,botones:botones,contacto:contacto,dur:dur};
})();

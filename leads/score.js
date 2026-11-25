/* score.js · Nuevo sistema de Lead Management · Fase 6: score de actividad
   Un número de 0 a 100 que refleja qué tanto trabaja el asesor su cartera. Es informativo: no afecta leads, nivel ni horas, y no mide resultados.
   Score = PESO_COB × cobertura + PESO_CONST × constancia
   - Cobertura: % de la cartera activa (todo menos Perdido, Futuro y Venta) con al menos una acción en los últimos DIAS_COB días.
   - Constancia: de los últimos DIAS_HAB días hábiles (L–V), en cuántos se movieron al menos el mínimo diario de leads distintos.
     El mínimo diario es MIN_PCT de la cartera activa, con piso MIN_PISO y tope MIN_TOPE (nunca más que la cartera misma).
   - Cuenta como acción: Llamar, WhatsApp, cambio de estatus, comentario o registro de cita. Cada acción se guarda en lead_acciones.
   - No se guarda nada en "Ver como", con código maestro ni desde administración. */
(function(){
  "use strict";
  /* ====== PARÁMETROS: cambia aquí el método ====== */
  var PESO_COB=0.6, PESO_CONST=0.4;       /* peso de cada parte; suman 1 */
  var DIAS_COB=7;                         /* ventana móvil de la cobertura, en días naturales */
  var DIAS_HAB=5;                         /* días hábiles que mide la constancia */
  var MIN_PCT=0.10, MIN_PISO=5, MIN_TOPE=20;   /* mínimo diario de leads movidos: 10% de la cartera, entre 5 y 20 */
  var BAJO=40, ALTO=70;                   /* 0–39 bajo · 40–69 medio · 70–100 alto */
  /* =============================================== */
  var DIAS=DIAS_COB, CARGA=10;            /* CARGA: días que se leen de la base (cubre 5 días hábiles completos + fin de semana) */
  var SB_URL="https://xshhjvdmkuqesdlvczbb.supabase.co",SB_KEY="sb_publishable_5erZfpELyuncW1nrReTaZw_BQj0bc-P",_sb=null;
  function sb(){if(!_sb)_sb=window.SBC||(window.CITAS&&CITAS.sb&&(typeof CITAS.sb==="function"?CITAS.sb():CITAS.sb))||window.supabase.createClient(SB_URL,SB_KEY);return _sb}
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  /* día local de Guadalajara (igual que el default de la base) */
  function dia(d){try{return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).format(d||new Date())}catch(e){var x=d||new Date();return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,10)}}
  function atras(n){var p=dia().split("-"),d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]-n));return d.toISOString().slice(0,10)}
  function desde(){return atras(CARGA-1)}
  /* los n días hábiles más recientes (L–V) que terminan en "fin" (inclusive) */
  function habiles(n,fin){var p=fin.split("-"),d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])),out=[];while(out.length<n){var w=d.getUTCDay();if(w>=1&&w<=5)out.push(d.toISOString().slice(0,10));d=new Date(d.getTime()-864e5)}return out}
  var PARES={},LISTO={},FALLA=false,onChange=[];   /* PARES[asesor] = { "leadId|dia": 1 } */
  function puedeGuardar(asesor){
    try{
      if(typeof READONLY!=="undefined"&&READONLY)return false;
      var A=window.AUTH;if(!A||!A.nombre||A.viendoComo)return false;
      if(localStorage.getItem("trust_sin_ping")||localStorage.getItem("trust_ver_como"))return false;
      return !asesor||asesor===A.nombre;   /* solo cuenta lo que el asesor hace sobre sus propios leads */
    }catch(e){return false}
  }
  /* guarda una acción. No interrumpe nada: si falla, se ignora. */
  function log(leadId,tipo,asesor){
    try{
      if(leadId==null||!puedeGuardar(asesor))return;
      var yo=window.AUTH.nombre;   /* no se refleja al momento: el número solo cambia al volver a abrir el portal */
      Promise.resolve(sb().from("lead_acciones").insert({asesor:yo,lead_id:leadId,tipo:tipo})).then(function(r){if(r&&r.error)FALLA=true}).catch(function(){FALLA=true});
    }catch(e){}
  }
  function avisar(){onChange.forEach(function(f){try{f()}catch(e){}})}
  async function traer(asesor){
    var out=[],from=0,d0=desde();
    for(;;){
      var q=sb().from("lead_actividad_dias").select("asesor,lead_id,dia").gte("dia",d0).order("dia").order("lead_id").range(from,from+999);
      if(asesor)q=q.eq("asesor",asesor);
      var r=await q;if(r.error)throw r.error;
      out=out.concat(r.data||[]);if((r.data||[]).length<1000)break;from+=1000;
    }
    return out;
  }
  /* carga la ventana de un asesor (o de todos si no se indica) */
  async function cargar(asesor){
    try{
      var rows=await traer(asesor),nuevo={};
      if(asesor)nuevo[asesor]={};
      rows.forEach(function(x){(nuevo[x.asesor]=nuevo[x.asesor]||{})[x.lead_id+"|"+x.dia]=1});
      Object.keys(nuevo).forEach(function(a){var loc=PARES[a]||{};Object.keys(loc).forEach(function(k){if(k.split("|")[1]>=desde())nuevo[a][k]=1});PARES[a]=nuevo[a]});
      LISTO[asesor||"*"]=true;FALLA=false;
    }catch(e){FALLA=true}
    avisar();
  }
  /* cartera activa del asesor: todo menos Perdido, Futuro y Venta (y lo que ya regresó a administración por el reloj) */
  function cartera(asesor){
    var L=[];try{L=leads}catch(e){}
    return (L||[]).filter(function(l){return l.asesor===asesor&&!(l.perdido||l.futuro||l.venta)&&!(window.RELOJ&&RELOJ.vencido(l))});
  }
  function de(asesor){
    var p=PARES[asesor]||{},hoy=dia(),dCob=atras(DIAS_COB-1),car=cartera(asesor),n=car.length;
    var porDia={},tocados={},h=0;
    Object.keys(p).forEach(function(k){var x=k.split("|"),id=x[0],d=x[1];(porDia[d]=porDia[d]||{})[id]=1;if(d>=dCob)tocados[id]=1;if(d===hoy)h++});
    /* cobertura: % de la cartera activa tocada en los últimos DIAS_COB días */
    var tc=car.filter(function(l){return tocados[String(l.id)]}).length;
    var cob=n?tc/n:0;
    /* constancia: días hábiles en que se movió al menos el mínimo diario */
    var min=n?Math.min(n,Math.max(MIN_PISO,Math.min(MIN_TOPE,Math.round(n*MIN_PCT)))):0;
    var cumple=function(d){return min>0&&Object.keys(porDia[d]||{}).length>=min};
    /* si hoy todavía no llega al mínimo no se castiga: se mide con los últimos días hábiles ya terminados */
    var fin=cumple(hoy)?hoy:atras(1);
    var dias=habiles(DIAS_HAB,fin),ok=dias.filter(cumple).length;
    var cons=ok/DIAS_HAB;
    var s=Math.max(0,Math.min(100,Math.round(PESO_COB*cob*100+PESO_CONST*cons*100)));
    return {score:s,cob:cob,cons:cons,cartera:n,tocados:tc,min:min,diasOk:ok,hoy:Object.keys(porDia[hoy]||{}).length,nivel:s>=ALTO?"alto":s>=BAJO?"medio":"bajo"};
  }
  var TXT={alto:"Alto",medio:"Medio",bajo:"Bajo"};
  /* equipo del ranking: asesores activos, sin administradores */
  function equipo(){return (window.TRUST_EQUIPO||[]).filter(function(a){return a.activo!==false&&!a.admin}).map(function(a){return a.nombre})}
  /* lugar en el ranking de actividad (los empates comparten lugar); null si no es parte del equipo */
  function lugar(asesor){var eq=equipo();if(eq.indexOf(asesor)<0||!LISTO["*"])return null;var mio=de(asesor).score;return {lugar:1+eq.filter(function(a){return de(a).score>mio}).length,de:eq.length}}
  /* tarjeta del asesor (Mis leads) */
  function pintar(el,asesor){
    if(typeof el==="string")el=document.getElementById(el);if(!el)return;
    if(!asesor||FALLA||!(LISTO[asesor]||LISTO["*"])){el.hidden=true;return}
    var r=de(asesor),lg=lugar(asesor);el.hidden=false;
    el.innerHTML='<div class="scr '+r.nivel+'"><div class="scn"><b>'+r.score+'</b><i>/100</i></div><div class="sct"><span class="scl">Score de actividad · '+TXT[r.nivel]+'</span>'+'<span class="sch">Hoy llevas <b>'+r.hoy+'</b> lead'+(r.hoy===1?"":"s")+' movido'+(r.hoy===1?"":"s")+(lg?' · Lugar <b>'+lg.lugar+'</b> de '+lg.de+' en el equipo':'')+'</span>'+'</div></div>';
  }
  /* tabla de todos (administración) */
  function tabla(el,asesores){
    if(typeof el==="string")el=document.getElementById(el);if(!el)return;
    if(FALLA||!LISTO["*"]){el.innerHTML="";return}
    var ns=equipo();if(!ns.length)ns=(asesores||[]).slice();Object.keys(PARES).forEach(function(a){if(ns.indexOf(a)<0&&de(a).tocados>0)ns.push(a)});
    var rs=ns.map(function(a){var r=de(a);r.a=a;return r}).sort(function(x,y){return y.score-x.score||y.hoy-x.hoy||x.a.localeCompare(y.a)});rs.forEach(function(r){r.lg=1+rs.filter(function(o){return o.score>r.score}).length});
    el.innerHTML='<div class="card scadm"><div class="lhead"><div><h2>Ranking de actividad</h2><p class="sub">'+Math.round(PESO_COB*100)+'% cobertura de la cartera activa (últimos '+DIAS_COB+' días) + '+Math.round(PESO_CONST*100)+'% constancia (días hábiles de los últimos '+DIAS_HAB+' que movió su mínimo diario). Informativo: no mide resultados.</p></div></div>'+
      '<div class="scg">'+rs.map(function(r){return '<div class="sci '+r.nivel+'"><b>'+r.score+'</b><span class="scan">'+r.lg+'º · '+esc(r.a)+'</span><span class="sch">Hoy: '+r.hoy+' · cartera '+r.cartera+'</span><span class="sch">Cobertura '+Math.round(r.cob*100)+'% · Constancia '+r.diasOk+'/'+DIAS_HAB+'</span><span class="scb"><span style="width:'+r.score+'%"></span></span></div>'}).join("")+'</div></div>';
  }
  function css(){
    var st=document.createElement("style");
    st.textContent=
      ".scr{display:flex;align-items:center;gap:18px;background:#fff;border:1px solid #E6E0D2;border-left:6px solid var(--scc);border-radius:14px;padding:14px 20px;margin-bottom:12px}"+
      ".scr.bajo,.sci.bajo{--scc:#A8342A}.scr.medio,.sci.medio{--scc:#B8862B}.scr.alto,.sci.alto{--scc:#2E7D5B}"+
      ".scn{display:flex;align-items:baseline;gap:3px;flex:none}.scn b{font-family:Lora,Georgia,serif;font-size:54px;line-height:1;font-weight:600;color:var(--scc)}.scn i{font-style:normal;font-size:13px;color:#8A8F8B}"+
      ".sct{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.scl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--scc)}"+
      ".sch{font-size:14px;color:#173F35}.scb{display:block;height:6px;border-radius:999px;background:#EFEADD;overflow:hidden;margin-top:5px;max-width:420px}.scb span{display:block;height:100%;background:var(--scc);border-radius:999px}"+
      ".scadm{margin-bottom:16px}.scg{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;padding:4px 0 2px}"+
      ".sci{border:1px solid #E6E0D2;border-top:4px solid var(--scc);border-radius:12px;padding:10px 12px;background:#fff;display:flex;flex-direction:column;gap:2px}"+
      ".sci b{font-family:Lora,Georgia,serif;font-size:32px;line-height:1.05;color:var(--scc)}.scan{font-weight:600;font-size:13px;color:#173F35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sci .sch{font-size:12px;color:#6B706D}"+
      "@media(max-width:600px){.scn b{font-size:44px}.scr{padding:12px 14px;gap:14px}}";
    document.head.appendChild(st);
  }
  if(document.head)css();else document.addEventListener("DOMContentLoaded",css);
  window.SCORE={DIAS:DIAS,log:log,cargar:cargar,de:de,pintar:pintar,tabla:tabla,alCambiar:function(f){onChange.push(f)},dia:dia};
})();

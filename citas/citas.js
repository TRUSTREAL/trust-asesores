/* citas.js · Nuevo sistema de Lead Management · Fase 1: módulo de citas
   Lógica y formulario compartidos por Mis citas (asesor), Mis leads / Lead Management (botones Cita y Visita) y Admin → Citas.
   Reglas:
   - Cita = encuentro cara a cara con el cliente, presencial o por videollamada. Llamada o chat no cuentan.
   - Se puede guardar como programada; al marcarla realizada pide la evidencia.
   - Una cita se registra como realizada a más tardar 48 horas después de ocurrida (después, solo administración y queda "fuera de plazo").
   - Al quedar realizada una cita ligada a un lead, el lead pasa solo a "Cita realizada" (y a "Visita" si fue visita al proyecto).
   - Cada cita guarda: si es la primera con ese cliente, si es con lead de TRUST o cliente propio, y si fue anulada. */
(function(){
  "use strict";
  var SB_URL="https://xshhjvdmkuqesdlvczbb.supabase.co",SB_KEY="sb_publishable_5erZfpELyuncW1nrReTaZw_BQj0bc-P";
  var BUCKET="documentos",PLAZO_H=48;
  var _sb=null;
  function sb(){if(!_sb)_sb=window.supabase.createClient(SB_URL,SB_KEY);return _sb}
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var tel10=function(t){var d=String(t||"").replace(/\D/g,"");return d.length>10?d.slice(-10):d};
  var pad=function(n){return String(n).padStart(2,"0")};
  var hoyISO=function(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
  var ahoraHM=function(){var d=new Date();return pad(d.getHours())+":"+pad(d.getMinutes())};
  var cuando=function(c){return new Date(String(c.fecha).slice(0,10)+"T"+(c.hora?String(c.hora).slice(0,5):"12:00")+":00")};
  var horasDesde=function(c){return (Date.now()-cuando(c).getTime())/36e5};
  var slug=function(s){return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"x"};
  var EVID=["Foto del lugar","Captura de la videollamada","Confirmación por WhatsApp"];
  var quien=function(){var a=window.AUTH||{};return a.real||a.nombre||""};
  function toast(t,err){css();var d=document.createElement("div");d.className="ctm-toast"+(err?" err":"");d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},err?5200:2600)}

  /* ---------- datos ---------- */
  async function listar(f){
    var out=[],i=0;f=f||{};
    for(;;){
      var q=sb().from("citas").select("*").order("fecha",{ascending:false}).order("hora",{ascending:false}).range(i,i+999);
      if(f.asesor)q=q.eq("asesor",f.asesor);if(f.desde)q=q.gte("fecha",f.desde);if(f.hasta)q=q.lte("fecha",f.hasta);
      var r=await q;if(r.error)throw r.error;out=out.concat(r.data||[]);if(!r.data||r.data.length<1000)break;i+=1000;
    }
    return out;
  }
  /* todas las citas del mismo cliente (por lead, o por teléfono si es cliente propio) */
  async function delCliente(c){
    if(c.lead_id!=null){var r=await sb().from("citas").select("*").eq("lead_id",c.lead_id);if(r.error)throw r.error;return r.data||[]}
    var t=tel10(c.cliente_telefono);if(!t)return [c];
    var r2=await sb().from("citas").select("*").is("lead_id",null).ilike("cliente_telefono","%"+t.slice(-7)+"%");if(r2.error)throw r2.error;
    return (r2.data||[]).filter(function(x){return tel10(x.cliente_telefono)===t});
  }
  var valida=function(c){return c.estatus==="realizada"&&!c.anulada};
  /* "primera cita": la realizada, no anulada, más antigua con ese cliente. Se recalcula al realizar y al anular. */
  async function recalcPrimera(c){
    var todas=(await delCliente(c)).filter(valida).sort(function(a,b){return cuando(a)-cuando(b)||String(a.created_at).localeCompare(String(b.created_at))});
    var otras=(await delCliente(c)).filter(function(x){return !valida(x)&&x.es_primera});
    var cambios=[];
    todas.forEach(function(x,i){var p=i===0;if(!!x.es_primera!==p)cambios.push(sb().from("citas").update({es_primera:p}).eq("id",x.id))});
    otras.forEach(function(x){cambios.push(sb().from("citas").update({es_primera:false}).eq("id",x.id))});
    await Promise.all(cambios);
    return todas.length?todas[0].id:null;
  }
  /* el lead pasa solo a "Cita realizada" (y Visita, si aplica). Solo agrega: no toca apartado, venta, hot, perdido ni futuro. */
  async function prenderLead(c){
    if(c.lead_id==null)return null;
    var p={cita:true,nc:false,seguimiento:false};
    if(c.es_visita){p.visita=true;p.visita_fecha=String(c.fecha).slice(0,10);p.visita_lugar=c.lugar||c.proyecto||null}
    var r=await sb().from("leads").update(p).eq("id",c.lead_id);if(r.error)throw r.error;
    return p;
  }
  /* al anular: si el lead se queda sin ninguna cita válida, pierde el estatus de cita (y de visita) */
  async function apagarLeadSiAplica(c){
    if(c.lead_id==null)return null;
    var rest=(await delCliente(c)).filter(function(x){return valida(x)&&x.id!==c.id});
    var p={};
    if(!rest.length){p.cita=false;p.visita=false;p.visita_fecha=null;p.visita_lugar=null}
    else if(!rest.some(function(x){return x.es_visita})){p.visita=false;p.visita_fecha=null;p.visita_lugar=null}
    else return null;
    if(p.cita===false){
      var l=await sb().from("leads").select("hot,apartado,venta,perdido,futuro,seguimiento").eq("id",c.lead_id).maybeSingle();
      var d=l.data||{};if(!(d.hot||d.apartado||d.venta||d.perdido||d.futuro||d.seguimiento))p.nc=true;
    }
    var r=await sb().from("leads").update(p).eq("id",c.lead_id);if(r.error)throw r.error;
    return p;
  }
  async function subirEvidencia(file,asesor){
    if(file.size>15*1024*1024)throw new Error("La evidencia pesa más de 15 MB");
    var ext=(file.name.match(/\.[A-Za-z0-9]{1,6}$/)||[""])[0].toLowerCase();
    var path="citas/"+slug(asesor)+"/"+Date.now()+"_"+slug(file.name.replace(/\.[^.]+$/,""))+ext;
    var s=await sb().storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||undefined});if(s.error)throw s.error;
    return {evidencia_path:path,evidencia_url:sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl};
  }
  async function anular(c,motivo,por){
    var r=await sb().from("citas").update({anulada:true,anulada_motivo:motivo,anulada_por:por||quien(),anulada_en:new Date().toISOString(),es_primera:false}).eq("id",c.id).select().single();
    if(r.error)throw r.error;
    await recalcPrimera(c);var lp=await apagarLeadSiAplica(c);
    return {cita:r.data,lead:lp};
  }
  async function reactivar(c){
    var r=await sb().from("citas").update({anulada:false,anulada_motivo:null,anulada_por:null,anulada_en:null}).eq("id",c.id).select().single();
    if(r.error)throw r.error;
    await recalcPrimera(r.data);if(valida(r.data))await prenderLead(r.data);
    return r.data;
  }
  async function verificar(c,val,por){
    var r=await sb().from("citas").update({verificada:!!val,verificada_por:val?(por||quien()):null,verificada_en:val?new Date().toISOString():null}).eq("id",c.id).select().single();
    if(r.error)throw r.error;return r.data;
  }
  async function borrarProgramada(c){
    if(c.estatus!=="programada")throw new Error("Solo se pueden borrar citas programadas");
    var r=await sb().from("citas").delete().eq("id",c.id);if(r.error)throw r.error;
  }

  /* ---------- formulario ---------- */
  var cssListo=false;
  function css(){
    if(cssListo)return;cssListo=true;
    var st=document.createElement("style");
    st.textContent=
      ".ctm-scrim{position:fixed;inset:0;background:rgba(20,30,27,.5);z-index:99000;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow-y:auto;font-family:Poppins,Montserrat,system-ui,sans-serif;font-size:14px;line-height:1.45;color:#1B1F1E}"+
      ".ctm{width:100%;max-width:520px;background:#FAF8F2;border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.35);overflow:hidden}"+
      ".ctm header{background:#173F35;color:#fff;padding:18px 22px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}"+
      ".ctm header h3{font-family:Lora,Georgia,serif;font-weight:500;font-size:20px;margin:0}.ctm header p{margin:2px 0 0;font-size:12px;opacity:.78}"+
      ".ctm header button{background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;padding:2px 6px}"+
      ".ctm .bd{padding:20px 22px;display:flex;flex-direction:column;gap:14px}"+
      ".ctm label.f{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#6B706D;font-weight:500}"+
      ".ctm input[type=text],.ctm input[type=tel],.ctm input[type=date],.ctm input[type=time],.ctm select,.ctm textarea{font:inherit;font-size:14px;color:#1B1F1E;border:1px solid #D8D2C3;border-radius:10px;padding:9px 12px;background:#fff;width:100%;box-sizing:border-box}"+
      ".ctm input:focus,.ctm select:focus,.ctm textarea:focus,.ctm button:focus-visible{outline:2px solid #B8956A;outline-offset:1px}"+
      ".ctm .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}"+
      ".ctm .seg{display:flex;border:1px solid #D8D2C3;border-radius:999px;background:#fff;padding:3px;gap:2px}"+
      ".ctm .seg button{flex:1;border:0;background:transparent;border-radius:999px;padding:8px 10px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;color:#1B1F1E}"+
      ".ctm .seg button[aria-pressed=true]{background:#173F35;color:#fff}"+
      ".ctm .cli{background:#fff;border:1px solid #E7E2D6;border-radius:12px;padding:10px 14px}.ctm .cli b{display:block;color:#173F35}.ctm .cli span{font-size:12px;color:#6B706D}"+
      ".ctm .res{border:1px solid #E7E2D6;border-radius:10px;background:#fff;max-height:190px;overflow-y:auto}"+
      ".ctm .res button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #F1EDE3;background:transparent;padding:8px 12px;font:inherit;cursor:pointer}.ctm .res button:last-child{border-bottom:0}"+
      ".ctm .res button:hover{background:#F6F3EC}.ctm .res small{color:#6B706D;display:block}"+
      ".ctm .chk{display:flex;gap:9px;align-items:center;font-size:13px;color:#1B1F1E}.ctm .chk input{width:17px;height:17px;accent-color:#173F35}"+
      ".ctm .nota{font-size:12px;color:#6B706D;background:#F1EDE3;border-radius:10px;padding:9px 12px}"+
      ".ctm .err{font-size:13px;color:#A8342A;background:#F7E4E1;border-radius:10px;padding:9px 12px}"+
      ".ctm footer{display:flex;gap:10px;justify-content:flex-end;padding:0 22px 20px;flex-wrap:wrap}"+
      ".ctm .b{border:1px solid #D8D2C3;background:#fff;border-radius:999px;padding:10px 18px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;color:#1B1F1E}"+
      ".ctm .b.p{background:#173F35;border-color:#173F35;color:#fff}.ctm .b[disabled]{opacity:.6;cursor:default}"+
      ".ctm-toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);background:#173F35;color:#fff;border-radius:10px;padding:10px 18px;font-family:Poppins,system-ui,sans-serif;font-size:13px;z-index:99500;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:calc(100vw - 30px)}.ctm-toast.err{background:#A8342A}"+
      "@media (max-width:520px){.ctm .row{grid-template-columns:1fr}.ctm-scrim{padding:10px 8px}}";
    document.head.appendChild(st);
  }
  function modal(html){
    css();
    var sc=document.createElement("div");sc.className="ctm-scrim";sc.innerHTML='<div class="ctm" role="dialog" aria-modal="true">'+html+'</div>';
    document.body.appendChild(sc);
    var cerrar=function(){document.removeEventListener("keydown",esc_);sc.remove()};
    var esc_=function(e){if(e.key==="Escape")cerrar()};document.addEventListener("keydown",esc_);
    sc.addEventListener("mousedown",function(e){if(e.target===sc)cerrar()});
    return {el:sc,cerrar:cerrar,$:function(s){return sc.querySelector(s)}};
  }
  /* ¿se puede marcar como realizada? devuelve {ok, fuera, msg} */
  function plazo(fecha,hora,admin){
    var h=horasDesde({fecha:fecha,hora:hora});
    if(h<0)return {ok:false,msg:"Esa fecha y hora todavía no llegan. Guárdala como programada y márcala realizada cuando ocurra."};
    if(h>PLAZO_H){if(admin)return {ok:true,fuera:true};return {ok:false,msg:"Pasaron más de "+PLAZO_H+" horas desde la cita. Ya no puedes registrarla; pide a administración que la revise."}}
    return {ok:true,fuera:false};
  }

  /* registrar({asesor, lead?, leads?, visita?, admin?, realizada?, onSaved(cita, leadPatch)}) */
  function registrar(o){
    o=o||{};var asesor=o.asesor||(window.AUTH&&window.AUTH.nombre)||"";
    var st={origen:"lead",lead:o.lead||null,modalidad:"presencial",realizada:o.realizada!==false,visita:!!o.visita};
    var leads=o.leads||null;
    var m=modal(
      '<header><div><h3>'+(o.visita?"Registrar visita":"Registrar cita")+'</h3><p>Encuentro cara a cara con el cliente, presencial o por videollamada. Llamada o chat no cuentan.</p></div><button type="button" id="ct-x" aria-label="Cerrar">✕</button></header>'+
      '<div class="bd">'+
        '<div id="ct-cli"></div>'+
        '<div class="seg" role="group" aria-label="¿Ya se realizó?"><button type="button" data-re="1">Ya se realizó</button><button type="button" data-re="0">Está programada</button></div>'+
        '<div class="row"><label class="f">Fecha<input type="date" id="ct-fecha" value="'+hoyISO()+'"></label><label class="f">Hora<input type="time" id="ct-hora" value="'+ahoraHM()+'"></label></div>'+
        '<div class="seg" role="group" aria-label="Modalidad"><button type="button" data-mo="presencial">Presencial</button><button type="button" data-mo="video">Videollamada</button></div>'+
        '<label class="f" id="ct-lugar-l"><span id="ct-lugar-t">Lugar</span><input type="text" id="ct-lugar" maxlength="140" placeholder="Showroom, oficina TRUST, café…"></label>'+
        '<label class="f">Proyecto o propiedad<input type="text" id="ct-proy" maxlength="120" list="ct-proys" placeholder="Balcana, Luciana, casa en…"></label><datalist id="ct-proys"></datalist>'+
        '<label class="chk" id="ct-vis-l"><input type="checkbox" id="ct-vis"> Fue visita al proyecto o a la propiedad</label>'+
        '<div id="ct-ev"><div class="row"><label class="f">Tipo de evidencia<select id="ct-evt">'+EVID.map(function(e){return "<option>"+e+"</option>"}).join("")+'</select></label><label class="f">Evidencia (foto o captura)<input type="file" id="ct-file" accept="image/*,application/pdf" style="font-size:12px"></label></div></div>'+
        '<label class="f">Nota (opcional)<textarea id="ct-nota" rows="2" maxlength="500"></textarea></label>'+
        '<div class="nota" id="ct-info"></div><div class="err" id="ct-err" hidden></div>'+
      '</div><footer><button type="button" class="b" id="ct-cancel">Cancelar</button><button type="button" class="b p" id="ct-ok">Guardar cita</button></footer>');
    var $=m.$;
    function pintaCli(){
      var h="";
      if(o.lead){h='<div class="cli"><b>'+esc(o.lead.nombre)+'</b><span>'+esc(o.lead.telefono||"sin teléfono")+" · "+esc(o.lead.proyecto||"")+' · lead de TRUST</span></div>'}
      else{
        h='<div class="seg" role="group" aria-label="Cliente"><button type="button" data-or="lead" aria-pressed="'+(st.origen==="lead")+'">De mis leads</button><button type="button" data-or="propio" aria-pressed="'+(st.origen==="propio")+'">Cliente propio</button></div><div style="height:10px"></div>';
        if(st.origen==="lead"){
          if(st.lead)h+='<div class="cli" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>'+esc(st.lead.nombre)+'</b><span>'+esc(st.lead.telefono||"sin teléfono")+" · "+esc(st.lead.proyecto||"")+'</span></div><button type="button" class="b" id="ct-cambiar" style="padding:6px 12px;font-size:12px">Cambiar</button></div>';
          else h+='<label class="f">Busca al cliente en tus leads<input type="text" id="ct-q" placeholder="Nombre o teléfono" autocomplete="off"></label><div class="res" id="ct-res" style="margin-top:8px"></div>';
        }else h+='<div class="row"><label class="f">Nombre del cliente<input type="text" id="ct-pn" maxlength="120" value="'+esc(st.pn||"")+'"></label><label class="f">Teléfono<input type="tel" id="ct-pt" maxlength="20" inputmode="tel" value="'+esc(st.pt||"")+'"></label></div><p class="nota" style="margin:8px 0 0">Cliente propio = lo generaste tú (no viene de un lead de TRUST). Nombre y teléfono son obligatorios.</p>';
      }
      $("#ct-cli").innerHTML=h;
      Array.prototype.forEach.call(m.el.querySelectorAll("[data-or]"),function(b){b.onclick=function(){guardaProp();st.origen=b.dataset.or;pintaCli()}});
      var cb=$("#ct-cambiar");if(cb)cb.onclick=function(){st.lead=null;pintaCli()};
      var q=$("#ct-q");if(q){q.oninput=buscar;buscar();q.focus()}
    }
    function guardaProp(){var a=$("#ct-pn"),b=$("#ct-pt");if(a)st.pn=a.value;if(b)st.pt=b.value}
    function buscar(){
      var box=$("#ct-res");if(!box)return;
      if(!leads){box.innerHTML='<div style="padding:10px 12px;color:#6B706D">Cargando tus leads…</div>';return}
      var q=String(($("#ct-q")||{}).value||"").toLowerCase().trim(),qd=q.replace(/\D/g,"");
      var r=leads.filter(function(l){return !q||String(l.nombre||"").toLowerCase().indexOf(q)>=0||(qd&&String(l.telefono||"").replace(/\D/g,"").indexOf(qd)>=0)}).slice(0,30);
      box.innerHTML=r.length?r.map(function(l){return '<button type="button" data-l="'+esc(l.id)+'"><b>'+esc(l.nombre)+'</b><small>'+esc(l.telefono||"sin teléfono")+" · "+esc(l.proyecto||"")+'</small></button>'}).join(""):'<div style="padding:10px 12px;color:#6B706D">'+(leads.length?"Ningún lead coincide.":"No tienes leads asignados.")+' Si el cliente es tuyo, usa "Cliente propio".</div>';
      Array.prototype.forEach.call(box.querySelectorAll("[data-l]"),function(b){b.onclick=function(){st.lead=leads.filter(function(l){return String(l.id)===b.dataset.l})[0];if(st.lead&&!$("#ct-proy").value)$("#ct-proy").value=st.lead.proyecto||"";pintaCli()}});
    }
    function pinta(){
      Array.prototype.forEach.call(m.el.querySelectorAll("[data-re]"),function(b){b.setAttribute("aria-pressed",String((b.dataset.re==="1")===st.realizada))});
      Array.prototype.forEach.call(m.el.querySelectorAll("[data-mo]"),function(b){b.setAttribute("aria-pressed",String(b.dataset.mo===st.modalidad))});
      $("#ct-ev").hidden=!st.realizada;
      $("#ct-vis-l").hidden=st.modalidad!=="presencial";if(st.modalidad!=="presencial")st.visita=false;
      $("#ct-vis").checked=st.visita;
      $("#ct-lugar-t").textContent=st.modalidad==="video"?"Plataforma (Zoom, Meet, WhatsApp…)":"Lugar";
      $("#ct-lugar").placeholder=st.modalidad==="video"?"Zoom, Google Meet, videollamada de WhatsApp…":"Showroom, oficina TRUST, café…";
      $("#ct-ok").textContent=st.realizada?"Guardar cita realizada":"Guardar cita programada";
      $("#ct-info").innerHTML=st.realizada?"Se registra a más tardar <b>"+PLAZO_H+" horas</b> después de ocurrida y necesita evidencia."+((o.lead||st.origen==="lead")?" Al guardarla, el lead pasa solo a <b>Cita realizada</b>.":""):"Queda como programada. Cuando ocurra, márcala como <b>realizada</b> desde Mis citas y sube la evidencia (tienes "+PLAZO_H+" horas).";
    }
    Array.prototype.forEach.call(m.el.querySelectorAll("[data-re]"),function(b){b.onclick=function(){st.realizada=b.dataset.re==="1";pinta()}});
    Array.prototype.forEach.call(m.el.querySelectorAll("[data-mo]"),function(b){b.onclick=function(){st.modalidad=b.dataset.mo;pinta()}});
    $("#ct-vis").onchange=function(){st.visita=$("#ct-vis").checked};
    $("#ct-x").onclick=$("#ct-cancel").onclick=m.cerrar;
    if(o.lead)$("#ct-proy").value=o.lead.proyecto||"";
    pintaCli();pinta();
    function setProys(){var ps={};(leads||[]).forEach(function(l){if(l.proyecto)ps[l.proyecto]=1});$("#ct-proys").innerHTML=Object.keys(ps).sort().map(function(p){return '<option value="'+esc(p)+'">'}).join("")}
    if(!o.lead){
      if(leads)setProys();
      else sb().from("leads").select("id,nombre,telefono,proyecto,fecha").eq("asesor",asesor).order("fecha",{ascending:false}).limit(1000).then(function(r){leads=r.data||[];setProys();buscar()});
    }
    var err=function(t){var e=$("#ct-err");e.textContent=t;e.hidden=!t;if(t)e.scrollIntoView({block:"nearest"})};
    $("#ct-ok").onclick=async function(){
      err("");guardaProp();
      var row={asesor:asesor,registrada_por:quien()||asesor,fecha:$("#ct-fecha").value,hora:$("#ct-hora").value||null,modalidad:st.modalidad,lugar:$("#ct-lugar").value.trim()||null,proyecto:$("#ct-proy").value.trim()||null,nota:$("#ct-nota").value.trim()||null,es_visita:st.modalidad==="presencial"&&st.visita};
      var lead=o.lead||(st.origen==="lead"?st.lead:null);
      if(lead){row.origen="lead";row.lead_id=lead.id;row.cliente_nombre=lead.nombre||"Sin nombre";row.cliente_telefono=lead.telefono||null}
      else if(st.origen==="lead"){err("Elige al cliente de tus leads, o cámbialo a “Cliente propio”.");return}
      else{
        row.origen="propio";row.lead_id=null;row.cliente_nombre=String(st.pn||"").trim();row.cliente_telefono=String(st.pt||"").trim();
        if(!row.cliente_nombre){err("Falta el nombre del cliente.");return}
        if(tel10(row.cliente_telefono).length<10){err("Falta el teléfono del cliente (10 dígitos).");return}
      }
      if(!row.fecha){err("Falta la fecha de la cita.");return}
      if(!row.hora){err("Falta la hora de la cita.");return}
      if(!row.lugar){err(st.modalidad==="video"?"Indica por qué plataforma fue la videollamada.":"Falta el lugar de la cita.");return}
      if(!row.proyecto){err("Falta el proyecto o la propiedad.");return}
      var file=null;
      if(st.realizada){
        var p=plazo(row.fecha,row.hora,o.admin);if(!p.ok){err(p.msg);return}
        file=$("#ct-file").files[0];if(!file){err("Sube la evidencia: foto del lugar, captura de la videollamada o confirmación por WhatsApp.");return}
        row.estatus="realizada";row.realizada_en=new Date().toISOString();row.fuera_de_plazo=!!p.fuera;row.evidencia_tipo=$("#ct-evt").value;
      }else{
        if(horasDesde(row)>0){err("Esa fecha y hora ya pasaron. Si la cita ya ocurrió, regístrala como “Ya se realizó”.");return}
        row.estatus="programada";
      }
      var b=$("#ct-ok");b.disabled=true;b.textContent="Guardando…";
      try{
        if(file)Object.assign(row,await subirEvidencia(file,asesor));
        var r=await sb().from("citas").insert(row).select().single();if(r.error)throw r.error;
        var cita=r.data,lp=null;
        if(!o.admin&&cita.lead_id!=null&&window.SCORE)SCORE.log(cita.lead_id,"cita",cita.asesor);   /* Fase 6 · score de actividad */
        if(cita.estatus==="realizada"){var pid=await recalcPrimera(cita);cita.es_primera=pid===cita.id;lp=await prenderLead(cita)}
        m.cerrar();toast(cita.estatus==="realizada"?"Cita registrada"+(cita.es_primera?" · primera con este cliente":""):"Cita programada");
        if(o.onSaved)o.onSaved(cita,lp);
      }catch(e){
        b.disabled=false;pinta();
        err(/relation .*citas|es_visita|schema cache/i.test(e.message||"")?"Falta correr el SQL sql/citas.sql en Supabase.":"No se guardó: "+(e.message||e));
      }
    };
  }

  /* marcarRealizada(cita,{admin,onSaved(cita, leadPatch)}) : de programada a realizada, con evidencia */
  function marcarRealizada(c,o){
    o=o||{};
    var m=modal(
      '<header><div><h3>Marcar cita realizada</h3><p>'+esc(c.cliente_nombre)+(c.proyecto?" · "+esc(c.proyecto):"")+'</p></div><button type="button" id="ct-x" aria-label="Cerrar">✕</button></header>'+
      '<div class="bd"><div class="row"><label class="f">Fecha en que ocurrió<input type="date" id="ct-fecha" value="'+esc(String(c.fecha).slice(0,10))+'"></label><label class="f">Hora<input type="time" id="ct-hora" value="'+esc(c.hora?String(c.hora).slice(0,5):"")+'"></label></div>'+
      (c.modalidad==="presencial"?'<label class="chk"><input type="checkbox" id="ct-vis"'+(c.es_visita?" checked":"")+'> Fue visita al proyecto o a la propiedad</label>':'')+
      '<div class="row"><label class="f">Tipo de evidencia<select id="ct-evt">'+EVID.map(function(e){return "<option>"+e+"</option>"}).join("")+'</select></label><label class="f">Evidencia (foto o captura)<input type="file" id="ct-file" accept="image/*,application/pdf" style="font-size:12px"></label></div>'+
      '<div class="nota">Tienes '+PLAZO_H+' horas después de la cita para registrarla.'+(c.lead_id!=null?" Al guardarla, el lead pasa solo a <b>Cita realizada</b>.":"")+'</div><div class="err" id="ct-err" hidden></div></div>'+
      '<footer><button type="button" class="b" id="ct-cancel">Cancelar</button><button type="button" class="b p" id="ct-ok">Guardar como realizada</button></footer>');
    var $=m.$,err=function(t){var e=$("#ct-err");e.textContent=t;e.hidden=!t};
    $("#ct-x").onclick=$("#ct-cancel").onclick=m.cerrar;
    $("#ct-ok").onclick=async function(){
      err("");var fecha=$("#ct-fecha").value,hora=$("#ct-hora").value;
      if(!fecha||!hora){err("Indica la fecha y la hora en que ocurrió.");return}
      var p=plazo(fecha,hora,o.admin);if(!p.ok){err(p.msg);return}
      var file=$("#ct-file").files[0];if(!file){err("Sube la evidencia: foto del lugar, captura de la videollamada o confirmación por WhatsApp.");return}
      var b=$("#ct-ok");b.disabled=true;b.textContent="Guardando…";
      try{
        var up={fecha:fecha,hora:hora,estatus:"realizada",realizada_en:new Date().toISOString(),fuera_de_plazo:!!p.fuera,evidencia_tipo:$("#ct-evt").value,es_visita:!!($("#ct-vis")&&$("#ct-vis").checked)};
        Object.assign(up,await subirEvidencia(file,c.asesor));
        var r=await sb().from("citas").update(up).eq("id",c.id).select().single();if(r.error)throw r.error;
        var cita=r.data,pid=await recalcPrimera(cita);cita.es_primera=pid===cita.id;var lp=await prenderLead(cita);
        m.cerrar();toast("Cita realizada"+(cita.es_primera?" · primera con este cliente":""));
        if(o.onSaved)o.onSaved(cita,lp);
      }catch(e){b.disabled=false;b.textContent="Guardar como realizada";err("No se guardó: "+(e.message||e))}
    };
  }

  window.CITAS={sb:sb,PLAZO_H:PLAZO_H,listar:listar,registrar:registrar,marcarRealizada:marcarRealizada,anular:anular,reactivar:reactivar,verificar:verificar,borrarProgramada:borrarProgramada,recalcPrimera:recalcPrimera,valida:valida,cuando:cuando,horasDesde:horasDesde,tel10:tel10,toast:toast,esc:esc,hoyISO:hoyISO};
})();

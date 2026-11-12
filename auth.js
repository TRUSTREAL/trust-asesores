/* auth.js · candado del portal de asesores TRUST (PIN de 4 dígitos)
   Se carga en <head> de cada página del portal (ya está la etiqueta <script src="/auth.js">).
   - Al abrir cualquier página de asesores sin sesión → pantalla: elige tu nombre + PIN.
   - Con sesión → fija la identidad en todos los módulos (ya no preguntan el nombre) y pone "Salir".
   - Páginas de administración (/admin/, /ventas/, etc.) no pasan por aquí. */
(function(){
  /* Equipo: se administra en Admin → Asesores (tabla "asesores" de Supabase: código, foto, celular, acceso).
     Esta lista es solo el respaldo por si no hay conexión o el dispositivo aún no la ha descargado. */
  var SB_URL="https://xshhjvdmkuqesdlvczbb.supabase.co",SB_KEY="sb_publishable_5erZfpELyuncW1nrReTaZw_BQj0bc-P";
  var CK="trust_equipo_v1";
  var EQ=[
    {nombre:"Ana Lu"},{nombre:"Carlos"},{nombre:"Fanny"},{nombre:"María",pin:"1990"},{nombre:"Paola",pin:"1973"},{nombre:"Paola M"},
    {nombre:"Ramsés",pin:"2424"},{nombre:"Rodrigo",pin:"9212",admin:true},{nombre:"Álvaro",pin:"1706",admin:true},
    {nombre:"Majo",pin:"9876"},{nombre:"Berna",pin:"1597",admin:true}
  ];
  try{var _c=JSON.parse(localStorage.getItem(CK)||"null");if(_c&&_c.length&&_c[0].nombre)EQ=_c}catch(e){}
  var ASESORES,PINS,ADMINS;
  function derivar(){
    ASESORES=[];PINS={};ADMINS=[];
    EQ.forEach(function(a){
      if(a.activo===false)return;                 /* sin acceso: no aparece para entrar */
      ASESORES.push(a.nombre);
      if(a.pin)PINS[a.nombre]=String(a.pin);      /* quien no tenga código entra sin contraseña */
      if(a.admin)ADMINS.push(a.nombre);           /* quién puede entrar al panel de administración */
    });
    window.TRUST_EQUIPO=EQ;
    window.TRUST_ASESORES=EQ.map(function(a){return a.nombre});   /* todos (para listas y filtros de los módulos) */
  }
  derivar();
  function refrescar(cb){
    var listo=false,fin=function(c){if(listo)return;listo=true;if(cb)cb(c)};
    try{
      fetch(SB_URL+"/rest/v1/asesores?select=nombre,nombre_completo,celular,pin,foto_url,activo,admin,orden&order=orden.asc,nombre.asc",{headers:{apikey:SB_KEY,Authorization:"Bearer "+SB_KEY}})
        .then(function(r){return r.ok?r.json():null})
        .then(function(d){
          if(!d||!d.length||!d[0].nombre){fin(false);return}
          var t=JSON.stringify(d),cambio=t!==JSON.stringify(EQ);
          try{localStorage.setItem(CK,t)}catch(e){}
          EQ=d;derivar();fin(cambio);
        }).catch(function(){fin(false)});
    }catch(e){fin(false)}
    setTimeout(function(){fin(false)},3000);
  }
  var IDENT=["trust_asesor_herr","trust_asesor_oo","trust_asesor_com","lst_me","trust_asesor"];
  var ADMIN_PREFIX=["/admin/","/ventas/"];
  var ADMIN_EXACT=["/leads/","/leads/index.html","/hotleads/","/hotleads/index.html","/inventario/","/inventario/index.html","/listings/","/listings/index.html"];
  var p=location.pathname;
  var ES_ADMIN=ADMIN_PREFIX.some(function(a){return p.indexOf(a)===0})||ADMIN_EXACT.indexOf(p)>=0;
  var KEY=ES_ADMIN?"trust_pin_admin":"trust_pin_user";   // sesiones separadas: la de asesores no abre admin
  var nombres=function(){return ES_ADMIN?ADMINS:ASESORES};

  var LS={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}},del:function(k){try{localStorage.removeItem(k)}catch(e){}}};
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
  var user=LS.get(KEY);
  if(user&&nombres().indexOf(user)<0){user=null;LS.del(KEY)}

  function fijar(n){IDENT.forEach(function(k){LS.set(k,n)});}
  function salir(){LS.del(KEY);if(!ES_ADMIN)IDENT.forEach(function(k){LS.del(k)});location.href=ES_ADMIN?"/admin/":"/";}
  window.logout=salir;

  if(user){
    if(!ES_ADMIN)fijar(user);
    var yo=EQ.filter(function(a){return a.nombre===user})[0]||{};
    window.AUTH={nombre:user,rol:ADMINS.indexOf(user)>=0?"admin":"asesor",nombreCompleto:yo.nombre_completo||"",celular:yo.celular||"",foto:yo.foto_url||""};
    /* Última sesión en el portal de asesores (se ve en Admin → Asesores). Máximo un registro cada 10 minutos. */
    if(!ES_ADMIN){try{
      var pk="trust_ping_"+user,ult=+(LS.get(pk)||0),ahora=Date.now();
      if(ahora-ult>600000){LS.set(pk,String(ahora));
        fetch(SB_URL+"/rest/v1/asesores?nombre=eq."+encodeURIComponent(user),{method:"PATCH",headers:{apikey:SB_KEY,Authorization:"Bearer "+SB_KEY,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({ultima_sesion:new Date().toISOString()})}).catch(function(){});}
    }catch(e){}}
    /* Trae el equipo vigente; si a esta persona le quitaron el acceso, se cierra su sesión. */
    refrescar(function(){if(nombres().indexOf(user)<0)salir()});
    document.addEventListener("DOMContentLoaded",function(){
      var st=document.createElement("style");
      st.textContent="#btn-switch,#btn-cambiar,#tabSwitch,.auth-hide{display:none!important}"+
        ".auth-out{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:#585C57;text-decoration:none;border:1px solid #D9D2C3;border-radius:999px;padding:6px 12px;background:#fff;cursor:pointer;font-family:Poppins,Montserrat,system-ui,sans-serif}"+
        ".auth-out:hover{color:#173F35;border-color:#173F35}.auth-out b{font-weight:600;color:#173F35}"+
        ".auth-out.fixed{position:fixed;right:14px;bottom:14px;z-index:9999;box-shadow:0 8px 24px rgba(23,63,53,.12)}";
      document.head.appendChild(st);
      var b=document.createElement("button");b.type="button";b.className="auth-out";b.innerHTML="<b>"+esc(user)+"</b> · Salir";b.onclick=function(){if(confirm("¿Salir del portal?"))salir()};
      var host=document.querySelector(".topright");
      if(host)host.appendChild(b);else{b.classList.add("fixed");document.body.appendChild(b)}
    });
    return;
  }

  /* ---- sin sesión: pantalla de entrada ---- */
  var st=document.createElement("style");
  st.textContent=
    "#pin-gate{position:fixed;inset:0;z-index:99999;background:#FAF8F2;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Poppins,'Segoe UI',system-ui,sans-serif;color:#1E241F}"+
    "#pin-gate .box{width:100%;max-width:420px;background:#fff;border:1px solid #D9D2C3;border-radius:20px;padding:28px 26px;box-shadow:0 18px 50px rgba(23,63,53,.10);text-align:center}"+
    "#pin-gate h1{font-family:Lora,Georgia,serif;font-weight:500;font-size:24px;margin:0 0 4px;color:#173F35}"+
    "#pin-gate .sub{color:#585C57;font-size:13px;margin:0 0 18px}"+
    "#pin-gate .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9C7A4E;font-weight:600;margin-bottom:10px}"+
    "#pin-gate .names{display:grid;grid-template-columns:1fr 1fr;gap:8px}"+
    "#pin-gate .names button{border:1px solid #D9D2C3;background:#FAF8F2;border-radius:12px;padding:12px 10px;font:inherit;font-size:14px;font-weight:500;color:#1E241F;cursor:pointer}"+
    "#pin-gate .names button:hover{border-color:#173F35;background:#fff;color:#173F35}"+
    "#pin-gate .who{font-weight:600;color:#173F35;font-size:16px}"+
    "#pin-gate .dots{display:flex;justify-content:center;gap:14px;margin:18px 0 10px}"+
    "#pin-gate .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #173F35;display:block}"+
    "#pin-gate .dots i.on{background:#173F35}"+
    "#pin-gate .dots.err i{border-color:#A8342A;animation:pinshake .3s}"+
    "@keyframes pinshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}"+
    "#pin-gate .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}"+
    "#pin-gate .pad button{border:1px solid #D9D2C3;background:#EFEAE0;border-radius:12px;padding:14px 0;font:inherit;font-size:18px;font-weight:600;color:#1E241F;cursor:pointer}"+
    "#pin-gate .pad button:hover{background:#173F35;color:#fff;border-color:#173F35}"+
    "#pin-gate .back{display:inline-block;margin-top:16px;font-size:12px;color:#585C57;background:none;border:0;cursor:pointer;font:inherit}"+
    "#pin-gate .back:hover{color:#173F35}"+
    "#pin-gate .foot{margin-top:18px;font-size:11px;color:#9C7A4E;letter-spacing:.08em;text-transform:uppercase}";
  document.head.appendChild(st);

  function entrar(n){if(!ES_ADMIN)fijar(n);LS.set(KEY,n);location.reload();}

  function render(){
    var g=document.getElementById("pin-gate");if(!g){g=document.createElement("div");g.id="pin-gate";document.body.appendChild(g)}
    g.innerHTML='<div class="box"><div class="eyebrow">TRUST realtor · '+(ES_ADMIN?"Administración":"Asesores")+'</div><h1>¿Quién eres?</h1><p class="sub">Elige tu nombre para entrar'+(ES_ADMIN?" al panel de administración":" al portal")+'.</p>'+
      '<div class="names">'+nombres().map(function(n){return '<button type="button" data-n="'+esc(n)+'">'+esc(n)+'</button>'}).join("")+'</div><div class="foot">Uso interno</div></div>';
    Array.prototype.forEach.call(g.querySelectorAll(".names button"),function(b){b.onclick=function(){var n=b.getAttribute("data-n");if(!PINS[n]){entrar(n);return}pedirPIN(n)}});
  }
  function pedirPIN(n){
    var g=document.getElementById("pin-gate"),pin="";
    g.innerHTML='<div class="box"><div class="eyebrow">TRUST realtor · '+(ES_ADMIN?"Administración":"Asesores")+'</div><h1>Hola, <span class="who">'+esc(n)+'</span></h1><p class="sub">Escribe tu contraseña de 4 dígitos</p>'+
      '<div class="dots" id="pin-dots"><i></i><i></i><i></i><i></i></div>'+
      '<div class="pad">'+[1,2,3,4,5,6,7,8,9].map(function(x){return '<button type="button" data-k="'+x+'">'+x+'</button>'}).join("")+'<button type="button" data-k="x" title="Borrar">⌫</button><button type="button" data-k="0">0</button><button type="button" data-k="c" title="Cancelar">✕</button></div>'+
      '<button type="button" class="back" id="pin-back">← No soy '+esc(n)+'</button></div>';
    var dots=g.querySelector("#pin-dots");
    var paint=function(){Array.prototype.forEach.call(dots.querySelectorAll("i"),function(d,i){d.classList.toggle("on",i<pin.length)})};
    var off=function(){document.removeEventListener("keydown",onKey)};
    var tecla=function(k){
      if(k==="c"){off();render();return}
      if(k==="x"){pin=pin.slice(0,-1);paint();return}
      if(!/^\d$/.test(k)||pin.length>=4)return;
      pin+=k;paint();
      if(pin.length===4){
        if(pin===PINS[n]){off();entrar(n)}
        else{dots.classList.add("err");setTimeout(function(){dots.classList.remove("err");pin="";paint()},450)}
      }
    };
    Array.prototype.forEach.call(g.querySelectorAll(".pad button"),function(b){b.onclick=function(){tecla(b.getAttribute("data-k"))}});
    g.querySelector("#pin-back").onclick=function(){tecla("c")};
    var onKey=function(e){if(e.key==="Escape")tecla("c");else if(e.key==="Backspace")tecla("x");else tecla(e.key)};
    document.addEventListener("keydown",onKey);
  }
  var enNombres=function(){var g=document.getElementById("pin-gate");return !!(g&&g.querySelector(".names"))};
  var pintar=function(){render();refrescar(function(c){if(c&&enNombres())render()})};
  if(document.body)pintar();else document.addEventListener("DOMContentLoaded",pintar);
})();

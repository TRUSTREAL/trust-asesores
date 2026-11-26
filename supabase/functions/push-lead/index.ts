// Función push-lead: manda la notificación al celular del asesor cuando le llega o le reasignan un lead.
// Secretos que necesita (Edge Functions → Secrets): PUSH_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los provee Supabase.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) return new Response("no autorizado", { status: 401 });
  const b = await req.json();
  const { data: subs } = await sb.from("push_suscripciones").select("id,endpoint,p256dh,auth").eq("asesor", b.asesor);
  const titulo = b.evento === "reasignado" ? "Lead reasignado a ti" : "Lead nuevo";
  const payload = JSON.stringify({
    title: titulo + (b.proyecto ? " · " + b.proyecto : ""),
    body: (b.nombre || "Sin nombre") + (b.telefono ? " · " + b.telefono : "") + ". Contáctalo lo antes posible.",
    url: "/leads/asesores.html",
    tag: "lead-" + b.lead_id,
  });
  let enviados = 0, borrados = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
      enviados++;
    } catch (e) {
      const c = (e as { statusCode?: number }).statusCode;
      if (c === 404 || c === 410) { await sb.from("push_suscripciones").delete().eq("id", s.id); borrados++; }   // dispositivo dado de baja
    }
  }));
  return new Response(JSON.stringify({ enviados, borrados, total: (subs || []).length }), { headers: { "Content-Type": "application/json" } });
});

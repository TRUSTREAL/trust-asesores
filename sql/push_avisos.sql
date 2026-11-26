-- Avisos push al celular cuando le llega o le reasignan un lead al asesor.
-- Solo agrega una tabla, una función y un trigger; no modifica datos existentes de leads.
-- ANTES DE CORRER: cambia CAMBIA_ESTE_SECRETO por el valor de PUSH_SECRET (el mismo que se guarda como secreto de la función push-lead).
create extension if not exists pg_net;

create table if not exists public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  asesor text not null,                       -- nombre del asesor, igual que en leads.asesor
  endpoint text not null unique,              -- dirección del dispositivo que da el navegador
  p256dh text not null,
  auth text not null,
  dispositivo text,                           -- iPhone/iPad, Android, Mac, Windows…
  creado_en timestamptz not null default now()
);
create index if not exists push_susc_asesor on public.push_suscripciones (asesor);
alter table public.push_suscripciones enable row level security;
drop policy if exists "push_susc_all" on public.push_suscripciones;
create policy "push_susc_all" on public.push_suscripciones for all using (true) with check (true);

-- Al asignar o reasignar un lead (se sella leads.asignado_en) se llama a la función push-lead.
-- Si algo falla, el lead se guarda igual: el aviso nunca bloquea el registro.
create or replace function public.avisar_lead_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.asesor is null or new.asignado_en is null then return new; end if;
  if tg_op = 'UPDATE' and new.asignado_en is not distinct from old.asignado_en then return new; end if;
  perform net.http_post(
    url := 'https://xshhjvdmkuqesdlvczbb.supabase.co/functions/v1/push-lead',
    headers := jsonb_build_object('Content-Type','application/json','x-push-secret','CAMBIA_ESTE_SECRETO'),
    body := jsonb_build_object('lead_id',new.id,'asesor',new.asesor,'nombre',new.nombre,'proyecto',new.proyecto,'telefono',new.telefono,
                               'evento',case when tg_op='INSERT' then 'nuevo' else 'reasignado' end)
  );
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists leads_push on public.leads;
create trigger leads_push after insert or update of asignado_en on public.leads
  for each row execute function public.avisar_lead_push();

-- Nuevo sistema de Lead Management · Fase 6: score de actividad
-- Solo agrega una tabla y una vista; no modifica datos existentes de leads.
create table if not exists public.lead_acciones (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),                                          -- fecha y hora de la acción
  dia date not null default ((now() at time zone 'America/Mexico_City')::date),          -- día local (Guadalajara) para el conteo
  asesor text not null,
  lead_id bigint not null references public.leads(id) on delete cascade,
  tipo text not null                                                                     -- 'llamada' | 'whatsapp' | 'estatus' | 'comentario' | 'cita'
);
create index if not exists lead_acc_asesor_dia on public.lead_acciones (asesor, dia);
create index if not exists lead_acc_lead on public.lead_acciones (lead_id);

alter table public.lead_acciones enable row level security;
drop policy if exists "lead_acc_all" on public.lead_acciones;
create policy "lead_acc_all" on public.lead_acciones for all using (true) with check (true);

-- Un renglón por asesor · lead · día (máximo un punto por lead por día)
create or replace view public.lead_actividad_dias as
  select asesor, lead_id, dia, count(*)::int as acciones, max(creado_en) as ultima
  from public.lead_acciones
  group by asesor, lead_id, dia;
grant select on public.lead_actividad_dias to anon, authenticated;

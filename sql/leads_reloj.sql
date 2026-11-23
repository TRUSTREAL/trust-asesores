-- Nuevo sistema de Lead Management · Fase 2: contacto y reloj
-- Solo agrega columnas y una tabla; no modifica datos existentes de leads.
alter table public.leads add column if not exists asignado_en timestamptz;          -- cuándo se asignó al asesor actual
alter table public.leads add column if not exists primer_contacto_en timestamptz;   -- primer toque de "Llamar" o "WhatsApp"
alter table public.leads add column if not exists primer_contacto_canal text;       -- 'llamada' o 'whatsapp'
alter table public.leads add column if not exists asesor_original text;             -- primer asesor que lo recibió (si se reasignó)

create table if not exists public.lead_reasignaciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  de_asesor text not null,
  a_asesor text not null,
  asignado_en timestamptz,          -- cuándo lo había recibido el asesor que lo pierde
  minutos_habiles integer,          -- minutos hábiles que pasaron sin contacto
  motivo text,
  por text
);
create index if not exists lead_reasig_lead on public.lead_reasignaciones (lead_id);
create index if not exists lead_reasig_de on public.lead_reasignaciones (de_asesor, created_at);

alter table public.lead_reasignaciones enable row level security;
drop policy if exists "lead_reasig_all" on public.lead_reasignaciones;
create policy "lead_reasig_all" on public.lead_reasignaciones for all using (true) with check (true);

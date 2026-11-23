-- Nuevo sistema de Lead Management · Fase 1: módulo de citas
-- Solo agrega una tabla nueva; no modifica ni borra nada de leads.
create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  asesor text not null,
  registrada_por text,

  -- cliente: lead de TRUST o cliente propio (autogenerado)
  origen text not null default 'lead' check (origen in ('lead','propio')),
  lead_id bigint references public.leads(id) on delete set null,
  cliente_nombre text not null,
  cliente_telefono text,

  -- la cita
  fecha date not null,
  hora time,
  modalidad text not null check (modalidad in ('presencial','video')),
  lugar text,
  proyecto text,
  nota text,
  es_visita boolean not null default false,   -- fue visita al proyecto o a la propiedad (prende "Visita" en el lead)

  -- programada -> realizada
  estatus text not null default 'programada' check (estatus in ('programada','realizada')),
  realizada_en timestamptz,
  fuera_de_plazo boolean not null default false,   -- se registró después de 48 horas (solo administración)

  -- evidencia (foto del lugar, captura de la videollamada o confirmación por WhatsApp)
  evidencia_tipo text,
  evidencia_url text,
  evidencia_path text,

  -- para la medición
  es_primera boolean not null default false,   -- primera cita realizada y válida con ese cliente

  -- auditoría de admin
  verificada boolean not null default false,
  verificada_por text,
  verificada_en timestamptz,
  anulada boolean not null default false,
  anulada_motivo text,
  anulada_por text,
  anulada_en timestamptz
);
create index if not exists citas_asesor_fecha on public.citas (asesor, fecha);
create index if not exists citas_lead on public.citas (lead_id);

alter table public.citas enable row level security;
drop policy if exists "citas_all" on public.citas;
create policy "citas_all" on public.citas for all using (true) with check (true);

-- Admin → Asesores: correo del asesor + expediente de documentos
alter table public.asesores add column if not exists correo text;

create table if not exists public.asesor_documentos (
  id uuid primary key default gen_random_uuid(),
  asesor text not null,
  nombre text not null,
  tipo text,
  path text not null,
  tamano bigint,
  created_at timestamptz not null default now()
);
create index if not exists asesor_documentos_asesor_idx on public.asesor_documentos (asesor);
alter table public.asesor_documentos enable row level security;
drop policy if exists "asesor_documentos_all" on public.asesor_documentos;
create policy "asesor_documentos_all" on public.asesor_documentos for all using (true) with check (true);

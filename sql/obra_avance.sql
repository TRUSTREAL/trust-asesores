-- Proyectos → Obra: avance de obra por proyecto (% por etapa)
create table if not exists public.obra_avance (
  proyecto_id text primary key,
  excavacion int not null default 0,
  sotanos int not null default 0,
  estructura int not null default 0,
  acabados int not null default 0,
  escrituracion int not null default 0,
  notas text,
  updated_at timestamptz not null default now()
);
alter table public.obra_avance enable row level security;
drop policy if exists "obra_avance_all" on public.obra_avance;
create policy "obra_avance_all" on public.obra_avance for all using (true) with check (true);

-- Proyectos → Portales: accesos a portales web de desarrolladores / inmobiliarias con inventario compartido
create table if not exists public.portales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text default 'Desarrollador',
  url text not null,
  usuario text,
  password text,
  logo_url text,
  notas text,
  orden int,
  created_at timestamptz not null default now()
);
alter table public.portales enable row level security;
drop policy if exists "portales_all" on public.portales;
create policy "portales_all" on public.portales for all using (true) with check (true);

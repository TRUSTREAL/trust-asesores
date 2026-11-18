-- Portales: accesos individuales por asesor (usuario / contraseña propios de cada asesor en un portal)
create table if not exists public.portales_accesos (
  id uuid primary key default gen_random_uuid(),
  portal_id text not null,
  asesor text not null,
  usuario text,
  password text,
  created_at timestamptz not null default now(),
  unique (portal_id, asesor)
);
alter table public.portales_accesos enable row level security;
drop policy if exists "portales_accesos_all" on public.portales_accesos;
create policy "portales_accesos_all" on public.portales_accesos for all using (true) with check (true);

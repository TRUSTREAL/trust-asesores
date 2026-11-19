-- Portal del desarrollador (/desarrollador/): objetivos de venta, contactos y documentos de clientes.
-- 1) Objetivo de ventas por proyecto (unidades por mes) en la liga del desarrollador
alter table public.dev_links add column if not exists meta_mensual numeric;
alter table public.dev_links add column if not exists meta_desde date;

-- 2) Contacto de clientes (teléfono, correo, notas) por proyecto
create table if not exists public.dev_clientes (
  id uuid primary key default gen_random_uuid(),
  proyecto text not null,
  cliente text not null,
  nombre text,
  telefono text,
  correo text,
  notas text,
  updated_at timestamptz not null default now(),
  unique (proyecto, cliente)
);
alter table public.dev_clientes enable row level security;
drop policy if exists "dev_clientes_all" on public.dev_clientes;
create policy "dev_clientes_all" on public.dev_clientes for all using (true) with check (true);

-- 3) Repositorio de documentos por cliente (archivos en el bucket "documentos", carpeta clientes/)
create table if not exists public.dev_cliente_docs (
  id uuid primary key default gen_random_uuid(),
  proyecto text not null,
  cliente text not null,
  cliente_nombre text,
  nombre text not null,
  tipo text,
  url text not null,
  path text,
  subido_por text,
  created_at timestamptz not null default now()
);
create index if not exists dev_cliente_docs_proy on public.dev_cliente_docs (proyecto, cliente);
alter table public.dev_cliente_docs enable row level security;
drop policy if exists "dev_cliente_docs_all" on public.dev_cliente_docs;
create policy "dev_cliente_docs_all" on public.dev_cliente_docs for all using (true) with check (true);

-- 4) Liga del portal para Balcana (prueba piloto)
insert into public.dev_links (proyecto, key, activo)
select 'Balcana', 'balcan-ykTjOI5cLpyE', true
where not exists (select 1 from public.dev_links where proyecto = 'Balcana');

-- Mercado: base informativa de proyectos de la ciudad (cat = 'Mercado') — sin unidades ni cotización
alter table public.proyectos add column if not exists zona text;
alter table public.proyectos add column if not exists precio_desde numeric;
alter table public.proyectos add column if not exists inmobiliaria text;
alter table public.proyectos add column if not exists link text;

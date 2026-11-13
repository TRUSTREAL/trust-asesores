-- Proyectos: videos de YouTube por proyecto (píldora "Video" en Proyectos, asesores y brokers)
alter table public.proyectos add column if not exists videos jsonb not null default '[]'::jsonb;

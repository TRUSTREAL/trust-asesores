-- Brokers aliados: asesor TRUST que registró / trajo al broker (se elige en Admin → Brokers)
alter table public.brokers add column if not exists registrado_por text;

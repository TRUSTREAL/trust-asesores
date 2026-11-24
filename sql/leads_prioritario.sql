-- Mis leads: "fueguito" para marcar un lead como más importante que otros.
-- Solo agrega una columna; no modifica datos existentes de leads.
alter table public.leads add column if not exists prioritario boolean not null default false;

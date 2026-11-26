-- Listings: el admin puede poner una propiedad en "apartado".
-- Sigue activa (conserva ficha, lona, etc.) pero deja de mostrarse en "Disponibles" y en Brokerage.
alter table public.listings add column if not exists apartado boolean not null default false;
alter table public.listings add column if not exists apartado_en timestamptz;

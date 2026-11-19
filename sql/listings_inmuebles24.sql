-- Listings: marcar si la propiedad está dada de alta en Inmuebles24 (portal principal)
alter table public.listings add column if not exists en_inmuebles24 boolean not null default false;

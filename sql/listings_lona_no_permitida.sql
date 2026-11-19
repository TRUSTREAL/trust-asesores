-- Listings: lona no permitida por el propietario (con motivo)
alter table public.listings add column if not exists lona_no_permitida boolean not null default false;
alter table public.listings add column if not exists lona_motivo text;

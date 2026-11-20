-- Listings: el admin puede cambiar a mano la etapa de la lona (adelante o atrás)
alter table public.listings add column if not exists lona_colocada boolean;      -- null = automático por evidencia · true = colocada · false = regresada a mano
alter table public.listings add column if not exists lona_etapa_en timestamptz;  -- cuándo se cambió la etapa a mano

-- Cobranza: control de facturación independiente del estatus de cobro
alter table public.ventas add column if not exists facturado boolean not null default false;

-- Ventas que se hayan marcado con el estatus "facturado" de la versión anterior
update public.ventas set facturado = true, cobro_estatus = 'pendiente' where cobro_estatus = 'facturado';

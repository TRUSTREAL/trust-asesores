-- Cumpleaños del asesor (MM-DD); se felicita en el menú de asesores
alter table public.asesores add column if not exists cumple text;
update public.asesores set cumple = '11-18' where nombre = 'Ana Lu';

begin;
alter table public.usuarios_locales add column if not exists password_hash text;
create table if not exists public.sesiones_locales (
  token_hash text primary key,
  usuario_id uuid not null references public.usuarios_locales(id) on delete cascade,
  vence_en timestamptz not null
);
create index if not exists sesiones_locales_usuario_idx on public.sesiones_locales(usuario_id);
grant select, insert, delete on public.sesiones_locales to sigep_editor;
commit;

-- Esegui tutto in Supabase: SQL Editor > New query > Run

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, new.raw_user_meta_data->>'nome');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_approved() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false)
$$;

create table public.provvedimenti (
  id bigint generated always as identity primary key,
  cu_numero int not null,
  cu_data date,
  cu_url text,
  competizione text not null default '',
  prima_squadra boolean not null default true,
  gara_data date not null,
  categoria text not null,      -- calciatore, dirigente, allenatore, massaggiatore, societa
  squadra text not null default 'Marina',
  nome text not null,           -- come scritto nel comunicato (COGNOME NOME)
  tipo text not null,           -- ammonizione, espulsione, squalifica, inibizione, ammenda, altro
  sanzione text not null default '',
  fino_al date,
  motivo text,
  unique (cu_numero, competizione, gara_data, nome, sanzione, squadra)
);

create table public.cu_processati (
  numero int primary key,
  data date,
  url text,
  letti int,                    -- provvedimenti letti in totale (tutte le squadre)
  trovati int,                  -- di cui riferiti al girone M (tutte le squadre)
  esaminato_il timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.provvedimenti enable row level security;
alter table public.cu_processati enable row level security;

create policy "profilo proprio o admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "solo admin aggiorna" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());
create policy "solo approvati leggono" on public.provvedimenti for select
  using (public.is_approved());
create policy "solo approvati leggono" on public.cu_processati for select
  using (public.is_approved());
-- Nessuna policy di insert/update/delete: scrive solo lo script con la chiave service_role.

-- Comunicati gia' letti a mano: CU 21 nessun provvedimento nel girone M; CU 22 due squalifiche (sotto)
insert into public.cu_processati (numero, data, url, letti, trovati) values
 (21, '2026-09-24', 'https://toscana.lnd.it/wp-content/uploads/2026/09/CU-CRT-21-DEL-24-09-2026-1.pdf', null, 0),
 (22, '2026-10-01', 'https://toscana.lnd.it/wp-content/uploads/2026/10/CU-CRT-22-DEL-01-10-2026.pdf', null, 2)
on conflict do nothing;

insert into public.provvedimenti (cu_numero, cu_data, cu_url, competizione, prima_squadra, gara_data, categoria, squadra, nome, tipo, sanzione, motivo) values
 (22, '2026-10-01', 'https://toscana.lnd.it/wp-content/uploads/2026/10/CU-CRT-22-DEL-01-10-2026.pdf', 'SECONDA CATEGORIA', true, '2026-09-27', 'calciatore', 'Capalbio', 'PICCHIANTI SIMONE', 'espulsione', 'Squalifica per una gara effettiva', ''),
 (22, '2026-10-01', 'https://toscana.lnd.it/wp-content/uploads/2026/10/CU-CRT-22-DEL-01-10-2026.pdf', 'SECONDA CATEGORIA', true, '2026-09-27', 'calciatore', 'Paganico', 'NIGIDO MATTIA', 'espulsione', 'Squalifica per una gara effettiva', '')
on conflict do nothing;

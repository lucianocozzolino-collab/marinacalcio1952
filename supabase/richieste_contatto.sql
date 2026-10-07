-- Modulo "Diventa sponsor": chiunque puo' inviare, solo l'amministratore legge.
create table if not exists public.richieste_contatto (
  id bigint generated always as identity primary key,
  creato_il timestamptz not null default now(),
  tipo text not null default 'sponsor',
  nome text not null check (char_length(nome) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono text check (char_length(telefono) <= 40),
  messaggio text not null check (char_length(messaggio) between 5 and 2000),
  letto boolean not null default false
);
alter table public.richieste_contatto enable row level security;
drop policy if exists "chiunque puo inviare" on public.richieste_contatto;
drop policy if exists "admin legge" on public.richieste_contatto;
drop policy if exists "admin aggiorna" on public.richieste_contatto;
drop policy if exists "admin elimina" on public.richieste_contatto;
create policy "chiunque puo inviare" on public.richieste_contatto for insert to anon, authenticated
  with check (tipo = 'sponsor' and letto = false);
create policy "admin legge" on public.richieste_contatto for select using (public.is_admin());
create policy "admin aggiorna" on public.richieste_contatto for update using (public.is_admin()) with check (public.is_admin());
create policy "admin elimina" on public.richieste_contatto for delete using (public.is_admin());

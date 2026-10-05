-- Solo se avevi gia' eseguito la versione precedente di setup.sql. Si puo' rilanciare senza danni.
alter table public.provvedimenti add column if not exists squadra text not null default 'Marina';
alter table public.provvedimenti drop constraint if exists provvedimenti_cu_numero_competizione_gara_data_nome_sanzione_key;
alter table public.provvedimenti drop constraint if exists prov_unico;
alter table public.provvedimenti add constraint prov_unico unique (cu_numero, competizione, gara_data, nome, sanzione, squadra);
update public.cu_processati set trovati = 2 where numero = 22 and letti is null;

insert into public.provvedimenti (cu_numero, cu_data, cu_url, competizione, prima_squadra, gara_data, categoria, squadra, nome, tipo, sanzione, motivo) values
 (22, '2026-10-01', 'https://toscana.lnd.it/wp-content/uploads/2026/10/CU-CRT-22-DEL-01-10-2026.pdf', 'SECONDA CATEGORIA', true, '2026-09-27', 'calciatore', 'Capalbio', 'PICCHIANTI SIMONE', 'espulsione', 'Squalifica per una gara effettiva', ''),
 (22, '2026-10-01', 'https://toscana.lnd.it/wp-content/uploads/2026/10/CU-CRT-22-DEL-01-10-2026.pdf', 'SECONDA CATEGORIA', true, '2026-09-27', 'calciatore', 'Paganico', 'NIGIDO MATTIA', 'espulsione', 'Squalifica per una gara effettiva', '')
on conflict do nothing;

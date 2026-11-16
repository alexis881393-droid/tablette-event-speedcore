-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.
-- Tables préfixées "sc_" : aucun conflit avec le site de compta.

create table if not exists sc_kv (
  key   text primary key,
  value jsonb not null
);

create table if not exists sc_votes (
  car_id text primary key,
  count  integer not null default 0
);

create or replace function sc_vote(p_car text) returns void
language sql as $$
  insert into sc_votes (car_id, count) values (p_car, 1)
  on conflict (car_id) do update set count = sc_votes.count + 1;
$$;

-- RLS activé sans politique : seul le serveur (clé secrète) peut lire/écrire.
-- Les numéros de téléphone ne sont donc pas accessibles depuis un navigateur.
alter table sc_kv enable row level security;
alter table sc_votes enable row level security;

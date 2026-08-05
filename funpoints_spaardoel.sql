-- ============================================================
--  Funpoints · persoonlijk spaardoel per kraam
--  Draai één keer in de Supabase SQL-editor. Idempotent.
--  Elke bezoeker kan per kraam één eigen spaardoel zetten
--  (naam + puntendoel), naast de hoofdprijs van de uitbater.
-- ============================================================

create table if not exists spaardoel (
  id           uuid primary key default gen_random_uuid(),
  bezoeker_id  uuid not null references bezoeker(id)  on delete cascade,
  attractie_id uuid not null references attractie(id) on delete cascade,
  naam         text not null,
  punten       int  not null,
  created_at   timestamptz not null default now(),
  unique (bezoeker_id, attractie_id)
);

alter table spaardoel enable row level security;
drop policy if exists "spaardoel eigen zien" on spaardoel;
create policy "spaardoel eigen zien" on spaardoel for select
  using (bezoeker_id = huidige_bezoeker_id());
grant select on spaardoel to authenticated;

-- Zet (of wijzig) je spaardoel voor een kraam.
create or replace function zet_spaardoel(p_attractie_id uuid, p_naam text, p_punten int)
  returns void language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if coalesce(trim(p_naam), '') = '' then raise exception 'NAAM_LEEG'; end if;
  if p_punten is null or p_punten <= 0 then raise exception 'PUNTEN_ONGELDIG'; end if;

  insert into spaardoel (bezoeker_id, attractie_id, naam, punten)
  values (v_bez, p_attractie_id, trim(p_naam), p_punten)
  on conflict (bezoeker_id, attractie_id)
  do update set naam = excluded.naam, punten = excluded.punten;
end $$;

-- Wis je spaardoel voor een kraam.
create or replace function wis_spaardoel(p_attractie_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;
  delete from spaardoel where bezoeker_id = v_bez and attractie_id = p_attractie_id;
end $$;

grant execute on function zet_spaardoel(uuid, text, int) to authenticated;
grant execute on function wis_spaardoel(uuid)            to authenticated;

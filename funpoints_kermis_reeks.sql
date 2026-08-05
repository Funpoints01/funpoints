-- ============================================================
--  Funpoints · kermissen als blijvende reeks + editie per jaar
--  Draai één keer in de Supabase SQL-editor. Idempotent.
--
--  Model:
--   kermis_reeks  = de blijvende kermis (bv. "Sinksenfoor Antwerpen")
--   kermis        = een editie/jaar van die reeks (met eigen van/tot)
--   kermis.reeks_id koppelt de editie aan de reeks
-- ============================================================

-- 1) De blijvende kermis-reeks (catalogus, doorzoekbaar door iedereen).
create table if not exists kermis_reeks (
  id         uuid primary key default gen_random_uuid(),
  naam       text not null,
  plaats     text,
  postcode   text,
  created_at timestamptz not null default now()
);
alter table kermis_reeks enable row level security;
drop policy if exists "kermis_reeks leesbaar" on kermis_reeks;
create policy "kermis_reeks leesbaar" on kermis_reeks for select using (true);
grant select on kermis_reeks to authenticated;

alter table kermis add column if not exists reeks_id uuid references kermis_reeks(id);

-- 2) Zorg dat een kraam maar één keer aan een editie hangt.
delete from kermis_attractie a using kermis_attractie b
 where a.ctid < b.ctid and a.kermis_id = b.kermis_id and a.attractie_id = b.attractie_id;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kermis_attractie_uniek') then
    alter table kermis_attractie add constraint kermis_attractie_uniek unique (kermis_id, attractie_id);
  end if;
end $$;

-- 3) Backfill: maak voor elke bestaande kermis(-groep) een reeks en koppel ze.
--    Groeperen op plaats (of naam als plaats leeg is).
do $$
declare r record; v_reeks uuid; v_naam text; v_plaats text; v_pc text;
begin
  for r in
    select distinct lower(coalesce(nullif(plaats, ''), naam)) as sleutel
    from kermis where reeks_id is null
  loop
    select naam, plaats, postcode into v_naam, v_plaats, v_pc
      from kermis
      where lower(coalesce(nullif(plaats, ''), naam)) = r.sleutel
      order by van
      limit 1;
    insert into kermis_reeks (naam, plaats, postcode)
      values (v_naam, v_plaats, v_pc)
      returning id into v_reeks;
    update kermis set reeks_id = v_reeks
      where lower(coalesce(nullif(plaats, ''), naam)) = r.sleutel and reeks_id is null;
  end loop;
end $$;

-- 4) Plan een editie van een BESTAANDE reeks + hang je kraam eraan.
--    Bestaat er dit jaar al een editie, dan sluit je kraam daarbij aan
--    (met de reeds ingestelde datum). Zo niet, dan maak je ze met jouw datum.
create or replace function plan_kermis_bestaand(p_reeks_id uuid, p_attractie_id uuid, p_van date, p_tot date)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_owner uuid; v_editie uuid; v_naam text; v_plaats text; v_pc text; v_jaar int; v_herbruikt boolean := false; v_van date; v_tot date;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  select uitbater_id into v_owner from attractie where id = p_attractie_id;
  if v_owner is distinct from v_uit then raise exception 'NIET_JOUW_ATTRACTIE'; end if;

  select naam, plaats, postcode into v_naam, v_plaats, v_pc from kermis_reeks where id = p_reeks_id;
  if v_naam is null then raise exception 'REEKS_ONBEKEND'; end if;

  v_jaar := extract(year from p_van);
  select id, van, tot into v_editie, v_van, v_tot
    from kermis
    where reeks_id = p_reeks_id and extract(year from van) = v_jaar
    order by van limit 1;

  if v_editie is null then
    insert into kermis (naam, plaats, postcode, van, tot, reeks_id)
    values (v_naam, v_plaats, v_pc, p_van, p_tot, p_reeks_id)
    returning id, van, tot into v_editie, v_van, v_tot;
  else
    v_herbruikt := true;
  end if;

  insert into kermis_attractie (kermis_id, attractie_id)
  values (v_editie, p_attractie_id)
  on conflict do nothing;

  return json_build_object('editie_id', v_editie, 'van', v_van, 'tot', v_tot, 'herbruikt', v_herbruikt);
end $$;

-- 5) Maak een NIEUWE reeks + editie + koppel je kraam.
create or replace function plan_kermis_nieuw(p_naam text, p_plaats text, p_postcode text, p_attractie_id uuid, p_van date, p_tot date)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_owner uuid; v_reeks uuid; v_editie uuid;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  select uitbater_id into v_owner from attractie where id = p_attractie_id;
  if v_owner is distinct from v_uit then raise exception 'NIET_JOUW_ATTRACTIE'; end if;
  if coalesce(trim(p_naam), '') = '' then raise exception 'NAAM_LEEG'; end if;

  insert into kermis_reeks (naam, plaats, postcode)
  values (trim(p_naam), nullif(trim(p_plaats), ''), nullif(trim(p_postcode), ''))
  returning id into v_reeks;

  insert into kermis (naam, plaats, postcode, van, tot, reeks_id)
  values (trim(p_naam), nullif(trim(p_plaats), ''), nullif(trim(p_postcode), ''), p_van, p_tot, v_reeks)
  returning id into v_editie;

  insert into kermis_attractie (kermis_id, attractie_id) values (v_editie, p_attractie_id);

  return json_build_object('reeks_id', v_reeks, 'editie_id', v_editie);
end $$;

grant execute on function plan_kermis_bestaand(uuid, uuid, date, date) to authenticated;
grant execute on function plan_kermis_nieuw(text, text, text, uuid, date, date) to authenticated;

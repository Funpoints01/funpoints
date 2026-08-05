-- ============================================================
--  Funpoints · agenda + bezoekers = één gedeelde lijst (kermis)
--  1) functies om als uitbater een kermis te plannen / te wissen
--  2) migratie van de oude 'locatie'-tabel naar 'kermis'
--  Draai één keer in de Supabase SQL-editor. Idempotent.
-- ============================================================

-- 1a) Kermis plannen vanuit de uitbater-agenda.
--     Controleert dat de attractie van de ingelogde uitbater is.
create or replace function plan_kermis(
  p_attractie_id uuid,
  p_naam         text,
  p_plaats       text,
  p_postcode     text,
  p_van          date,
  p_tot          date
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_owner uuid; v_kermis uuid;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;

  select uitbater_id into v_owner from attractie where id = p_attractie_id;
  if v_owner is null then raise exception 'ATTRACTIE_ONBEKEND'; end if;
  if v_owner <> v_uit then raise exception 'NIET_JOUW_ATTRACTIE'; end if;

  insert into kermis (naam, plaats, postcode, van, tot)
  values (p_naam, nullif(p_plaats, ''), nullif(p_postcode, ''), p_van, p_tot)
  returning id into v_kermis;

  insert into kermis_attractie (kermis_id, attractie_id)
  values (v_kermis, p_attractie_id);

  return v_kermis;
end $$;

-- 1b) Koppeling wissen. Als er geen enkel kraam meer aan de kermis hangt,
--     wordt de kermis zelf ook verwijderd (zodat bezoekers geen lege kermis zien).
create or replace function verwijder_kermis_koppeling(p_kermis_id uuid, p_attractie_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_owner uuid; v_rest int;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;

  select uitbater_id into v_owner from attractie where id = p_attractie_id;
  if v_owner is distinct from v_uit then raise exception 'NIET_JOUW_ATTRACTIE'; end if;

  delete from kermis_attractie where kermis_id = p_kermis_id and attractie_id = p_attractie_id;

  select count(*) into v_rest from kermis_attractie where kermis_id = p_kermis_id;
  if v_rest = 0 then
    delete from kermis where id = p_kermis_id;
  end if;
end $$;

grant execute on function plan_kermis(uuid, text, text, text, date, date) to authenticated;
grant execute on function verwijder_kermis_koppeling(uuid, uuid)          to authenticated;

-- 2) Migratie: bestaande 'locatie'-rijen overzetten naar kermis + koppeling.
--    Idempotent: slaat over wat al gekoppeld is (zelfde naam + startdatum).
do $$
declare r record; v_kermis uuid;
begin
  if to_regclass('public.locatie') is null then return; end if;

  for r in select l.attractie_id, l.naam, l.van, l.tot from locatie l loop
    if not exists (
      select 1 from kermis k
        join kermis_attractie ka on ka.kermis_id = k.id
      where ka.attractie_id = r.attractie_id and k.naam = r.naam and k.van = r.van
    ) then
      insert into kermis (naam, plaats, van, tot)
      values (r.naam, r.naam, r.van, r.tot)
      returning id into v_kermis;

      insert into kermis_attractie (kermis_id, attractie_id)
      values (v_kermis, r.attractie_id);
    end if;
  end loop;
end $$;

-- ============================================================
--  Funpoints · superster-banner v2 (geactiveerd, getimed, getarget)
--  Run dit één keer in de Supabase SQL Editor.
--  (Vervangt het simpele superster-vinkje uit de vorige migratie.)
-- ============================================================

alter table actie add column if not exists superster_tot        timestamptz;
alter table actie add column if not exists superster_provincies text[];

-- Uitbater activeert de superster-banner voor 4, 8 of 12 uur, gericht op een
-- regio. Kost 10 credits per uur.
create or replace function activeer_superster(p_actie_id uuid, p_uren int, p_provincies text[])
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_owner uuid; v_kost int; v_saldo int; v_tot timestamptz;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if p_uren not in (4, 8, 12) then raise exception 'ONGELDIGE_DUUR'; end if;

  select a.uitbater_id into v_owner
    from actie ac join attractie a on a.id = ac.attractie_id
    where ac.id = p_actie_id;
  if v_owner is null then raise exception 'ACTIE_ONBEKEND'; end if;
  if v_owner <> v_uit then raise exception 'NIET_JOUW_ACTIE'; end if;

  v_kost := p_uren * 10;
  select credits into v_saldo from uitbater where id = v_uit;
  if v_saldo < v_kost then raise exception 'ONVOLDOENDE_CREDITS'; end if;

  update uitbater set credits = credits - v_kost where id = v_uit returning credits into v_saldo;
  v_tot := now() + (p_uren || ' hours')::interval;
  update actie set superster_tot = v_tot, superster_provincies = p_provincies where id = p_actie_id;

  return json_build_object('superster_tot', v_tot, 'credits', v_saldo, 'kost', v_kost);
end $$;

-- Bezoeker: de actieve superster-actie voor déze bezoeker (op basis van zijn regio).
create or replace function actieve_superster()
  returns json language plpgsql security definer set search_path = public as $$
declare v_bez uuid; v_prov text; v_row record;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return null; end if;
  select provincie_van(postcode) into v_prov from bezoeker where id = v_bez;

  select ac.id, ac.attractie_id, ac.titel, ac.beschrijving, ac.eenmalig, attr.naam as kraam
    into v_row
  from actie ac join attractie attr on attr.id = ac.attractie_id
  where ac.superster_tot is not null and ac.superster_tot > now()
    and ac.actief and ac.tot >= current_date
    and (ac.superster_provincies is null or v_prov = any(ac.superster_provincies))
  order by ac.superster_tot desc
  limit 1;

  if v_row.id is null then return null; end if;
  return json_build_object('id', v_row.id, 'attractie_id', v_row.attractie_id, 'titel', v_row.titel,
                           'beschrijving', v_row.beschrijving, 'eenmalig', v_row.eenmalig, 'kraam', v_row.kraam);
end $$;

grant execute on function activeer_superster(uuid, int, text[]) to authenticated;
grant execute on function actieve_superster()                   to authenticated;

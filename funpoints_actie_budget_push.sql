-- ============================================================
--  Funpoints · budgetplafond op bereik + provincie-push + auto-versturen.
--  ------------------------------------------------------------
--  * De uitbater kan een MAX aantal personen instellen. Kost =
--    min(doelgroep, max) × tarief (basis 1 + add-ons).
--  * Push targeting op provincie (i.p.v. straal) voor acties, met de
--    dagcap (max 3/bezoeker/dag) én het budgetplafond (max ontvangers).
--  * Goedkeuren van een actie met push maakt automatisch een
--    provincie-campagne aan; de app roept dan verstuur-push op.
--  Idempotent. Draai NA funpoints_actie_validatie.sql,
--  funpoints_push_limiet.sql en funpoints_superster_rotatie.sql.
-- ============================================================

-- 1) Kolommen voor het plafond.
alter table actie         add column if not exists max_bereik int;
alter table push_campagne add column if not exists max_bereik int;
alter table push_campagne add column if not exists provincies text[];
alter table push_campagne alter column center_postcode drop not null;
alter table push_campagne alter column radius drop not null;

-- 2) Indienen met budgetplafond: kost = min(doelgroep, max) × tarief.
drop function if exists actie_indienen(uuid, text, text, text, int, int, text, boolean, date, date, boolean, text[], text, boolean, boolean, boolean);
create or replace function actie_indienen(
  p_attractie_id uuid, p_titel text, p_beschrijving text, p_soort text,
  p_bonus_pct int, p_bonus_vast int, p_bonus_modus text, p_automatisch boolean,
  p_van date, p_tot date, p_eenmalig boolean,
  p_doel_provincies text[], p_doel_segment text,
  p_uitlichten boolean, p_superster boolean, p_push boolean,
  p_max_bereik int default null)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_doel int; v_eff int; v_perp int; v_kost int; v_saldo int; v_id uuid;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if not exists (select 1 from attractie where id = p_attractie_id and uitbater_id = v_uit) then
    raise exception 'NIET_JOUW_KRAAM';
  end if;

  select coalesce(tel_actie_doelgroep(p_doel_provincies, p_doel_segment, p_attractie_id), 0) into v_doel;
  -- Plafond: 0/null = geen plafond.
  v_eff := least(v_doel, coalesce(nullif(p_max_bereik, 0), v_doel));
  v_perp := actie_prijs_per_persoon(p_uitlichten, p_superster, p_push);
  v_kost := v_eff * v_perp;

  select credits into v_saldo from uitbater where id = v_uit;
  if v_saldo < v_kost then raise exception 'ONVOLDOENDE_CREDITS'; end if;
  update uitbater set credits = credits - v_kost where id = v_uit returning credits into v_saldo;

  insert into actie (attractie_id, titel, beschrijving, soort, bonus_pct, bonus_vast,
                     bonus_modus, automatisch, van, tot, eenmalig,
                     doel_provincies, doel_segment, actief, status, kost_credits, bereik, max_bereik,
                     wil_uitlichten, wil_superster, wil_push, ingediend_op)
  values (p_attractie_id, p_titel, p_beschrijving, p_soort, p_bonus_pct, p_bonus_vast,
          p_bonus_modus, p_automatisch, p_van, p_tot, p_eenmalig,
          p_doel_provincies, p_doel_segment, false, 'ingediend', v_kost, v_eff, nullif(p_max_bereik, 0),
          p_uitlichten, p_superster, p_push, now())
  returning id into v_id;

  return json_build_object('actie_id', v_id, 'kost', v_kost, 'bereik', v_eff,
                           'doelgroep', v_doel, 'per_persoon', v_perp, 'credits', v_saldo);
end $$;
grant execute on function actie_indienen(uuid, text, text, text, int, int, text, boolean, date, date, boolean, text[], text, boolean, boolean, boolean, int) to authenticated;

-- 3) Ontvangers: provincie- of straal-pad, met dagcap én budgetplafond (LIMIT).
create or replace function campagne_ontvangers(p_campagne_id uuid)
  returns table(endpoint text, p256dh text, auth text)
  language plpgsql security definer set search_path = public as $$
declare v_prov text[]; v_max int; c_lat double precision; c_lon double precision; v_rad int;
begin
  select c.provincies, c.max_bereik, pcc.lat, pcc.lon, c.radius
    into v_prov, v_max, c_lat, c_lon, v_rad
  from push_campagne c
  left join postcode_coord pcc on pcc.postcode = c.center_postcode
  where c.id = p_campagne_id;
  if v_prov is null and c_lat is null then return; end if;

  return query
  with basis as (
    select distinct b.id as bezoeker_id
    from bezoeker b
    join push_subscription ps on ps.bezoeker_id = b.id
    left join postcode_coord pc on pc.postcode = pc_norm(b.postcode)
    where (
      (v_prov is not null and provincie_van(b.postcode) = any(v_prov))
      or (v_prov is null and pc.lat is not null and afstand_km(c_lat, c_lon, pc.lat, pc.lon) <= v_rad)
    )
  ),
  kandidaten as (
    select bezoeker_id from basis bb
    where (select count(*) from push_ontvangst po
             where po.bezoeker_id = bb.bezoeker_id and po.dag = current_date) < 3
      and not exists (select 1 from push_ontvangst po
             where po.bezoeker_id = bb.bezoeker_id and po.campagne_id = p_campagne_id)
    limit v_max   -- null = geen plafond
  ),
  ingeschreven as (
    insert into push_ontvangst (bezoeker_id, campagne_id)
    select bezoeker_id, p_campagne_id from kandidaten
    on conflict do nothing
    returning bezoeker_id
  )
  select ps.endpoint, ps.p256dh, ps.auth
  from ingeschreven i
  join push_subscription ps on ps.bezoeker_id = i.bezoeker_id;
end $$;

-- 4) Goedkeuren maakt bij push een provincie-campagne mét plafond aan.
drop function if exists mgmt_actie_goedkeuren(uuid);
create or replace function mgmt_actie_goedkeuren(p_id uuid)
  returns json language plpgsql security definer set search_path = public as $$
declare v_push boolean; v_prov text[]; v_max int; v_camp uuid;
begin
  if not is_manager() then raise exception 'NIET_GEMACHTIGD'; end if;
  update actie set
    status = 'goedgekeurd',
    actief = true,
    boost_tot = case when wil_uitlichten then (tot::timestamptz + interval '1 day') else boost_tot end,
    superster = case when wil_superster then true else superster end,
    superster_tot = case when wil_superster then (tot::timestamptz + interval '1 day') else superster_tot end,
    superster_provincies = case when wil_superster then doel_provincies else superster_provincies end
  where id = p_id and status = 'ingediend'
  returning wil_push, doel_provincies, max_bereik into v_push, v_prov, v_max;
  if not found then raise exception 'ONBEKEND_OF_AL_BEHANDELD'; end if;

  if coalesce(v_push, false) then
    insert into push_campagne (actie_id, provincies, max_bereik)
    values (p_id, v_prov, v_max) returning id into v_camp;
  end if;
  return json_build_object('campagne_id', v_camp);
end $$;
grant execute on function mgmt_actie_goedkeuren(uuid) to authenticated;

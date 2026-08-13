-- ============================================================
--  Funpoints · ACTIES — geconsolideerd script (hele feature).
--  ------------------------------------------------------------
--  Draai dit ENE bestand in de Supabase SQL-editor. Het bundelt,
--  in de juiste volgorde, alle onderdelen van de actie-feature:
--    · validatie-workflow + credit-reservering
--    · pushlimiet (max 3/bezoeker/dag)
--    · push op provincie/straal + ontvangers-cap
--    · acties op km-straal + vast tarief (100 credits/actie)
--    · promoties op goedgekeurde acties (uitlichten/superster/push)
--  Alles is idempotent; latere delen overschrijven bewust de
--  eerdere (tussen)versies, zodat de eindtoestand klopt.
-- ============================================================


-- ############################################################
-- ##  funpoints_actie_validatie
-- ############################################################

-- ============================================================
--  Funpoints · actie-validatie + creditkost (fase 1)
--  ------------------------------------------------------------
--  * Nieuwe acties worden INGEDIEND (actief=false → onzichtbaar) en
--    moeten door het management goedgekeurd worden.
--  * Prijs = bereik (doelgroep bij indienen) × (basis 1 + add-ons:
--    uitlichten +2, superster +3, push +5) per persoon.
--  * Credits worden bij indienen gereserveerd (afgeboekt), bij
--    goedkeuring definitief, bij afkeuring teruggezet.
--  * Bestaande acties krijgen status 'goedgekeurd' (blijven live).
--  Idempotent. Draai in de Supabase SQL-editor.
-- ============================================================

-- 1) Kolommen
alter table actie add column if not exists status text not null default 'goedgekeurd';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'actie_status_check') then
    alter table actie add constraint actie_status_check
      check (status in ('ingediend', 'goedgekeurd', 'afgekeurd'));
  end if;
end $$;
alter table actie add column if not exists afkeur_reden  text;
alter table actie add column if not exists kost_credits  int not null default 0;
alter table actie add column if not exists bereik        int;
alter table actie add column if not exists wil_uitlichten boolean not null default false;
alter table actie add column if not exists wil_superster  boolean not null default false;
alter table actie add column if not exists wil_push       boolean not null default false;
alter table actie add column if not exists ingediend_op   timestamptz;

-- 2) Prijs per persoon op basis van de gekozen add-ons.
create or replace function actie_prijs_per_persoon(p_uitlichten boolean, p_superster boolean, p_push boolean)
  returns int language sql immutable as $$
  select 1
       + case when p_uitlichten then 2 else 0 end
       + case when p_superster  then 3 else 0 end
       + case when p_push       then 5 else 0 end
$$;

-- 3) Uitbater dient een actie in (vervangt de directe insert).
create or replace function actie_indienen(
  p_attractie_id uuid, p_titel text, p_beschrijving text, p_soort text,
  p_bonus_pct int, p_bonus_vast int, p_bonus_modus text, p_automatisch boolean,
  p_van date, p_tot date, p_eenmalig boolean,
  p_doel_provincies text[], p_doel_segment text,
  p_uitlichten boolean, p_superster boolean, p_push boolean)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_bereik int; v_perp int; v_kost int; v_saldo int; v_id uuid;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if not exists (select 1 from attractie where id = p_attractie_id and uitbater_id = v_uit) then
    raise exception 'NIET_JOUW_KRAAM';
  end if;

  -- Bereik = doelgroep-telling bij indienen (server-side, niet te omzeilen).
  select coalesce(tel_actie_doelgroep(p_doel_provincies, p_doel_segment, p_attractie_id), 0) into v_bereik;
  v_perp := actie_prijs_per_persoon(p_uitlichten, p_superster, p_push);
  v_kost := v_perp * v_bereik;

  select credits into v_saldo from uitbater where id = v_uit;
  if v_saldo < v_kost then raise exception 'ONVOLDOENDE_CREDITS'; end if;
  update uitbater set credits = credits - v_kost where id = v_uit returning credits into v_saldo;

  insert into actie (attractie_id, titel, beschrijving, soort, bonus_pct, bonus_vast,
                     bonus_modus, automatisch, van, tot, eenmalig,
                     doel_provincies, doel_segment, actief, status, kost_credits, bereik,
                     wil_uitlichten, wil_superster, wil_push, ingediend_op)
  values (p_attractie_id, p_titel, p_beschrijving, p_soort, p_bonus_pct, p_bonus_vast,
          p_bonus_modus, p_automatisch, p_van, p_tot, p_eenmalig,
          p_doel_provincies, p_doel_segment, false, 'ingediend', v_kost, v_bereik,
          p_uitlichten, p_superster, p_push, now())
  returning id into v_id;

  return json_build_object('actie_id', v_id, 'kost', v_kost, 'bereik', v_bereik,
                           'per_persoon', v_perp, 'credits', v_saldo);
end $$;
grant execute on function actie_indienen(uuid, text, text, text, int, int, text, boolean, date, date, boolean, text[], text, boolean, boolean, boolean) to authenticated;

-- 4) Management: lijst van in te valideren acties.
create or replace function mgmt_acties_tevalideren()
  returns table(id uuid, titel text, beschrijving text, kraam text, uitbater text,
                van date, tot date, bereik int, kost int,
                uitlichten boolean, superster boolean, push boolean, ingediend_op timestamptz)
  language plpgsql security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'NIET_GEMACHTIGD'; end if;
  return query
  select ac.id, ac.titel, ac.beschrijving, attr.naam, u.naam,
         ac.van, ac.tot, ac.bereik, ac.kost_credits,
         ac.wil_uitlichten, ac.wil_superster, ac.wil_push, ac.ingediend_op
  from actie ac
  join attractie attr on attr.id = ac.attractie_id
  join uitbater  u    on u.id = attr.uitbater_id
  where ac.status = 'ingediend'
  order by ac.ingediend_op;
end $$;
grant execute on function mgmt_acties_tevalideren() to authenticated;

-- 5) Management: goedkeuren → actief + promoties activeren.
create or replace function mgmt_actie_goedkeuren(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'NIET_GEMACHTIGD'; end if;
  update actie set
    status = 'goedgekeurd',
    actief = true,
    boost_tot = case when wil_uitlichten then (tot::timestamptz + interval '1 day') else boost_tot end,
    superster = case when wil_superster then true else superster end,
    superster_tot = case when wil_superster then (tot::timestamptz + interval '1 day') else superster_tot end,
    superster_provincies = case when wil_superster then doel_provincies else superster_provincies end
  where id = p_id and status = 'ingediend';
  if not found then raise exception 'ONBEKEND_OF_AL_BEHANDELD'; end if;
  -- (Push bij wil_push = true volgt in fase 3.)
end $$;
grant execute on function mgmt_actie_goedkeuren(uuid) to authenticated;

-- 6) Management: afkeuren met reden → credits terugbetalen.
create or replace function mgmt_actie_afkeuren(p_id uuid, p_reden text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_kost int; v_uit uuid;
begin
  if not is_manager() then raise exception 'NIET_GEMACHTIGD'; end if;
  if coalesce(trim(p_reden), '') = '' then raise exception 'REDEN_VERPLICHT'; end if;
  update actie set status = 'afgekeurd', afkeur_reden = p_reden
   where id = p_id and status = 'ingediend'
   returning kost_credits into v_kost;
  if not found then raise exception 'ONBEKEND_OF_AL_BEHANDELD'; end if;
  select a.uitbater_id into v_uit from actie ac join attractie a on a.id = ac.attractie_id where ac.id = p_id;
  update uitbater set credits = credits + v_kost where id = v_uit;
end $$;
grant execute on function mgmt_actie_afkeuren(uuid, text) to authenticated;

-- 7) Uitbater: een nog niet-behandelde (of afgekeurde) actie intrekken →
--    credits terug indien nog gereserveerd.
create or replace function actie_intrekken(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_kost int; v_status text;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  select ac.kost_credits, ac.status into v_kost, v_status
  from actie ac join attractie a on a.id = ac.attractie_id
  where ac.id = p_id and a.uitbater_id = v_uit;
  if v_status is null then raise exception 'NIET_JOUW_ACTIE'; end if;
  -- Terugbetalen enkel als de credits nog gereserveerd staan (ingediend).
  if v_status = 'ingediend' then
    update uitbater set credits = credits + v_kost where id = v_uit;
  end if;
  delete from actie where id = p_id;
end $$;
grant execute on function actie_intrekken(uuid) to authenticated;

-- ############################################################
-- ##  funpoints_push_limiet
-- ############################################################

-- ============================================================
--  Funpoints · pushlimiet: max 3 pushmeldingen per bezoeker per dag.
--  ------------------------------------------------------------
--  Een klein ontvangst-logje telt hoeveel campagnes een bezoeker
--  vandaag kreeg. campagne_ontvangers slaat bezoekers over die al
--  aan 3 zitten (of deze campagne al kregen), en registreert de
--  ontvangst meteen. Idempotent. Draai in de Supabase SQL-editor.
-- ============================================================

create table if not exists push_ontvangst (
  bezoeker_id uuid not null,
  campagne_id uuid not null,
  dag         date not null default current_date,
  created_at  timestamptz not null default now(),
  primary key (bezoeker_id, campagne_id)
);
create index if not exists push_ontvangst_bez_dag on push_ontvangst (bezoeker_id, dag);

create or replace function campagne_ontvangers(p_campagne_id uuid)
  returns table(endpoint text, p256dh text, auth text)
  language plpgsql security definer set search_path = public as $$
declare c_lat double precision; c_lon double precision; v_rad int;
begin
  select pcc.lat, pcc.lon, c.radius into c_lat, c_lon, v_rad
    from push_campagne c join postcode_coord pcc on pcc.postcode = c.center_postcode
    where c.id = p_campagne_id;
  if c_lat is null then return; end if;

  return query
  with kandidaten as (
    select distinct b.id as bezoeker_id
    from bezoeker b
    join postcode_coord pc on pc.postcode = pc_norm(b.postcode)
    join push_subscription ps on ps.bezoeker_id = b.id
    where afstand_km(c_lat, c_lon, pc.lat, pc.lon) <= v_rad
      and (select count(*) from push_ontvangst po
             where po.bezoeker_id = b.id and po.dag = current_date) < 3
      and not exists (select 1 from push_ontvangst po
             where po.bezoeker_id = b.id and po.campagne_id = p_campagne_id)
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

-- ############################################################
-- ##  funpoints_actie_budget_push
-- ############################################################

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

-- ############################################################
-- ##  funpoints_actie_km
-- ############################################################

-- ============================================================
--  Funpoints · acties op km-straal (ombouw).
--  ------------------------------------------------------------
--  * Targeting van een actie = postcode + km-straal (i.p.v. provincies).
--  * Basiskost = bereik (bezoekers binnen straal, segment-filter) × 1 credit.
--  * Geen add-ons meer bij het indienen (uitlichten/superster/push worden
--    aparte stappen op een goedgekeurde actie — volgende fase).
--  * zichtbare_acties filtert op straal als die gezet is, anders op de
--    oude provincie-logica (bestaande acties blijven werken).
--  Idempotent. Draai NA funpoints_actie_validatie.sql.
-- ============================================================

alter table actie add column if not exists center_postcode text;
alter table actie add column if not exists radius int;

-- 1) Bereik binnen een km-straal, met segment-filter (t.o.v. het kraam).
create or replace function tel_bereik_km(p_postcode text, p_radius int, p_segment text, p_attractie_id uuid)
  returns int language plpgsql stable security definer set search_path = public as $$
declare c_lat double precision; c_lon double precision; v_n int;
begin
  select lat, lon into c_lat, c_lon from postcode_coord where postcode = pc_norm(p_postcode);
  if c_lat is null then return 0; end if;
  select count(*) into v_n
  from bezoeker b
  join postcode_coord pc on pc.postcode = pc_norm(b.postcode)
  where afstand_km(c_lat, c_lon, pc.lat, pc.lon) <= p_radius
    and (
      coalesce(p_segment, 'iedereen') = 'iedereen'
      or (p_segment = 'bestaande' and exists (select 1 from puntenboeking pb
            where pb.bezoeker_id = b.id and pb.attractie_id = p_attractie_id))
      or (p_segment = 'nieuw' and not exists (select 1 from puntenboeking pb
            where pb.bezoeker_id = b.id and pb.attractie_id = p_attractie_id))
    );
  return coalesce(v_n, 0);
end $$;
grant execute on function tel_bereik_km(text, int, text, uuid) to authenticated;

-- 2) Indienen op km-straal, basiskost = bereik × 1 credit.
drop function if exists actie_indienen(uuid, text, text, text, int, int, text, boolean, date, date, boolean, text[], text, boolean, boolean, boolean);
drop function if exists actie_indienen(uuid, text, text, text, int, int, text, boolean, date, date, boolean, text[], text, boolean, boolean, boolean, int);
create or replace function actie_indienen(
  p_attractie_id uuid, p_titel text, p_beschrijving text, p_soort text,
  p_bonus_pct int, p_bonus_vast int, p_bonus_modus text, p_automatisch boolean,
  p_van date, p_tot date, p_eenmalig boolean,
  p_center_postcode text, p_radius int, p_segment text)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_bereik int; v_kost int; v_saldo int; v_id uuid;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if not exists (select 1 from attractie where id = p_attractie_id and uitbater_id = v_uit) then
    raise exception 'NIET_JOUW_KRAAM';
  end if;

  v_bereik := tel_bereik_km(p_center_postcode, p_radius, p_segment, p_attractie_id);
  v_kost := 100;   -- vast tarief per actie

  select credits into v_saldo from uitbater where id = v_uit;
  if v_saldo < v_kost then raise exception 'ONVOLDOENDE_CREDITS'; end if;
  update uitbater set credits = credits - v_kost where id = v_uit returning credits into v_saldo;

  insert into actie (attractie_id, titel, beschrijving, soort, bonus_pct, bonus_vast,
                     bonus_modus, automatisch, van, tot, eenmalig,
                     center_postcode, radius, doel_segment, actief, status, kost_credits, bereik, ingediend_op)
  values (p_attractie_id, p_titel, p_beschrijving, p_soort, p_bonus_pct, p_bonus_vast,
          p_bonus_modus, p_automatisch, p_van, p_tot, p_eenmalig,
          p_center_postcode, p_radius, p_segment, false, 'ingediend', v_kost, v_bereik, now())
  returning id into v_id;

  return json_build_object('actie_id', v_id, 'kost', v_kost, 'bereik', v_bereik, 'credits', v_saldo);
end $$;
grant execute on function actie_indienen(uuid, text, text, text, int, int, text, boolean, date, date, boolean, text, int, text) to authenticated;

-- 3) Goedkeuren = enkel activeren (promoties zijn nu aparte stappen).
drop function if exists mgmt_actie_goedkeuren(uuid);
create or replace function mgmt_actie_goedkeuren(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'NIET_GEMACHTIGD'; end if;
  update actie set status = 'goedgekeurd', actief = true
   where id = p_id and status = 'ingediend';
  if not found then raise exception 'ONBEKEND_OF_AL_BEHANDELD'; end if;
end $$;
grant execute on function mgmt_actie_goedkeuren(uuid) to authenticated;

-- 4) zichtbare_acties: straal-filter (nieuw) of provincie-filter (oud).
create or replace function zichtbare_acties()
  returns table(id uuid, attractie_id uuid, titel text, beschrijving text, soort text,
                bonus_pct integer, bonus_modus text, bonus_vast integer, van date, tot date,
                boost_tot timestamptz, eenmalig boolean)
  language plpgsql stable security definer set search_path = public as $$
declare v_bez uuid; v_prov text; v_lat double precision; v_lon double precision;
begin
  select b.id, provincie_van(b.postcode), pc.lat, pc.lon
    into v_bez, v_prov, v_lat, v_lon
  from bezoeker b left join postcode_coord pc on pc.postcode = pc_norm(b.postcode)
  where b.auth_user_id = auth.uid();

  return query
  select a.id, a.attractie_id, a.titel, a.beschrijving, a.soort,
         a.bonus_pct, a.bonus_modus, a.bonus_vast, a.van, a.tot, a.boost_tot, a.eenmalig
  from actie a
  left join postcode_coord ac on ac.postcode = a.center_postcode
  where a.actief = true
    and a.tot >= current_date
    and (
      coalesce(a.doel_segment, 'iedereen') = 'iedereen'
      or (a.doel_segment = 'bestaande' and v_bez is not null and exists (
            select 1 from puntenboeking p where p.bezoeker_id = v_bez and p.attractie_id = a.attractie_id))
      or (a.doel_segment = 'nieuw' and (v_bez is null or not exists (
            select 1 from puntenboeking p where p.bezoeker_id = v_bez and p.attractie_id = a.attractie_id)))
    )
    and (
      -- nieuwe acties: km-straal
      (a.center_postcode is not null and ac.lat is not null and v_lat is not null
        and afstand_km(ac.lat, ac.lon, v_lat, v_lon) <= a.radius)
      -- oude acties: provincie (of nationaal)
      or (a.center_postcode is null and
          (a.doel_provincies is null or (v_prov is not null and v_prov = any(a.doel_provincies))))
    )
  order by a.boost_tot desc nulls last, a.van;
end $$;
grant execute on function zichtbare_acties() to authenticated;

-- ############################################################
-- ##  funpoints_actie_promoties
-- ############################################################

-- ============================================================
--  Funpoints · promoties op een GOEDGEKEURDE actie (stuk B).
--  ------------------------------------------------------------
--  Uitlichten (2/p), superster (3/p) en push (5/p): elk met eigen
--  postcode + km-straal, optioneel budgetplafond, meteen afgeboekt.
--  Enkel op een eigen, goedgekeurde actie. Idempotent.
--  Draai NA funpoints_actie_km.sql, funpoints_push_limiet.sql en
--  funpoints_actie_budget_push.sql (voor campagne_ontvangers).
-- ============================================================

-- Helper: geeft (attractie_id, tot) terug als de actie van de aanroeper is
-- én goedgekeurd; anders exception.
create or replace function promo_actie(p_actie_id uuid, out o_attr uuid, out o_tot date)
  language plpgsql stable security definer set search_path = public as $$
declare v_uit uuid;
begin
  v_uit := huidige_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  select ac.attractie_id, ac.tot into o_attr, o_tot
  from actie ac join attractie a on a.id = ac.attractie_id
  where ac.id = p_actie_id and a.uitbater_id = v_uit and ac.status = 'goedgekeurd';
  if o_attr is null then raise exception 'NIET_JOUW_ACTIE_OF_NIET_GOEDGEKEURD'; end if;
end $$;

-- 1) Uitlichten (boost) — 2 credits per persoon.
create or replace function actie_uitlichten(p_actie_id uuid, p_postcode text, p_radius int, p_max int)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_attr uuid; v_tot date; v_reach int; v_eff int; v_kost int; v_saldo int;
begin
  v_uit := huidige_uitbater_id();
  select o_attr, o_tot into v_attr, v_tot from promo_actie(p_actie_id);
  v_reach := tel_bereik_km(p_postcode, p_radius, 'iedereen', v_attr);
  v_eff := least(v_reach, coalesce(nullif(p_max, 0), v_reach));
  v_kost := v_eff * 2;
  select credits into v_saldo from uitbater where id = v_uit;
  if v_saldo < v_kost then raise exception 'ONVOLDOENDE_CREDITS'; end if;
  update uitbater set credits = credits - v_kost where id = v_uit returning credits into v_saldo;
  update actie set boost_tot = (v_tot::timestamptz + interval '1 day') where id = p_actie_id;
  return json_build_object('kost', v_kost, 'bereik', v_eff, 'credits', v_saldo);
end $$;
grant execute on function actie_uitlichten(uuid, text, int, int) to authenticated;

-- 2) Superster — 3 credits per persoon, met eigen straal.
create or replace function actie_superster(p_actie_id uuid, p_postcode text, p_radius int, p_max int)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_attr uuid; v_tot date; v_reach int; v_eff int; v_kost int; v_saldo int;
begin
  v_uit := huidige_uitbater_id();
  select o_attr, o_tot into v_attr, v_tot from promo_actie(p_actie_id);
  v_reach := tel_bereik_km(p_postcode, p_radius, 'iedereen', v_attr);
  v_eff := least(v_reach, coalesce(nullif(p_max, 0), v_reach));
  v_kost := v_eff * 3;
  select credits into v_saldo from uitbater where id = v_uit;
  if v_saldo < v_kost then raise exception 'ONVOLDOENDE_CREDITS'; end if;
  update uitbater set credits = credits - v_kost where id = v_uit returning credits into v_saldo;
  update actie set superster = true, superster_postcode = p_postcode, superster_radius = p_radius,
                   superster_provincies = null, superster_tot = (v_tot::timestamptz + interval '1 day')
   where id = p_actie_id;
  return json_build_object('kost', v_kost, 'bereik', v_eff, 'credits', v_saldo);
end $$;
grant execute on function actie_superster(uuid, text, int, int) to authenticated;

-- 3) Push — 5 credits per persoon; maakt een campagne aan (app roept verstuur-push).
create or replace function actie_push(p_actie_id uuid, p_postcode text, p_radius int, p_max int)
  returns json language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_attr uuid; v_tot date; v_reach int; v_eff int; v_kost int; v_saldo int; v_camp uuid;
begin
  v_uit := huidige_uitbater_id();
  select o_attr, o_tot into v_attr, v_tot from promo_actie(p_actie_id);
  v_reach := tel_bereik_km(p_postcode, p_radius, 'iedereen', v_attr);
  v_eff := least(v_reach, coalesce(nullif(p_max, 0), v_reach));
  v_kost := v_eff * 5;
  select credits into v_saldo from uitbater where id = v_uit;
  if v_saldo < v_kost then raise exception 'ONVOLDOENDE_CREDITS'; end if;
  update uitbater set credits = credits - v_kost where id = v_uit returning credits into v_saldo;
  insert into push_campagne (actie_id, center_postcode, radius, max_bereik)
  values (p_actie_id, p_postcode, p_radius, nullif(p_max, 0)) returning id into v_camp;
  return json_build_object('kost', v_kost, 'bereik', v_eff, 'credits', v_saldo, 'campagne_id', v_camp);
end $$;
grant execute on function actie_push(uuid, text, int, int) to authenticated;

-- 4) Superster-rotatie op straal (vervangt de provincie-versie).
create or replace function actieve_supersters()
  returns json language plpgsql stable security definer set search_path = public as $$
declare v_lat double precision; v_lon double precision; v_arr json;
begin
  select pc.lat, pc.lon into v_lat, v_lon
  from bezoeker b left join postcode_coord pc on pc.postcode = pc_norm(b.postcode)
  where b.auth_user_id = auth.uid();

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_arr from (
    select ac.id, ac.attractie_id, ac.titel, ac.beschrijving, ac.eenmalig, attr.naam as kraam
    from actie ac
    join attractie attr on attr.id = ac.attractie_id
    left join postcode_coord sc on sc.postcode = ac.superster_postcode
    where ac.superster_tot is not null and ac.superster_tot > now()
      and ac.actief and ac.tot >= current_date
      and (
        ac.superster_postcode is null
        or (sc.lat is not null and v_lat is not null and afstand_km(sc.lat, sc.lon, v_lat, v_lon) <= ac.superster_radius)
      )
    order by ac.superster_tot desc
    limit 5
  ) t;
  return v_arr;
end $$;
grant execute on function actieve_supersters() to authenticated;

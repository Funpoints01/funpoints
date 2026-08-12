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

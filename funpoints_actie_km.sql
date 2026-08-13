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

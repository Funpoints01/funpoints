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

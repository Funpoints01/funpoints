-- ============================================================
--  Funpoints · superster-rotatie: tot 5 actieve supersters voor
--  de bezoeker (roteren in de banner). Idempotent.
-- ============================================================
create or replace function actieve_supersters()
  returns json language plpgsql stable security definer set search_path = public as $$
declare v_bez uuid; v_prov text; v_arr json;
begin
  select b.id, provincie_van(b.postcode) into v_bez, v_prov
  from bezoeker b where b.auth_user_id = auth.uid();

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_arr from (
    select ac.id, ac.attractie_id, ac.titel, ac.beschrijving, ac.eenmalig, attr.naam as kraam
    from actie ac join attractie attr on attr.id = ac.attractie_id
    where ac.superster_tot is not null and ac.superster_tot > now()
      and ac.actief and ac.tot >= current_date
      and (ac.superster_provincies is null or (v_prov is not null and v_prov = any(ac.superster_provincies)))
    order by ac.superster_tot desc
    limit 5
  ) t;
  return v_arr;
end $$;
grant execute on function actieve_supersters() to authenticated;

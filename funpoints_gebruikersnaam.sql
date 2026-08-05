-- ============================================================
--  Funpoints · unieke gebruikersnaam voor bezoekers
--  Draai één keer in de Supabase SQL-editor. Idempotent.
--  Regels: 3–20 tekens, letters/cijfers/underscore, uniek (hoofdletter-ongevoelig).
-- ============================================================

alter table bezoeker add column if not exists gebruikersnaam text;
create unique index if not exists bezoeker_gebruikersnaam_uniek on bezoeker (lower(gebruikersnaam));

-- Is een gebruikersnaam geldig én vrij? (sluit de eigen bezoeker uit)
create or replace function gebruikersnaam_vrij(p_naam text)
  returns boolean language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  if p_naam is null or trim(p_naam) !~ '^[A-Za-z0-9_]{3,20}$' then return false; end if;
  v_bez := huidige_bezoeker_id();
  return not exists (
    select 1 from bezoeker
    where lower(gebruikersnaam) = lower(trim(p_naam))
      and id <> coalesce(v_bez, '00000000-0000-0000-0000-000000000000'::uuid)
  );
end $$;

-- Stel de gebruikersnaam in / wijzig ze.
create or replace function zet_gebruikersnaam(p_naam text)
  returns json language plpgsql security definer set search_path = public as $$
declare v_bez uuid; v_n text;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;
  v_n := trim(p_naam);
  if v_n !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'ONGELDIG'; end if;
  if exists (select 1 from bezoeker where lower(gebruikersnaam) = lower(v_n) and id <> v_bez) then
    raise exception 'BEZET';
  end if;
  update bezoeker set gebruikersnaam = v_n where id = v_bez;
  return json_build_object('ok', true, 'gebruikersnaam', v_n);
exception when unique_violation then
  raise exception 'BEZET';
end $$;

-- Zoek bezoekers op (begin van) hun gebruikersnaam.
create or replace function zoek_vrienden(p_term text)
  returns table(id uuid, naam text, gebruikersnaam text) language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if p_term is null or trim(p_term) = '' then return; end if;
  return query
    select b.id, b.naam, b.gebruikersnaam
    from bezoeker b
    where b.gebruikersnaam is not null
      and b.gebruikersnaam ilike trim(p_term) || '%'
      and b.id <> coalesce(v_bez, '00000000-0000-0000-0000-000000000000'::uuid)
    order by b.gebruikersnaam
    limit 8;
end $$;

-- Vrienden/verzoeken/ranglijst geven nu ook de gebruikersnaam mee.
drop function if exists mijn_vrienden();
create function mijn_vrienden()
  returns table(bezoeker_id uuid, naam text, gebruikersnaam text) language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return; end if;
  return query
    select b.id, b.naam, b.gebruikersnaam
    from vriendschap vs
    join bezoeker b on b.id = case when vs.van_bezoeker = v_bez then vs.naar_bezoeker else vs.van_bezoeker end
    where vs.status = 'aanvaard' and (vs.van_bezoeker = v_bez or vs.naar_bezoeker = v_bez)
    order by b.gebruikersnaam nulls last, b.naam;
end $$;

drop function if exists openstaande_verzoeken();
create function openstaande_verzoeken()
  returns table(verzoek_id uuid, van_bezoeker uuid, naam text, gebruikersnaam text) language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return; end if;
  return query
    select vs.id, vs.van_bezoeker, b.naam, b.gebruikersnaam
    from vriendschap vs
    join bezoeker b on b.id = vs.van_bezoeker
    where vs.naar_bezoeker = v_bez and vs.status = 'open'
    order by vs.created_at desc;
end $$;

drop function if exists vrienden_leaderboard();
create function vrienden_leaderboard()
  returns table(bezoeker_id uuid, naam text, gebruikersnaam text, bezoeken bigint, tradities bigint, is_ik boolean)
  language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return; end if;
  return query
    with ids as (
      select v_bez as bid
      union
      select case when vs.van_bezoeker = v_bez then vs.naar_bezoeker else vs.van_bezoeker end
      from vriendschap vs
      where vs.status = 'aanvaard' and (vs.van_bezoeker = v_bez or vs.naar_bezoeker = v_bez)
    )
    select b.id, b.naam, b.gebruikersnaam,
      (select count(*) from incheck i where i.bezoeker_id = b.id) as bezoeken,
      (select count(distinct k.reeks_id) from incheck i join kermis k on k.id = i.kermis_id where i.bezoeker_id = b.id) as tradities,
      (b.id = v_bez) as is_ik
    from ids
    join bezoeker b on b.id = ids.bid
    order by bezoeken desc, tradities desc, b.naam;
end $$;

grant execute on function gebruikersnaam_vrij(text)  to authenticated;
grant execute on function gebruikersnaam_vrij(text)  to anon;  -- vrij-check tijdens registratie
grant execute on function zet_gebruikersnaam(text)   to authenticated;
grant execute on function zoek_vrienden(text)        to authenticated;
grant execute on function mijn_vrienden()            to authenticated;
grant execute on function openstaande_verzoeken()    to authenticated;
grant execute on function vrienden_leaderboard()     to authenticated;

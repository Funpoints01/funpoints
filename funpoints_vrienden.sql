-- ============================================================
--  Funpoints · fase 5 — vrienden, inbox & ranglijst
--  Draai één keer in de Supabase SQL-editor. Idempotent.
-- ============================================================

-- 1) Vriendschappen (verzoek van → naar, status open/aanvaard).
create table if not exists vriendschap (
  id            uuid primary key default gen_random_uuid(),
  van_bezoeker  uuid not null references bezoeker(id) on delete cascade,
  naar_bezoeker uuid not null references bezoeker(id) on delete cascade,
  status        text not null default 'open',   -- 'open' | 'aanvaard'
  created_at    timestamptz not null default now()
);
alter table vriendschap enable row level security;
drop policy if exists "vriendschap eigen zien" on vriendschap;
create policy "vriendschap eigen zien" on vriendschap for select
  using (van_bezoeker = huidige_bezoeker_id() or naar_bezoeker = huidige_bezoeker_id());
grant select on vriendschap to authenticated;

-- 2) Meldingen-inbox.
create table if not exists melding (
  id          uuid primary key default gen_random_uuid(),
  bezoeker_id uuid not null references bezoeker(id) on delete cascade,
  type        text not null,
  tekst       text not null,
  data        jsonb,
  gelezen     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table melding enable row level security;
drop policy if exists "melding eigen zien" on melding;
create policy "melding eigen zien" on melding for select
  using (bezoeker_id = huidige_bezoeker_id());
grant select on melding to authenticated;

-- 3) Zoek een bezoeker op e-mail (geeft nooit het e-mailadres terug).
create or replace function zoek_bezoeker(p_email text)
  returns table(id uuid, naam text) language plpgsql security definer set search_path = public as $$
begin
  return query
    select b.id, b.naam
    from bezoeker b
    join auth.users u on u.id = b.auth_user_id
    where lower(u.email) = lower(trim(p_email))
      and b.id <> coalesce(huidige_bezoeker_id(), '00000000-0000-0000-0000-000000000000'::uuid)
    limit 1;
end $$;

-- 4) Vriendschapsverzoek sturen.
create or replace function vriend_verzoek(p_naar uuid)
  returns json language plpgsql security definer set search_path = public as $$
declare v_bez uuid; v_naam text;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if p_naar = v_bez then raise exception 'NIET_JEZELF'; end if;
  if exists (
    select 1 from vriendschap
    where status in ('open', 'aanvaard')
      and ((van_bezoeker = v_bez and naar_bezoeker = p_naar) or (van_bezoeker = p_naar and naar_bezoeker = v_bez))
  ) then raise exception 'BESTAAT_AL'; end if;

  insert into vriendschap (van_bezoeker, naar_bezoeker) values (v_bez, p_naar);
  select naam into v_naam from bezoeker where id = v_bez;
  insert into melding (bezoeker_id, type, tekst, data)
  values (p_naar, 'vriend_verzoek', coalesce(v_naam, 'Iemand') || ' wil je vriend worden', jsonb_build_object('van', v_bez));
  return json_build_object('ok', true);
end $$;

-- 5) Antwoorden op een verzoek (aanvaarden of weigeren).
create or replace function vriend_antwoord(p_verzoek_id uuid, p_aanvaard boolean)
  returns json language plpgsql security definer set search_path = public as $$
declare v_bez uuid; v_van uuid; v_naam text;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;

  select van_bezoeker into v_van from vriendschap
   where id = p_verzoek_id and naar_bezoeker = v_bez and status = 'open';
  if v_van is null then raise exception 'VERZOEK_ONBEKEND'; end if;

  if p_aanvaard then
    update vriendschap set status = 'aanvaard' where id = p_verzoek_id;
    select naam into v_naam from bezoeker where id = v_bez;
    insert into melding (bezoeker_id, type, tekst, data)
    values (v_van, 'vriend_aanvaard', coalesce(v_naam, 'Iemand') || ' heeft je vriendschapsverzoek aanvaard', jsonb_build_object('van', v_bez));
  else
    delete from vriendschap where id = p_verzoek_id;
  end if;
  return json_build_object('ok', true);
end $$;

-- 6) Mijn aanvaarde vrienden.
create or replace function mijn_vrienden()
  returns table(bezoeker_id uuid, naam text) language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return; end if;
  return query
    select b.id, b.naam
    from vriendschap vs
    join bezoeker b on b.id = case when vs.van_bezoeker = v_bez then vs.naar_bezoeker else vs.van_bezoeker end
    where vs.status = 'aanvaard' and (vs.van_bezoeker = v_bez or vs.naar_bezoeker = v_bez)
    order by b.naam;
end $$;

-- 7) Openstaande (inkomende) verzoeken.
create or replace function openstaande_verzoeken()
  returns table(verzoek_id uuid, van_bezoeker uuid, naam text) language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return; end if;
  return query
    select vs.id, vs.van_bezoeker, b.naam
    from vriendschap vs
    join bezoeker b on b.id = vs.van_bezoeker
    where vs.naar_bezoeker = v_bez and vs.status = 'open'
    order by vs.created_at desc;
end $$;

-- 8) Ranglijst: ik + mijn vrienden, op aantal bezoeken (check-ins).
create or replace function vrienden_leaderboard()
  returns table(bezoeker_id uuid, naam text, bezoeken bigint, tradities bigint, is_ik boolean)
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
    select b.id, b.naam,
      (select count(*) from incheck i where i.bezoeker_id = b.id) as bezoeken,
      (select count(distinct k.reeks_id) from incheck i join kermis k on k.id = i.kermis_id where i.bezoeker_id = b.id) as tradities,
      (b.id = v_bez) as is_ik
    from ids
    join bezoeker b on b.id = ids.bid
    order by bezoeken desc, tradities desc, b.naam;
end $$;

-- 9) Tradities van een vriend (of jezelf) — enkel als je bevriend bent.
create or replace function bezoeker_tradities(p_bezoeker_id uuid)
  returns table(reeks_id uuid, naam text, plaats text, jaar int) language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if p_bezoeker_id <> v_bez and not exists (
    select 1 from vriendschap where status = 'aanvaard'
      and ((van_bezoeker = v_bez and naar_bezoeker = p_bezoeker_id) or (van_bezoeker = p_bezoeker_id and naar_bezoeker = v_bez))
  ) then raise exception 'GEEN_VRIEND'; end if;

  return query
    select coalesce(k.reeks_id, k.id) as reeks_id,
           coalesce(r.naam, k.naam) as naam,
           coalesce(r.plaats, k.plaats) as plaats,
           cast(extract(year from k.van) as int) as jaar
    from incheck i
    join kermis k on k.id = i.kermis_id
    left join kermis_reeks r on r.id = k.reeks_id
    where i.bezoeker_id = p_bezoeker_id;
end $$;

-- 10) Alle meldingen als gelezen markeren.
create or replace function markeer_meldingen_gelezen()
  returns void language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return; end if;
  update melding set gelezen = true where bezoeker_id = v_bez and not gelezen;
end $$;

grant execute on function zoek_bezoeker(text)                  to authenticated;
grant execute on function vriend_verzoek(uuid)                 to authenticated;
grant execute on function vriend_antwoord(uuid, boolean)       to authenticated;
grant execute on function mijn_vrienden()                      to authenticated;
grant execute on function openstaande_verzoeken()              to authenticated;
grant execute on function vrienden_leaderboard()               to authenticated;
grant execute on function bezoeker_tradities(uuid)             to authenticated;
grant execute on function markeer_meldingen_gelezen()          to authenticated;

-- ============================================================
--  Funpoints · foorkramers (personeel dat punten scant)
--  ------------------------------------------------------------
--  Model:
--   * Een foorkramer is een apart auth-account, uitgenodigd per
--     e-mail, met eigen wachtwoord + e-mail-2FA. Hij hoort bij
--     ÉÉN specifiek kraam (attractie) en kan enkel daarvoor boeken.
--   * Per kraam kunnen er meerdere foorkramers zijn.
--   * Staat de uitbater zélf in zijn kraam, dan heeft hij geen
--     apart account nodig: hij scant met zijn uitbater-login
--     (zie foorkramer_mag_boeken -> pad uitbater-eigenaar).
--   * Beveiliging is server-side: enkel een actieve én geverifieerde
--     foorkramer (of de uitbater-eigenaar) mag boeken. Intrekken
--     werkt onmiddellijk.
--
--  Idempotent. Draai in de Supabase SQL-editor.
-- ============================================================
create extension if not exists pgcrypto;

-- 1) Tabel
create table if not exists foorkramer (
  id uuid primary key default gen_random_uuid(),
  uitbater_id uuid not null references uitbater(id) on delete cascade,
  attractie_id uuid not null references attractie(id) on delete cascade,
  auth_user_id uuid unique,
  email text not null,
  naam text,
  status text not null default 'uitgenodigd'
    check (status in ('uitgenodigd', 'actief', 'ingetrokken')),
  -- e-mail-2FA + glijdende sessie (4u inactiviteit)
  otp_hash text,
  otp_exp timestamptz,
  otp_pogingen int not null default 0,
  geverifieerd_tot timestamptz,
  laatste_login_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists foorkramer_attractie_idx on foorkramer(attractie_id);
create index if not exists foorkramer_uitbater_idx on foorkramer(uitbater_id);
-- Eén actief/uitgenodigd account per e-mail per kraam (ingetrokkenen mogen dubbel).
create unique index if not exists foorkramer_uniek_actief
  on foorkramer(lower(email), attractie_id) where status <> 'ingetrokken';

alter table foorkramer enable row level security;
-- Geen directe client-toegang; alles loopt via SECURITY DEFINER-RPC's.
-- (Geen policies = standaard geweigerd voor de anon/authenticated rol.)

-- 2) Helpers
create or replace function mijn_uitbater_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select id from uitbater where auth_user_id = auth.uid()
$$;
grant execute on function mijn_uitbater_id() to authenticated;

-- De actieve foorkramer-rij van de huidige gebruiker (of niets).
create or replace function is_foorkramer()
  returns foorkramer language sql stable security definer set search_path = public as $$
  select f.* from foorkramer f
  where f.auth_user_id = auth.uid() and f.status = 'actief'
  limit 1
$$;
grant execute on function is_foorkramer() to authenticated;

-- 3) De centrale toegangspoort: mag de huidige gebruiker punten
--    boeken voor dit kraam? Twee toegestane paden:
--     a) actieve foorkramer van dat kraam, mét geldige 2FA-sessie;
--     b) de uitbater die eigenaar is van het kraam.
create or replace function foorkramer_mag_boeken(p_attractie_id uuid)
  returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_f foorkramer;
begin
  -- pad b) uitbater-eigenaar
  if exists (
    select 1 from attractie a
    join uitbater u on u.id = a.uitbater_id
    where a.id = p_attractie_id and u.auth_user_id = auth.uid()
  ) then
    return true;
  end if;

  -- pad a) foorkramer
  select * into v_f from foorkramer
  where auth_user_id = auth.uid() and status = 'actief' limit 1;
  if v_f.id is null then return false; end if;
  if v_f.attractie_id <> p_attractie_id then return false; end if;
  if v_f.geverifieerd_tot is null or v_f.geverifieerd_tot <= now() then return false; end if;
  return true;
end $$;
grant execute on function foorkramer_mag_boeken(uuid) to authenticated;

-- Verleng het 4u-venster bij activiteit (aangeroepen door de boek-RPC's).
create or replace function foorkramer_sessie_raak()
  returns void language plpgsql security definer set search_path = public as $$
begin
  update foorkramer
     set geverifieerd_tot = now() + interval '4 hours'
   where auth_user_id = auth.uid() and status = 'actief'
     and geverifieerd_tot is not null and geverifieerd_tot > now();
end $$;
grant execute on function foorkramer_sessie_raak() to authenticated;

-- 4) Beheer door de uitbater
--    Lijst van foorkramers voor één van je eigen kramen.
create or replace function foorkramer_lijst(p_attractie_id uuid)
  returns table(id uuid, email text, naam text, status text,
                geverifieerd boolean, created_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
declare v_uit uuid;
begin
  v_uit := mijn_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if not exists (select 1 from attractie a where a.id = p_attractie_id and a.uitbater_id = v_uit) then
    raise exception 'NIET_JOUW_KRAAM';
  end if;
  return query
    select f.id, f.email, f.naam, f.status,
           (f.geverifieerd_tot is not null and f.geverifieerd_tot > now()),
           f.created_at
    from foorkramer f
    where f.attractie_id = p_attractie_id and f.status <> 'ingetrokken'
    order by f.created_at;
end $$;
grant execute on function foorkramer_lijst(uuid) to authenticated;

-- Toegang intrekken: status op 'ingetrokken' + sessie onmiddellijk dood.
create or replace function foorkramer_intrekken(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uit uuid;
begin
  v_uit := mijn_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  update foorkramer
     set status = 'ingetrokken', geverifieerd_tot = null, otp_hash = null
   where id = p_id and uitbater_id = v_uit;
  if not found then raise exception 'ONBEKEND'; end if;
end $$;
grant execute on function foorkramer_intrekken(uuid) to authenticated;

-- 5) 2FA: code verifiëren (de code zelf wordt server-side per e-mail
--    verstuurd door een edge function die otp_hash/otp_exp zet).
create or replace function foorkramer_2fa_verifieer(p_code text)
  returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_f foorkramer;
begin
  select * into v_f from foorkramer where auth_user_id = auth.uid() and status = 'actief' limit 1;
  if v_f.id is null then return json_build_object('ok', false, 'reden', 'GEEN_FOORKRAMER'); end if;
  if v_f.otp_hash is null or v_f.otp_exp is null or v_f.otp_exp <= now() then
    return json_build_object('ok', false, 'reden', 'VERLOPEN');
  end if;
  if v_f.otp_pogingen >= 5 then
    return json_build_object('ok', false, 'reden', 'TE_VEEL_POGINGEN');
  end if;
  if v_f.otp_hash <> encode(digest(p_code || v_f.id::text, 'sha256'), 'hex') then
    update foorkramer set otp_pogingen = otp_pogingen + 1 where id = v_f.id;
    return json_build_object('ok', false, 'reden', 'FOUTE_CODE');
  end if;
  -- Geslaagd: 4u-venster openen, code verbruiken.
  update foorkramer
     set geverifieerd_tot = now() + interval '4 hours',
         otp_hash = null, otp_exp = null, otp_pogingen = 0,
         laatste_login_at = now()
   where id = v_f.id;
  return json_build_object('ok', true);
end $$;
grant execute on function foorkramer_2fa_verifieer(text) to authenticated;

-- Heeft de huidige foorkramer een geldige (niet-verlopen) 2FA-sessie?
create or replace function foorkramer_sessie_ok()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select f.geverifieerd_tot > now() from foorkramer f
    where f.auth_user_id = auth.uid() and f.status = 'actief' limit 1
  ), false)
$$;
grant execute on function foorkramer_sessie_ok() to authenticated;

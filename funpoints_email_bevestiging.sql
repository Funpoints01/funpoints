-- ============================================================
--  Funpoints · e-mailbevestiging voor bezoekers
--  ------------------------------------------------------------
--  Waarom: zodra "Confirm email" in Supabase Auth aanstaat, geeft
--  signUp géén sessie terug tot de bezoeker zijn mail bevestigt.
--  De app kan dan de bezoeker-rij niet meer zelf invoegen (geen
--  sessie = geen RLS-recht). Daarom maakt een trigger op
--  auth.users de bezoeker-rij aan uit de signup-metadata.
--
--  Belangrijk: dit vuurt ALLEEN voor bezoeker-signups (rol =
--  'bezoeker' in de metadata). Uitbater-accounts die via
--  mgmt-maak-uitbater worden aangemaakt hebben die metadata niet
--  en krijgen dus géén bezoeker-rij.
--
--  Idempotent — mag je meermaals draaien.
--  Draai in de Supabase SQL-editor.
-- ============================================================

-- 1) Kolom om een nog-niet-geclaimd kaartje te onthouden.
--    Bij bevestiging-AAN bestaat er bij signup nog geen sessie,
--    dus de kaartkoppeling gebeurt pas bij de eerste login.
alter table bezoeker add column if not exists pending_claim_code text;

-- 2) De trigger-functie: maakt de bezoeker-rij uit de metadata.
create or replace function handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_naam text := nullif(trim(coalesce(m->>'naam', '')), '');
  v_gnaam text := nullif(trim(coalesce(m->>'gebruikersnaam', '')), '');
  v_gb text := nullif(trim(coalesce(m->>'geboortedatum', '')), '');
  v_pc text := nullif(trim(coalesce(m->>'postcode', '')), '');
  v_code text := nullif(trim(coalesce(m->>'claim_code', '')), '');
begin
  -- Enkel voor echte bezoeker-registraties (niet voor uitbater-accounts).
  if coalesce(m->>'rol', '') <> 'bezoeker' then
    return NEW;
  end if;
  -- Nooit dubbel invoegen (idempotent bij re-run of herhaalde events).
  if exists (select 1 from bezoeker where auth_user_id = NEW.id) then
    return NEW;
  end if;

  insert into bezoeker (auth_user_id, naam, email, gebruikersnaam, geboortedatum, postcode, pending_claim_code)
  values (
    NEW.id,
    coalesce(v_naam, split_part(NEW.email, '@', 1)),
    NEW.email,
    v_gnaam,
    case when v_gb ~ '^\d{4}-\d{2}-\d{2}$' then v_gb::date else null end,
    v_pc,
    v_code
  );
  return NEW;
end $$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- 3) Kaartje koppelen ná bevestiging (bij de eerste login).
--    Roept dezelfde claim-logica aan als vroeger, maar op basis van
--    de onthouden code, en wist die daarna. Fouten (bv. code al
--    gebruikt) blokkeren de app niet.
create or replace function claim_pending()
  returns json language plpgsql security definer set search_path = public as $$
declare v_bez uuid; v_code text; v_ok boolean := false;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then return json_build_object('claimed', false); end if;

  select pending_claim_code into v_code from bezoeker where id = v_bez;
  if v_code is null then return json_build_object('claimed', false); end if;

  begin
    perform claim_via_code(v_code);
    v_ok := true;
  exception when others then
    v_ok := false;
  end;

  -- Code altijd wissen: geslaagd óf definitief mislukt, hij is verbruikt.
  update bezoeker set pending_claim_code = null where id = v_bez;
  return json_build_object('claimed', v_ok);
end $$;
grant execute on function claim_pending() to authenticated;

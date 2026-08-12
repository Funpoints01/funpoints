-- ============================================================
--  Funpoints · rol van de huidige gebruiker (voor routing na het
--  instellen van een wachtwoord via /herstel). Idempotent.
-- ============================================================
create or replace function mijn_rol()
  returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from uitbater where auth_user_id = auth.uid()) then 'uitbater'
    when exists (select 1 from foorkramer where auth_user_id = auth.uid()
                 and status in ('actief', 'uitgenodigd')) then 'foorkramer'
    else 'bezoeker'
  end
$$;
grant execute on function mijn_rol() to authenticated;

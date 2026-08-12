-- ============================================================
--  Funpoints · foorkramer-uitnodiging: activeren + "ik sta zelf
--  in het kraam". Draai NA funpoints_foorkramers.sql. Idempotent.
-- ============================================================

-- 1) De uitgenodigde foorkramer activeert zichzelf ná het instellen
--    van zijn wachtwoord (aangeroepen vanaf de instelpagina).
create or replace function foorkramer_activeer()
  returns json language plpgsql security definer set search_path = public as $$
declare v_f foorkramer;
begin
  select * into v_f from foorkramer
   where auth_user_id = auth.uid() and status = 'uitgenodigd' limit 1;
  if v_f.id is null then
    -- geen openstaande uitnodiging: al actief? of gewoon geen foorkramer.
    return json_build_object('foorkramer',
      exists(select 1 from foorkramer where auth_user_id = auth.uid() and status = 'actief'));
  end if;
  update foorkramer set status = 'actief' where id = v_f.id;
  return json_build_object('foorkramer', true);
end $$;
grant execute on function foorkramer_activeer() to authenticated;

-- 2) "Ik sta zelf in het kraam": de uitbater maakt zichzelf foorkramer
--    voor één van zijn eigen kramen (geen uitnodiging nodig — hij heeft
--    al een account). Meteen actief, maar 2FA blijft vereist vóór boeken.
--    Eén rij per uitbater-account (unieke auth_user_id) → dit herwijst
--    naar het gekozen kraam.
create or replace function foorkramer_ikzelf(p_attractie_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uit uuid; v_email text; v_naam text;
begin
  v_uit := mijn_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if not exists (select 1 from attractie where id = p_attractie_id and uitbater_id = v_uit) then
    raise exception 'NIET_JOUW_KRAAM';
  end if;
  select au.email into v_email from auth.users au where au.id = auth.uid();
  select naam into v_naam from uitbater where id = v_uit;

  if exists (select 1 from foorkramer where auth_user_id = auth.uid()) then
    update foorkramer
       set attractie_id = p_attractie_id, uitbater_id = v_uit, status = 'actief',
           email = coalesce(v_email, email), naam = coalesce(v_naam, naam)
     where auth_user_id = auth.uid();
  else
    insert into foorkramer (uitbater_id, attractie_id, auth_user_id, email, naam, status)
    values (v_uit, p_attractie_id, auth.uid(), coalesce(v_email, 'onbekend'), v_naam, 'actief');
  end if;
end $$;
grant execute on function foorkramer_ikzelf(uuid) to authenticated;

-- 3) Stopt de uitbater zelf met in het kraam staan → zijn eigen
--    foorkramer-toegang intrekken.
create or replace function foorkramer_ikzelf_stop()
  returns void language plpgsql security definer set search_path = public as $$
begin
  update foorkramer set status = 'ingetrokken', geverifieerd_tot = null, otp_hash = null
   where auth_user_id = auth.uid();
end $$;
grant execute on function foorkramer_ikzelf_stop() to authenticated;

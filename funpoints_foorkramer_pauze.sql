-- ============================================================
--  Funpoints · foorkramer pauzeren/hervatten.
--  Nieuwe status 'gepauzeerd': tijdelijk geen toegang (kan scannen
--  niet), maar makkelijk te hervatten zonder nieuwe uitnodiging.
--  Draai NA funpoints_foorkramers.sql. Idempotent.
-- ============================================================

alter table foorkramer drop constraint if exists foorkramer_status_check;
alter table foorkramer add constraint foorkramer_status_check
  check (status in ('uitgenodigd', 'actief', 'ingetrokken', 'gepauzeerd'));

create or replace function foorkramer_pauzeren(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uit uuid;
begin
  v_uit := mijn_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  update foorkramer
     set status = 'gepauzeerd', geverifieerd_tot = null, otp_hash = null
   where id = p_id and uitbater_id = v_uit and status <> 'ingetrokken';
  if not found then raise exception 'ONBEKEND'; end if;
end $$;
grant execute on function foorkramer_pauzeren(uuid) to authenticated;

create or replace function foorkramer_hervatten(p_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uit uuid;
begin
  v_uit := mijn_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  update foorkramer set status = 'actief'
   where id = p_id and uitbater_id = v_uit and status = 'gepauzeerd';
  if not found then raise exception 'ONBEKEND'; end if;
end $$;
grant execute on function foorkramer_hervatten(uuid) to authenticated;

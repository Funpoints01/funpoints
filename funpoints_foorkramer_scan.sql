-- ============================================================
--  Funpoints · foorkramer-scanner helpers (fase 4).
--  Draai NA funpoints_foorkramers.sql. Idempotent.
-- ============================================================
create or replace function foorkramer_login_status()
  returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'foorkramer', exists(
      select 1 from foorkramer where auth_user_id = auth.uid() and status = 'actief'),
    'sessie_ok', coalesce((
      select geverifieerd_tot > now() from foorkramer
      where auth_user_id = auth.uid() and status = 'actief' limit 1), false)
  );
$$;
grant execute on function foorkramer_login_status() to authenticated;

create or replace function mijn_scan_kraam()
  returns json language sql stable security definer set search_path = public as $$
  select json_build_object('naam', k.naam, 'snelknoppen', k.snelknoppen)
  from (
    select a.naam, a.snelknoppen from attractie a where a.auth_user_id = auth.uid()
    union all
    select a.naam, a.snelknoppen
    from foorkramer f join attractie a on a.id = f.attractie_id
    where f.auth_user_id = auth.uid() and f.status = 'actief'
      and f.geverifieerd_tot is not null and f.geverifieerd_tot > now()
  ) k
  limit 1;
$$;
grant execute on function mijn_scan_kraam() to authenticated;

-- ============================================================
--  Funpoints · meldingen wisbaar + ranglijst met meerdere metrieken
--  Draai één keer in de Supabase SQL-editor. Idempotent.
-- ============================================================

-- 1) Je mag je eigen meldingen wissen.
drop policy if exists "melding eigen wissen" on melding;
create policy "melding eigen wissen" on melding for delete
  using (bezoeker_id = huidige_bezoeker_id());
grant delete on melding to authenticated;

-- 2) Ranglijst met meerdere metrieken (allemaal op basis van check-ins).
--    bezoeken       = totaal aantal check-ins
--    kermissen      = aantal verschillende kermissen (reeksen)
--    bezoeken_maand = check-ins deze maand
drop function if exists vrienden_leaderboard();
create function vrienden_leaderboard()
  returns table(bezoeker_id uuid, naam text, gebruikersnaam text,
                bezoeken bigint, kermissen bigint, bezoeken_maand bigint, is_ik boolean)
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
      (select count(distinct k.reeks_id) from incheck i join kermis k on k.id = i.kermis_id where i.bezoeker_id = b.id) as kermissen,
      (select count(*) from incheck i where i.bezoeker_id = b.id
         and date_trunc('month', i.ingecheckt_op) = date_trunc('month', now())) as bezoeken_maand,
      (b.id = v_bez) as is_ik
    from ids
    join bezoeker b on b.id = ids.bid
    order by bezoeken desc, kermissen desc, b.naam;
end $$;

grant execute on function vrienden_leaderboard() to authenticated;

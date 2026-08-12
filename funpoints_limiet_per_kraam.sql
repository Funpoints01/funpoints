-- ============================================================
--  Funpoints · daglimiet PER KRAAM i.p.v. globaal.
--  ------------------------------------------------------------
--  Elke attractie krijgt een eigen dagelijkse puntenlimiet die de
--  uitbater zelf instelt. NULL = geen limiet voor dat kraam.
--  De limiet geldt voor het totaal aan uitgedeelde punten per kraam
--  per dag (alle medewerkers samen); inruilen/aftrekken telt niet mee.
--  Vervangt de eerdere globale uitbater-limieten uit
--  funpoints_boeking_poort.sql. Idempotent.
-- ============================================================

alter table attractie add column if not exists max_punten_dag int;
alter table uitbater drop column if exists max_punten_boeking;
alter table uitbater drop column if exists max_punten_dag;

create or replace function puntenboeking_limiet_check()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap int; v_vandaag int;
begin
  if NEW.soort <> 'toevoegen' then return NEW; end if;
  select a.max_punten_dag into v_cap from attractie a where a.id = NEW.attractie_id;
  if v_cap is null then return NEW; end if;

  select coalesce(sum(abs(pb.punten)), 0) into v_vandaag
    from puntenboeking pb
    where pb.attractie_id = NEW.attractie_id
      and pb.soort = 'toevoegen'
      and pb.created_at >= date_trunc('day', now());
  if v_vandaag + abs(NEW.punten) > v_cap then
    raise exception 'LIMIET_PER_DAG'
      using hint = 'Dagelijkse limiet van ' || v_cap || ' punten voor dit kraam bereikt.';
  end if;
  return NEW;
end $$;

create or replace function attractie_zet_daglimiet(p_attractie_id uuid, p_limiet int)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uit uuid;
begin
  v_uit := mijn_uitbater_id();
  if v_uit is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if not exists (select 1 from attractie where id = p_attractie_id and uitbater_id = v_uit) then
    raise exception 'NIET_JOUW_KRAAM';
  end if;
  if p_limiet is not null and p_limiet < 0 then raise exception 'ONGELDIG'; end if;
  update attractie set max_punten_dag = p_limiet where id = p_attractie_id;
end $$;
grant execute on function attractie_zet_daglimiet(uuid, int) to authenticated;

-- ============================================================
--  Funpoints · fase 1 — kramen volgen / favoriet
--  Draai één keer in de Supabase SQL-editor. Idempotent.
-- ============================================================

create table if not exists kraam_volger (
  bezoeker_id  uuid not null references bezoeker(id)  on delete cascade,
  attractie_id uuid not null references attractie(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (bezoeker_id, attractie_id)
);

alter table kraam_volger enable row level security;

-- Een bezoeker ziet enkel wie hij zelf volgt.
drop policy if exists "kraam_volger eigen zien" on kraam_volger;
create policy "kraam_volger eigen zien" on kraam_volger
  for select using (bezoeker_id = huidige_bezoeker_id());

grant select on kraam_volger to authenticated;

-- Volgen / ontvolgen via één functie (gebruikt de ingelogde bezoeker).
create or replace function zet_kraam_volg(p_attractie_id uuid, p_volg boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare v_bez uuid;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;

  if p_volg then
    insert into kraam_volger (bezoeker_id, attractie_id)
    values (v_bez, p_attractie_id)
    on conflict do nothing;
  else
    delete from kraam_volger where bezoeker_id = v_bez and attractie_id = p_attractie_id;
  end if;
end $$;

grant execute on function zet_kraam_volg(uuid, boolean) to authenticated;

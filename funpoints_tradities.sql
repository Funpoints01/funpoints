-- ============================================================
--  Funpoints · fase 3 — inchecken + tradities
--  Draai één keer in de Supabase SQL-editor. Idempotent.
-- ============================================================

create table if not exists incheck (
  id            uuid primary key default gen_random_uuid(),
  bezoeker_id   uuid not null references bezoeker(id) on delete cascade,
  kermis_id     uuid not null references kermis(id)   on delete cascade,
  ingecheckt_op timestamptz not null default now(),
  unique (bezoeker_id, kermis_id)
);

alter table incheck enable row level security;

drop policy if exists "incheck eigen zien" on incheck;
create policy "incheck eigen zien" on incheck
  for select using (bezoeker_id = huidige_bezoeker_id());

grant select on incheck to authenticated;

-- Manueel inchecken vanaf de kermispagina — enkel terwijl de kermis loopt.
create or replace function incheck_kermis(p_kermis_id uuid)
  returns json language plpgsql security definer set search_path = public as $$
declare v_bez uuid; v_van date; v_tot date;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;

  select van, tot into v_van, v_tot from kermis where id = p_kermis_id;
  if v_van is null then raise exception 'KERMIS_ONBEKEND'; end if;
  if not (v_van <= current_date and v_tot >= current_date) then raise exception 'KERMIS_NIET_ACTIEF'; end if;

  insert into incheck (bezoeker_id, kermis_id)
  values (v_bez, p_kermis_id)
  on conflict do nothing;

  return json_build_object('ok', true);
end $$;

grant execute on function incheck_kermis(uuid) to authenticated;

-- Automatisch inchecken wanneer een foorkramer je QR scant op een lopende kermis.
-- Het vangnet (exception-blok) zorgt dat inchecken NOOIT een boeking kan blokkeren.
create or replace function na_boeking_incheck()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_kermis uuid;
begin
  begin
    if NEW.bezoeker_id is null then return NEW; end if;

    select k.id into v_kermis
      from kermis k
      join kermis_attractie ka on ka.kermis_id = k.id
     where ka.attractie_id = NEW.attractie_id
       and k.van <= current_date and k.tot >= current_date
     order by k.van desc
     limit 1;

    if v_kermis is not null then
      insert into incheck (bezoeker_id, kermis_id)
      values (NEW.bezoeker_id, v_kermis)
      on conflict do nothing;
    end if;
  exception when others then
    null;  -- stil falen: een boeking mag nooit stuklopen op het inchecken
  end;
  return NEW;
end $$;

drop trigger if exists trg_na_boeking_incheck on puntenboeking;
create trigger trg_na_boeking_incheck
  after insert on puntenboeking
  for each row execute function na_boeking_incheck();

-- ============================================================
--  Funpoints · pushlimiet: max 3 pushmeldingen per bezoeker per dag.
--  ------------------------------------------------------------
--  Een klein ontvangst-logje telt hoeveel campagnes een bezoeker
--  vandaag kreeg. campagne_ontvangers slaat bezoekers over die al
--  aan 3 zitten (of deze campagne al kregen), en registreert de
--  ontvangst meteen. Idempotent. Draai in de Supabase SQL-editor.
-- ============================================================

create table if not exists push_ontvangst (
  bezoeker_id uuid not null,
  campagne_id uuid not null,
  dag         date not null default current_date,
  created_at  timestamptz not null default now(),
  primary key (bezoeker_id, campagne_id)
);
create index if not exists push_ontvangst_bez_dag on push_ontvangst (bezoeker_id, dag);

create or replace function campagne_ontvangers(p_campagne_id uuid)
  returns table(endpoint text, p256dh text, auth text)
  language plpgsql security definer set search_path = public as $$
declare c_lat double precision; c_lon double precision; v_rad int;
begin
  select pcc.lat, pcc.lon, c.radius into c_lat, c_lon, v_rad
    from push_campagne c join postcode_coord pcc on pcc.postcode = c.center_postcode
    where c.id = p_campagne_id;
  if c_lat is null then return; end if;

  return query
  with kandidaten as (
    select distinct b.id as bezoeker_id
    from bezoeker b
    join postcode_coord pc on pc.postcode = pc_norm(b.postcode)
    join push_subscription ps on ps.bezoeker_id = b.id
    where afstand_km(c_lat, c_lon, pc.lat, pc.lon) <= v_rad
      and (select count(*) from push_ontvangst po
             where po.bezoeker_id = b.id and po.dag = current_date) < 3
      and not exists (select 1 from push_ontvangst po
             where po.bezoeker_id = b.id and po.campagne_id = p_campagne_id)
  ),
  ingeschreven as (
    insert into push_ontvangst (bezoeker_id, campagne_id)
    select bezoeker_id, p_campagne_id from kandidaten
    on conflict do nothing
    returning bezoeker_id
  )
  select ps.endpoint, ps.p256dh, ps.auth
  from ingeschreven i
  join push_subscription ps on ps.bezoeker_id = i.bezoeker_id;
end $$;

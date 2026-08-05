-- ============================================================
--  Funpoints · Play Time kermiskalender → agenda van Talita
--  Koppelt alle geplande kermissen aan haar attractie "Playtime".
--  Draai dit één keer in de Supabase SQL-editor.
--  Veilig om opnieuw te draaien: bestaande kermissen worden niet
--  opnieuw aangemaakt (geen dubbels).
-- ============================================================

do $$
declare
  v_uit  uuid;
  v_attr uuid;
begin
  -- 1) Uitbater Talita opzoeken
  select u.id into v_uit
    from public.uitbater u
    where u.auth_user_id = (select id from auth.users where email = 'talita@funpoints.be');
  if v_uit is null then
    raise exception 'Uitbater met e-mail talita@funpoints.be niet gevonden.';
  end if;

  -- 2) Attractie "Playtime" van Talita (aanmaken als ze nog niet bestaat)
  select a.id into v_attr
    from public.attractie a
    where a.uitbater_id = v_uit and lower(a.naam) = 'playtime'
    limit 1;
  if v_attr is null then
    insert into public.attractie (uitbater_id, naam, soort)
    values (v_uit, 'Playtime', 'lunapark')
    returning id into v_attr;
  end if;

  -- 3) Kermissen aanmaken + koppelen (enkel wat nog niet gekoppeld is)
  with data(naam, plaats, van, tot) as (values
    ('Heist Carnaval',                 'Heist',                        date '2026-02-14', date '2026-02-22'),
    ('Sint-Gillis-bij-Dendermonde kermis', 'Sint-Gillis-bij-Dendermonde', date '2026-03-14', date '2026-03-16'),
    ('Meulebeke kermis',               'Meulebeke',                    date '2026-03-21', date '2026-03-29'),
    ('Evergem kermis',                 'Evergem',                      date '2026-04-04', date '2026-04-07'),
    ('Denderhoutem kermis',            'Denderhoutem',                 date '2026-04-18', date '2026-04-20'),
    ('Peizegem kermis',                'Peizegem',                     date '2026-04-24', date '2026-05-01'),
    ('Lauwe kermis',                   'Lauwe',                        date '2026-05-02', date '2026-05-04'),
    ('Wevelgem kermis',                'Wevelgem',                     date '2026-05-14', date '2026-05-18'),
    ('Zottegem kermis',                'Zottegem',                     date '2026-05-23', date '2026-05-26'),
    ('Dadizele kermis',                'Dadizele',                     date '2026-05-30', date '2026-06-01'),
    ('Zwijnaarde kermis',              'Zwijnaarde',                   date '2026-06-05', date '2026-06-08'),
    ('Gistel kermis',                  'Gistel',                       date '2026-06-13', date '2026-06-14'),
    ('Passendale kermis',              'Passendale',                   date '2026-06-20', date '2026-06-22'),
    ('Staden kermis',                  'Staden',                       date '2026-06-27', date '2026-06-30'),
    ('Brakel kermis (juli)',           'Brakel',                       date '2026-07-03', date '2026-07-08'),
    ('Wijtschate kermis',              'Wijtschate',                   date '2026-07-10', date '2026-07-16'),
    ('Ichtegem kermis',                'Ichtegem',                     date '2026-07-17', date '2026-07-19'),
    ('Dudzele kermis',                 'Dudzele',                      date '2026-07-31', date '2026-08-04'),
    ('Roeselare-Beveren kermis',       'Roeselare',                    date '2026-08-01', date '2026-08-10'),
    ('Zottegem kermis (augustus)',     'Zottegem',                     date '2026-08-15', date '2026-08-18'),
    ('Jabbeke kermis',                 'Jabbeke',                      date '2026-08-28', date '2026-08-30'),
    ('Hulste kermis',                  'Hulste',                       date '2026-09-04', date '2026-09-08'),
    ('Brakel kermis (september)',      'Brakel',                       date '2026-09-11', date '2026-09-16'),
    ('Wevelgem kermis (september)',    'Wevelgem',                     date '2026-09-18', date '2026-09-21'),
    ('Lauwe kermis (oktober)',         'Lauwe',                        date '2026-10-03', date '2026-10-05'),
    ('Ardooie kermis',                 'Ardooie',                      date '2026-10-10', date '2026-10-12'),
    ('Sint-Lievens-Houtem kermis',     'Sint-Lievens-Houtem',          date '2026-11-10', date '2026-11-12')
  ),
  nieuw as (
    insert into public.kermis (naam, plaats, van, tot)
    select d.naam, d.plaats, d.van, d.tot
      from data d
     where not exists (
       select 1
         from public.kermis k
         join public.kermis_attractie ka
           on ka.kermis_id = k.id and ka.attractie_id = v_attr
        where k.naam = d.naam and k.van = d.van
     )
    returning id
  )
  insert into public.kermis_attractie (kermis_id, attractie_id)
  select n.id, v_attr from nieuw n;

  raise notice 'Klaar. Attractie Playtime = %, uitbater = %.', v_attr, v_uit;
end $$;

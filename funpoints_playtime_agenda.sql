-- ============================================================
--  Funpoints · Play Time kalender → uitbater-agenda (tabel 'locatie')
--  Vult het /agenda-scherm van Talita voor attractie "Playtime".
--  Veilig om opnieuw te draaien (geen dubbels).
-- ============================================================

do $$
declare
  v_uit  uuid;
  v_attr uuid;
begin
  select u.id into v_uit
    from public.uitbater u
    where u.auth_user_id = (select id from auth.users where email = 'talita@funpoints.be');
  if v_uit is null then
    raise exception 'Uitbater met e-mail talita@funpoints.be niet gevonden.';
  end if;

  select a.id into v_attr
    from public.attractie a
    where a.uitbater_id = v_uit and lower(a.naam) = 'playtime'
    limit 1;
  if v_attr is null then
    insert into public.attractie (uitbater_id, naam, soort)
    values (v_uit, 'Playtime', 'lunapark')
    returning id into v_attr;
  end if;

  insert into public.locatie (attractie_id, naam, van, tot)
  select v_attr, d.naam, d.van, d.tot
    from (values
      ('Heist Carnaval',                 date '2026-02-14', date '2026-02-22'),
      ('Sint-Gillis-bij-Dendermonde',    date '2026-03-14', date '2026-03-16'),
      ('Meulebeke kermis',               date '2026-03-21', date '2026-03-29'),
      ('Evergem kermis',                 date '2026-04-04', date '2026-04-07'),
      ('Denderhoutem kermis',            date '2026-04-18', date '2026-04-20'),
      ('Peizegem kermis',                date '2026-04-24', date '2026-05-01'),
      ('Lauwe kermis',                   date '2026-05-02', date '2026-05-04'),
      ('Wevelgem kermis',                date '2026-05-14', date '2026-05-18'),
      ('Zottegem kermis',                date '2026-05-23', date '2026-05-26'),
      ('Dadizele kermis',                date '2026-05-30', date '2026-06-01'),
      ('Zwijnaarde kermis',              date '2026-06-05', date '2026-06-08'),
      ('Gistel kermis',                  date '2026-06-13', date '2026-06-14'),
      ('Passendale kermis',              date '2026-06-20', date '2026-06-22'),
      ('Staden kermis',                  date '2026-06-27', date '2026-06-30'),
      ('Brakel kermis (juli)',           date '2026-07-03', date '2026-07-08'),
      ('Wijtschate kermis',              date '2026-07-10', date '2026-07-16'),
      ('Ichtegem kermis',                date '2026-07-17', date '2026-07-19'),
      ('Dudzele kermis',                 date '2026-07-31', date '2026-08-04'),
      ('Roeselare-Beveren kermis',       date '2026-08-01', date '2026-08-10'),
      ('Zottegem kermis (augustus)',     date '2026-08-15', date '2026-08-18'),
      ('Jabbeke kermis',                 date '2026-08-28', date '2026-08-30'),
      ('Hulste kermis',                  date '2026-09-04', date '2026-09-08'),
      ('Brakel kermis (september)',      date '2026-09-11', date '2026-09-16'),
      ('Wevelgem kermis (september)',    date '2026-09-18', date '2026-09-21'),
      ('Lauwe kermis (oktober)',         date '2026-10-03', date '2026-10-05'),
      ('Ardooie kermis',                 date '2026-10-10', date '2026-10-12'),
      ('Sint-Lievens-Houtem kermis',     date '2026-11-10', date '2026-11-12')
    ) as d(naam, van, tot)
   where not exists (
     select 1 from public.locatie l
      where l.attractie_id = v_attr and l.naam = d.naam and l.van = d.van
   );

  raise notice 'Klaar. Locaties toegevoegd aan Playtime (%).', v_attr;
end $$;

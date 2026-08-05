-- ============================================================
--  Funpoints · vriend_verzoek robuuster maken
--  Weigert een leeg/ongeldig doel met een nette fout.
--  Draai één keer in de Supabase SQL-editor. Idempotent.
-- ============================================================

create or replace function vriend_verzoek(p_naar uuid)
  returns json language plpgsql security definer set search_path = public as $$
declare v_bez uuid; v_naam text;
begin
  v_bez := huidige_bezoeker_id();
  if v_bez is null then raise exception 'NIET_GEMACHTIGD'; end if;
  if p_naar is null then raise exception 'GEEN_DOEL'; end if;
  if not exists (select 1 from bezoeker where id = p_naar) then raise exception 'ONBEKEND'; end if;
  if p_naar = v_bez then raise exception 'NIET_JEZELF'; end if;
  if exists (
    select 1 from vriendschap
    where status in ('open', 'aanvaard')
      and ((van_bezoeker = v_bez and naar_bezoeker = p_naar) or (van_bezoeker = p_naar and naar_bezoeker = v_bez))
  ) then raise exception 'BESTAAT_AL'; end if;

  insert into vriendschap (van_bezoeker, naar_bezoeker) values (v_bez, p_naar);
  select naam into v_naam from bezoeker where id = v_bez;
  insert into melding (bezoeker_id, type, tekst, data)
  values (p_naar, 'vriend_verzoek', coalesce(v_naam, 'Iemand') || ' wil je vriend worden', jsonb_build_object('van', v_bez));
  return json_build_object('ok', true);
end $$;

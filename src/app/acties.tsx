import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { DatumVeld } from '../components/DatumVeld'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', violet: '#8B5CF6', amber: '#F59E0B', green: '#10B981', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}
const SOORTEN = [
  { key: 'promo', label: 'Korting / promo' },
  { key: 'bonus_punten', label: 'Extra punten' },
]
const BOOSTS = [{ d: 3 }, { d: 7 }, { d: 14 }]   // 10 credits/dag
function naarISO(sv: string): string | null {
  const d = sv.match(/\d+/g)
  if (!d || d.length < 3) return null
  const [dag, maand, jaar] = d
  if (jaar.length !== 4) return null
  const di = parseInt(dag, 10), mi = parseInt(maand, 10)
  if (di < 1 || di > 31 || mi < 1 || mi > 12) return null
  return `${jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`
}
function toonDatum(iso: string): string { const [j, m, d] = iso.split('-'); return `${d}-${m}-${j}` }
function isGeboost(ts: string | null): boolean { return !!ts && new Date(ts).getTime() > Date.now() }
function isSuperster(ts: string | null): boolean { return !!ts && new Date(ts).getTime() > Date.now() }
const SS_UREN = [4, 8, 12]
const RADII = [5, 10, 20, 35, 50, 75, 100]
function boostTot(ts: string): string { const d = new Date(ts); return `${d.getDate()}/${d.getMonth() + 1}` }

// --- Regio-targeting (interim: provincie-niveau) ---
const PROV: Record<string, string> = {
  ANT: 'Antwerpen', OVL: 'Oost-Vlaanderen', WVL: 'West-Vlaanderen', VBR: 'Vlaams-Brabant',
  LIM: 'Limburg', BRU: 'Brussel', WBR: 'Waals-Brabant', HEN: 'Henegouwen',
  NAM: 'Namen', LIE: 'Luik', LUX: 'Luxemburg',
}
const BUUR: Record<string, string[]> = {
  ANT: ['OVL', 'VBR', 'LIM'], OVL: ['WVL', 'ANT', 'VBR', 'HEN'], WVL: ['OVL', 'HEN'],
  VBR: ['ANT', 'OVL', 'BRU', 'WBR', 'LIE', 'LIM'], LIM: ['ANT', 'VBR', 'LIE'],
  BRU: ['VBR', 'WBR'], WBR: ['BRU', 'VBR', 'HEN', 'NAM', 'LIE'],
  HEN: ['WVL', 'OVL', 'WBR', 'NAM'], NAM: ['HEN', 'WBR', 'LIE', 'LUX'],
  LIE: ['LIM', 'VBR', 'WBR', 'NAM', 'LUX'], LUX: ['NAM', 'LIE'],
}
const GEWEST_VL = ['ANT', 'OVL', 'WVL', 'VBR', 'LIM']
const GEWEST_WA = ['WBR', 'HEN', 'NAM', 'LIE', 'LUX']
const ALLE_PROV = Object.keys(PROV)
const NIVEAUS = ['Eigen provincie', '+ Buurprovincies', 'Heel het gewest', 'Heel België']
function provVan(pc: string): string | null {
  const n = parseInt((pc.match(/\d+/g) || []).join(''), 10)
  if (!n) return null
  if (n <= 1299) return 'BRU'
  if (n <= 1499) return 'WBR'
  if (n <= 1999) return 'VBR'
  if (n <= 2999) return 'ANT'
  if (n <= 3499) return 'VBR'
  if (n <= 3999) return 'LIM'
  if (n <= 4999) return 'LIE'
  if (n <= 5999) return 'NAM'
  if (n <= 6599) return 'HEN'
  if (n <= 6999) return 'LUX'
  if (n <= 7999) return 'HEN'
  if (n <= 8999) return 'WVL'
  if (n <= 9999) return 'OVL'
  return null
}
function provinciesVoor(pc: string, niveau: number): string[] | null {
  const p = provVan(pc)
  if (!p) return null
  if (niveau <= 0) return [p]
  if (niveau === 1) return [p, ...(BUUR[p] || [])]
  if (niveau === 2) return GEWEST_VL.includes(p) ? GEWEST_VL : GEWEST_WA.includes(p) ? GEWEST_WA : ['BRU']
  return ALLE_PROV
}

type Attr = { id: string; naam: string }
type Actie = { id: string; attractie_id: string; titel: string; soort: string; bonus_pct: number | null; van: string; tot: string; boost_tot: string | null; eenmalig: boolean; superster_tot: string | null; superster_provincies: string[] | null }

export default function Acties() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [attracties, setAttracties] = useState<Attr[]>([])
  const [acties, setActies] = useState<Actie[]>([])
  const [credits, setCredits] = useState(0)
  const [laden, setLaden] = useState(true)

  const [attrId, setAttrId] = useState('')
  const [titel, setTitel] = useState('')
  const [beschrijving, setBeschrijving] = useState('')
  const [eenmalig, setEenmalig] = useState(false)
  const [ssVoor, setSsVoor] = useState<string | null>(null)
  const [ssUren, setSsUren] = useState(4)
  const [ssPc, setSsPc] = useState('')
  const [ssRadius, setSsRadius] = useState(25)
  const [ssBezig, setSsBezig] = useState(false)
  const [ssMelding, setSsMelding] = useState<{ ok: boolean; tekst: string } | null>(null)
  const [soort, setSoort] = useState('promo')
  const [pct, setPct] = useState('')
  const [van, setVan] = useState('')
  const [tot, setTot] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  const [boostVoor, setBoostVoor] = useState<string | null>(null)
  const [boostBezig, setBoostBezig] = useState(false)
  const [boostFout, setBoostFout] = useState('')

  const [campVoor, setCampVoor] = useState<string | null>(null)
  const [campPc, setCampPc] = useState('')
  const [campRadius, setCampRadius] = useState(25)
  const [telling, setTelling] = useState<{ audience: number; bereikbaar: number } | null>(null)
  const [telBezig, setTelBezig] = useState(false)
  const [campBezig, setCampBezig] = useState(false)
  const [campMelding, setCampMelding] = useState<{ ok: boolean; tekst: string } | null>(null)

  async function telDoelgroep(pc: string, radius: number) {
    if (!/^\d{4}$/.test((pc || '').trim())) { setTelling(null); return }
    setTelBezig(true)
    const { data } = await supabase.rpc('tel_doelgroep', { p_postcode: pc.trim(), p_radius: radius })
    setTelBezig(false)
    setTelling(data ? { audience: (data as any).audience, bereikbaar: (data as any).bereikbaar } : null)
  }

  function openCampagne(actieId: string) {
    setCampVoor(actieId); setCampMelding(null); setTelling(null)
    telDoelgroep(campPc, campRadius)
  }

  async function activeerSuperster(actieId: string) {
    if (!/^\d{4}$/.test(ssPc.trim())) { setSsMelding({ ok: false, tekst: 'Geef eerst een geldige postcode.' }); return }
    setSsBezig(true); setSsMelding(null)
    const { data, error } = await supabase.rpc('activeer_superster', { p_actie_id: actieId, p_uren: ssUren, p_postcode: ssPc.trim(), p_radius: ssRadius })
    setSsBezig(false)
    if (error) {
      setSsMelding({ ok: false, tekst: error.message.includes('ONVOLDOENDE_CREDITS') ? 'Niet genoeg credits.' : 'Activeren mislukt.' })
      return
    }
    setCredits((data as any).credits)
    setSsMelding({ ok: true, tekst: `⭐ Superster actief voor ${ssUren} uur!` })
    herlaad()
  }

  async function verstuurCampagne(actieId: string) {
    if (!/^\d{4}$/.test(campPc.trim())) { setCampMelding({ ok: false, tekst: 'Geef eerst een geldige postcode.' }); return }
    setCampBezig(true); setCampMelding(null)
    const { data, error } = await supabase.rpc('verstuur_campagne', { p_actie_id: actieId, p_postcode: campPc.trim(), p_radius: campRadius })
    if (error) {
      setCampBezig(false)
      const m = error.message.includes('ONVOLDOENDE_CREDITS') ? 'Niet genoeg credits voor dit bereik.'
        : error.message.includes('GEEN_ONTVANGERS') ? 'Nog geen bereikbare bezoekers (met meldingen aan) in dit bereik.'
        : 'Versturen mislukt. Probeer opnieuw.'
      setCampMelding({ ok: false, tekst: m }); return
    }
    const aantal = (data as any).aantal
    setCredits((data as any).credits)
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('verstuur-push', { body: { campagne_id: (data as any).campagne_id } })
    setCampBezig(false)
    const mislukt = !!fnErr || !!(fnData as any)?.error || (fnData as any)?.status === 'niets_verzonden'
    if (mislukt) {
      // De Edge Function heeft de credits teruggezet → haal het echte saldo opnieuw op.
      try {
        const { data: sess } = await supabase.auth.getSession()
        const uid = sess.session?.user.id
        if (uid) {
          const { data: u } = await supabase.from('uitbater').select('credits').eq('auth_user_id', uid).maybeSingle()
          if (u) setCredits((u as any).credits)
        }
      } catch {}
      let detail = 'onbekende fout'
      if (fnErr) {
        detail = (fnErr as any).message || detail
        try { const b = await (fnErr as any).context?.json?.(); if (b?.error) detail = b.error } catch {}
      } else if ((fnData as any)?.error) {
        detail = (fnData as any).error
      } else {
        detail = 'geen bereikbare bezoekers'
      }
      setCampMelding({ ok: false, tekst: `Verzenden faalde: ${detail}. Je credits zijn teruggezet.` })
    } else {
      const verz = (fnData as any)?.verzonden
      setCampMelding({ ok: true, tekst: `📣 Verzonden naar ${verz ?? aantal} bezoeker(s). ${aantal} credit(s) gebruikt.` })
    }
  }

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)) }, [])

  async function herlaad() {
    const uid = session?.user?.id
    if (!uid) return
    const [{ data: u }, { data: att }] = await Promise.all([
      supabase.from('uitbater').select('credits').eq('auth_user_id', uid).maybeSingle(),
      supabase.from('attractie').select('id, naam'),
    ])
    setCredits(u?.credits ?? 0)
    const lijst = (att ?? []) as Attr[]
    setAttracties(lijst)
    if (lijst.length && !attrId) setAttrId(lijst[0].id)
    // Enkel de acties van de eigen attracties tonen (niet die van andere uitbaters).
    const eigenIds = lijst.map((a) => a.id)
    let act: Actie[] = []
    if (eigenIds.length) {
      const { data } = await supabase.from('actie')
        .select('id, attractie_id, titel, soort, bonus_pct, van, tot, boost_tot, eenmalig, superster_tot, superster_provincies')
        .in('attractie_id', eigenIds).order('van')
      act = (data ?? []) as Actie[]
    }
    setActies(act)
    setLaden(false)
  }
  useEffect(() => { if (session) herlaad() }, [session])

  async function toevoegen() {
    setFout('')
    if (!attrId) return setFout('Kies een attractie.')
    if (!titel.trim()) return setFout('Geef een titel.')
    if (!van || !tot) return setFout('Kies een begin- en einddatum.')
    const vi = van, ti = tot
    if (ti < vi) return setFout('De einddatum ligt vóór de startdatum.')
    const pctNum = !eenmalig && soort === 'bonus_punten' ? parseInt(pct, 10) : null
    if (!eenmalig && soort === 'bonus_punten' && (!pctNum || pctNum <= 0)) return setFout('Geef een percentage extra punten.')
    setBezig(true)
    const { error } = await supabase.from('actie').insert({
      attractie_id: attrId, titel: titel.trim(), beschrijving: beschrijving.trim() || null,
      soort: eenmalig ? 'voucher' : soort, bonus_pct: pctNum, van: vi, tot: ti, eenmalig,
    })
    setBezig(false)
    if (error) return setFout('Toevoegen mislukt. Probeer opnieuw.')
    setTitel(''); setBeschrijving(''); setPct(''); setVan(''); setTot(''); setSoort('promo'); setEenmalig(false)
    herlaad()
  }

  async function verwijder(id: string) {
    await supabase.from('actie').delete().eq('id', id)
    setActies((a) => a.filter((x) => x.id !== id))
  }

  async function boost(actieId: string, dagen: number) {
    setBoostFout(''); setBoostBezig(true)
    const { data, error } = await supabase.rpc('boost_actie', { p_actie_id: actieId, p_dagen: dagen })
    setBoostBezig(false)
    if (error) {
      setBoostFout(error.message.includes('ONVOLDOENDE_CREDITS') ? 'Niet genoeg credits.' : 'Boosten mislukt.')
      return
    }
    setCredits(data as number)
    setBoostVoor(null)
    herlaad()
  }

  if (session === undefined || laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>
  if (session === null) return (
    <View style={[s.scherm, s.center, { padding: 28 }]}>
      <Text style={s.sub}>Log eerst in als uitbater.</Text>
      <Pressable onPress={() => router.push('/uitbater')} style={{ marginTop: 16 }}><Text style={s.terug}>Naar inloggen</Text></Pressable>
    </View>
  )

  const naamVan = (id: string) => attracties.find((a) => a.id === id)?.naam ?? '—'

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/uitbater')} hitSlop={12}><Text style={s.terug}>‹ Dashboard</Text></Pressable>
        <Text style={s.titel}>Acties</Text>
        <Text style={s.sub}>Zet acties op en boost ze om bovenaan bij de bezoekers te staan.</Text>

        <View style={s.creditKaart}>
          <View style={{ flex: 1 }}>
            <Text style={s.creditLbl}>Je credits</Text>
            <Text style={s.creditNum}>{credits}</Text>
          </View>
          <View style={s.creditKoop}><Text style={s.creditKoopT}>Kopen · binnenkort</Text></View>
        </View>

        <View style={s.kaart}>
          <Text style={s.blokTitel}>Nieuwe actie</Text>
          <Text style={[s.label, { marginTop: 14 }]}>Attractie</Text>
          <View style={s.chips}>
            {attracties.map((a) => (
              <Pressable key={a.id} onPress={() => setAttrId(a.id)} style={[s.chip, attrId === a.id && s.chipActief]}>
                <Text style={[s.chipT, attrId === a.id && s.chipTActief]}>{a.naam}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.label, { marginTop: 14 }]}>Titel</Text>
          <TextInput style={s.input} value={titel} onChangeText={setTitel}
            placeholder="bv. 10% extra punten dit weekend" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>Beschrijving (optioneel)</Text>
          <TextInput style={s.input} value={beschrijving} onChangeText={setBeschrijving}
            placeholder="korte uitleg" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>Type actie</Text>
          <View style={s.chips}>
            <Pressable onPress={() => setEenmalig(false)} style={[s.chip, !eenmalig && s.chipActief]}>
              <Text style={[s.chipT, !eenmalig && s.chipTActief]}>Punten-actie</Text>
            </Pressable>
            <Pressable onPress={() => setEenmalig(true)} style={[s.chip, eenmalig && s.chipActief]}>
              <Text style={[s.chipT, eenmalig && s.chipTActief]}>🎟️ Eenmalige voucher</Text>
            </Pressable>
          </View>

          {eenmalig ? (
            <View style={s.voucherHint}>
              <Text style={s.voucherHintT}>
                Bezoekers halen hiervoor een persoonlijke QR op. De foorkramer scant die één keer:
                groen bij inwisselen, rood als ze het nog eens proberen. Zet de deal in de titel,
                bv. “3 gratis oliebollen”.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[s.label, { marginTop: 14 }]}>Soort</Text>
              <View style={s.chips}>
                {SOORTEN.map((so) => (
                  <Pressable key={so.key} onPress={() => setSoort(so.key)} style={[s.chip, soort === so.key && s.chipActief]}>
                    <Text style={[s.chipT, soort === so.key && s.chipTActief]}>{so.label}</Text>
                  </Pressable>
                ))}
              </View>
              {soort === 'bonus_punten' ? (
                <>
                  <Text style={[s.label, { marginTop: 14 }]}>Extra punten (%)</Text>
                  <TextInput style={s.input} value={pct} onChangeText={setPct}
                    keyboardType="number-pad" placeholder="bv. 10" placeholderTextColor={C.muted} />
                </>
              ) : null}
            </>
          )}
          <View style={s.datumRij}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Van</Text>
              <DatumVeld value={van} onChange={setVan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Tot</Text>
              <DatumVeld value={tot} onChange={setTot} />
            </View>
          </View>
          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
          <Pressable onPress={toevoegen} disabled={bezig} style={[s.knop, s.knopViolet, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>+ Actie toevoegen</Text>}
          </Pressable>
        </View>

        <Text style={[s.blokTitel, { marginTop: 24, marginBottom: 4 }]}>Je acties</Text>
        {acties.length === 0
          ? <Text style={s.sub}>Nog geen acties.</Text>
          : acties.map((a) => (
            <View key={a.id} style={s.actieKaart}>
              <View style={s.actieRij}>
                <View style={{ flex: 1 }}>
                  <View style={s.actieTop}>
                    <Text style={s.actieTitel}>{a.titel}</Text>
                    {isSuperster(a.superster_tot) ? <Text style={s.superBadge}>⭐ superster</Text> : null}
                    {a.eenmalig ? <Text style={s.voucherBadge}>🎟️ voucher</Text> : null}
                    {isGeboost(a.boost_tot) ? <Text style={s.boostBadge}>⭐ tot {boostTot(a.boost_tot!)}</Text> : null}
                  </View>
                  <Text style={s.actieSub}>
                    {naamVan(a.attractie_id)}
                    {!a.eenmalig && a.soort === 'bonus_punten' && a.bonus_pct ? ` · +${a.bonus_pct}% punten` : ''}
                    {' · '}{toonDatum(a.van)} → {toonDatum(a.tot)}
                  </Text>
                </View>
                <Pressable onPress={() => verwijder(a.id)} hitSlop={8}><Text style={s.verwijder}>Wis</Text></Pressable>
              </View>

              {boostVoor === a.id ? (
                <View style={s.boostVak}>
                  <Text style={s.boostUitleg}>Kies hoelang je deze actie uitlicht (10 credits/dag):</Text>
                  <View style={s.boostOpties}>
                    {BOOSTS.map((b) => (
                      <Pressable key={b.d} onPress={() => boost(a.id, b.d)} disabled={boostBezig}
                        style={[s.boostOptie, boostBezig && s.knopUit]}>
                        <Text style={s.boostOptieD}>{b.d} dagen</Text>
                        <Text style={s.boostOptieC}>{b.d * 10} credits</Text>
                      </Pressable>
                    ))}
                  </View>
                  {boostFout ? <Text style={s.boostFout}>{boostFout}</Text> : null}
                  <Pressable onPress={() => { setBoostVoor(null); setBoostFout('') }} style={{ marginTop: 10 }}>
                    <Text style={s.annuleer}>Annuleren</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => { setBoostVoor(a.id); setBoostFout('') }} style={s.boostKnop}>
                  <Text style={s.boostKnopT}>⭐ {isGeboost(a.boost_tot) ? 'Uitlichting verlengen' : 'Boost deze actie'}</Text>
                </Pressable>
              )}

              {ssVoor === a.id ? (
                <View style={s.ssVak}>
                  <Text style={s.campKop}>⭐ Superster-banner activeren</Text>
                  <Text style={s.campUitleg}>
                    Je actie springt bovenaan bij je doelgroep in het oog met een bewegende banner.
                    Kies de duur en de regio. Kost 10 credits per uur.
                  </Text>

                  <Text style={[s.label, { marginTop: 12 }]}>Hoelang</Text>
                  <View style={s.ssUrenRij}>
                    {SS_UREN.map((u) => (
                      <Pressable key={u} onPress={() => setSsUren(u)}
                        style={[s.ssUur, ssUren === u && s.ssUurAan]}>
                        <Text style={[s.ssUurT, ssUren === u && s.ssUurTAan]}>{u} uur</Text>
                        <Text style={[s.ssUurC, ssUren === u && s.ssUurCAan]}>{u * 10} credits</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[s.label, { marginTop: 14 }]}>Postcode (middelpunt)</Text>
                  <TextInput style={s.input} value={ssPc} onChangeText={setSsPc}
                    keyboardType="number-pad" maxLength={4}
                    placeholder="bv. 8531" placeholderTextColor={C.muted} />
                  {provVan(ssPc) ? <Text style={s.campProv}>Regio rond {PROV[provVan(ssPc)!]}</Text> : null}

                  <Text style={[s.label, { marginTop: 14 }]}>Straal</Text>
                  <View style={s.kmRij}>
                    {RADII.map((r) => (
                      <Pressable key={r} onPress={() => setSsRadius(r)}
                        style={[s.kmChip, ssRadius === r && s.kmChipAan]}>
                        <Text style={[s.kmChipT, ssRadius === r && s.kmChipTAan]}>{r} km</Text>
                      </Pressable>
                    ))}
                  </View>

                  {ssMelding ? (
                    <View style={[s.foutBox, ssMelding.ok && s.okBox]}>
                      <Text style={[s.foutT, ssMelding.ok && s.okT]}>{ssMelding.tekst}</Text>
                    </View>
                  ) : null}

                  <Pressable onPress={() => activeerSuperster(a.id)} disabled={ssBezig || !/^\d{4}$/.test(ssPc.trim())}
                    style={[s.knop, s.knopSuper, { marginTop: 14 }, (ssBezig || !/^\d{4}$/.test(ssPc.trim())) && s.knopUit]}>
                    {ssBezig
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.knopSuperT}>⭐ Activeer · {ssUren * 10} credits</Text>}
                  </Pressable>
                  <Pressable onPress={() => { setSsVoor(null); setSsMelding(null) }} style={{ marginTop: 10 }}>
                    <Text style={s.annuleer}>Sluiten</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => { setSsVoor(a.id); setSsMelding(null) }} style={s.ssKnop}>
                  <Text style={s.ssKnopT}>⭐ {isSuperster(a.superster_tot) ? 'Superster verlengen' : 'Superster activeren'}</Text>
                </Pressable>
              )}

              {campVoor === a.id ? (
                <View style={s.campVak}>
                  <Text style={s.campKop}>📣 Pushmelding versturen</Text>
                  <Text style={s.campUitleg}>Geef een postcode als middelpunt en vergroot de regio. Je betaalt 1 credit per bereikbare bezoeker.</Text>

                  <Text style={[s.label, { marginTop: 12 }]}>Postcode (middelpunt)</Text>
                  <TextInput style={s.input} value={campPc}
                    onChangeText={(t) => { setCampPc(t); telDoelgroep(t, campRadius) }}
                    keyboardType="number-pad" maxLength={4}
                    placeholder="bv. 8531" placeholderTextColor={C.muted} />
                  {provVan(campPc) ? <Text style={s.campProv}>Regio rond {PROV[provVan(campPc)!]}</Text> : null}

                  <Text style={[s.label, { marginTop: 14 }]}>Straal</Text>
                  <View style={s.kmRij}>
                    {RADII.map((r) => (
                      <Pressable key={r} onPress={() => { setCampRadius(r); telDoelgroep(campPc, r) }}
                        style={[s.kmChip, campRadius === r && s.kmChipAan]}>
                        <Text style={[s.kmChipT, campRadius === r && s.kmChipTAan]}>{r} km</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={s.tellerVak}>
                    {telBezig
                      ? <ActivityIndicator color={C.violet} />
                      : telling
                        ? <Text style={s.tellerT}>
                            <Text style={s.tellerGetal}>{telling.audience}</Text> bezoeker(s) in dit bereik ·{' '}
                            <Text style={s.tellerGetal}>{telling.bereikbaar}</Text> met meldingen aan
                          </Text>
                        : <Text style={s.tellerLeeg}>Geef een geldige postcode om je bereik te zien.</Text>}
                  </View>

                  {campMelding ? (
                    <View style={[s.foutBox, campMelding.ok && s.okBox]}>
                      <Text style={[s.foutT, campMelding.ok && s.okT]}>{campMelding.tekst}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => verstuurCampagne(a.id)}
                    disabled={campBezig || !telling || telling.bereikbaar === 0}
                    style={[s.knop, s.knopGroen, { marginTop: 14 }, (campBezig || !telling || telling.bereikbaar === 0) && s.knopUit]}>
                    {campBezig
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.knopGroenT}>📣 Verstuur{telling && telling.bereikbaar > 0 ? ` naar ${telling.bereikbaar} · ${telling.bereikbaar} credits` : ''}</Text>}
                  </Pressable>
                  <Pressable onPress={() => { setCampVoor(null); setCampMelding(null) }} style={{ marginTop: 10 }}>
                    <Text style={s.annuleer}>Sluiten</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => openCampagne(a.id)} style={s.pushKnop}>
                  <Text style={s.pushKnopT}>📣 Verstuur pushmelding</Text>
                </Pressable>
              )}
            </View>
          ))}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6 },
  creditKaart: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
    backgroundColor: 'rgba(139,92,246,0.08)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', borderRadius: 18, padding: 18,
  },
  creditLbl: { color: C.violet, fontSize: 13, fontWeight: '700' },
  creditNum: { color: C.ink, fontSize: 30, fontWeight: '900', marginTop: 2 },
  creditKoop: { backgroundColor: 'rgba(139,92,246,0.14)', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  creditKoopT: { color: C.violet, fontWeight: '700', fontSize: 12.5 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  blokTitel: { color: C.ink, fontSize: 16, fontWeight: '800' },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: C.veld, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.line },
  chipActief: { backgroundColor: C.violet, borderColor: C.violet },
  chipT: { color: C.ink, fontWeight: '700', fontSize: 13.5 },
  chipTActief: { color: '#fff' },
  datumRij: { flexDirection: 'row', gap: 12, marginTop: 14 },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopViolet: { backgroundColor: C.violet },
  knopVioletT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  actieKaart: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 10 },
  actieRij: { flexDirection: 'row', alignItems: 'center' },
  actieTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actieTitel: { color: C.ink, fontSize: 15.5, fontWeight: '800' },
  boostBadge: { color: C.amber, fontSize: 11.5, fontWeight: '800', backgroundColor: 'rgba(245,158,11,0.14)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  voucherBadge: { color: C.green, fontSize: 11.5, fontWeight: '800', backgroundColor: 'rgba(16,185,129,0.14)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  superBadge: { color: '#B45309', fontSize: 11.5, fontWeight: '800', backgroundColor: 'rgba(245,158,11,0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  ssKnop: { marginTop: 10, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  ssKnopT: { color: '#B45309', fontWeight: '800', fontSize: 14 },
  ssVak: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  ssUrenRij: { flexDirection: 'row', gap: 8 },
  ssUur: { flex: 1, backgroundColor: C.veld, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  ssUurAan: { backgroundColor: C.amber, borderColor: C.amber },
  ssUurT: { color: C.ink, fontWeight: '800', fontSize: 14 },
  ssUurTAan: { color: '#fff' },
  ssUurC: { color: C.muted, fontWeight: '600', fontSize: 11, marginTop: 1 },
  ssUurCAan: { color: 'rgba(255,255,255,0.9)' },
  knopSuper: { backgroundColor: C.amber },
  knopSuperT: { color: '#fff', fontWeight: '800', fontSize: 15.5 },
  voucherHint: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, marginTop: 12 },
  voucherHintT: { color: '#0E7C5A', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  actieSub: { color: C.muted, fontSize: 12.5, marginTop: 3 },
  verwijder: { color: C.red, fontSize: 13, fontWeight: '700', marginLeft: 10 },
  boostKnop: { marginTop: 12, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  boostKnopT: { color: '#B45309', fontWeight: '800', fontSize: 14 },
  boostVak: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  boostUitleg: { color: C.muted, fontSize: 13, marginBottom: 10 },
  boostOpties: { flexDirection: 'row', gap: 8 },
  boostOptie: { flex: 1, backgroundColor: C.amber, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  boostOptieD: { color: '#fff', fontWeight: '800', fontSize: 14 },
  boostOptieC: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 11, marginTop: 1 },
  boostFout: { color: C.red, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  annuleer: { color: C.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  okBox: { backgroundColor: 'rgba(16,185,129,0.12)' },
  okT: { color: '#0E9E70' },
  knopGroen: { backgroundColor: C.green },
  knopGroenT: { color: '#fff', fontWeight: '800', fontSize: 15.5 },
  pushKnop: { marginTop: 10, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  pushKnopT: { color: '#0E7C5A', fontWeight: '800', fontSize: 14 },
  campVak: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  campKop: { color: C.ink, fontSize: 15, fontWeight: '900' },
  campUitleg: { color: C.muted, fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  campProv: { color: C.green, fontSize: 13, fontWeight: '700', marginTop: 6 },
  balk: { flexDirection: 'row', gap: 4 },
  balkSeg: { flex: 1, backgroundColor: C.veld, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  balkSegAan: { backgroundColor: C.violet },
  balkSegT: { color: C.muted, fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  balkSegTAan: { color: '#fff' },
  kmRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kmChip: { backgroundColor: C.veld, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: C.line },
  kmChipAan: { backgroundColor: C.violet, borderColor: C.violet },
  kmChipT: { color: C.muted, fontWeight: '800', fontSize: 12.5 },
  kmChipTAan: { color: '#fff' },
  tellerVak: { marginTop: 12, backgroundColor: C.veld, borderRadius: 12, padding: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  tellerT: { color: C.ink, fontSize: 13.5, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  tellerGetal: { color: C.violet, fontWeight: '900', fontSize: 15 },
  tellerLeeg: { color: C.muted, fontSize: 13, textAlign: 'center' },
})

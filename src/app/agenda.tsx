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
  muted: '#7A7290', violet: '#8B5CF6', green: '#10B981', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}

function toonDatum(iso: string): string {
  const [j, m, d] = iso.split('-')
  return `${d}-${m}-${j}`
}

type Attr = { id: string; naam: string }
type Reeks = { id: string; naam: string; plaats: string | null; postcode: string | null }
type Loc = { kermisId: string; attractieId: string; naam: string; plaats: string | null; van: string; tot: string }

export default function Agenda() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [attracties, setAttracties] = useState<Attr[]>([])
  const [locaties, setLocaties] = useState<Loc[]>([])
  const [laden, setLaden] = useState(true)

  const [attrId, setAttrId] = useState<string>('')
  const [zoek, setZoek] = useState('')
  const [resultaten, setResultaten] = useState<Reeks[]>([])
  const [zoekBezig, setZoekBezig] = useState(false)
  const [gekozen, setGekozen] = useState<Reeks | null>(null)
  const [nieuwMode, setNieuwMode] = useState(false)
  const [naam, setNaam] = useState('')
  const [plaats, setPlaats] = useState('')
  const [postcode, setPostcode] = useState('')
  const [van, setVan] = useState('')
  const [tot, setTot] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [melding, setMelding] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  async function herlaad() {
    const { data: att } = await supabase.from('attractie').select('id, naam')
    const lijst = (att ?? []) as Attr[]
    setAttracties(lijst)
    if (lijst.length && !attrId) setAttrId(lijst[0].id)

    const ids = lijst.map((a) => a.id)
    let rijen: Loc[] = []
    if (ids.length) {
      const { data: ka } = await supabase.from('kermis_attractie')
        .select('kermis_id, attractie_id').in('attractie_id', ids)
      const kermisIds = [...new Set((ka ?? []).map((r: any) => r.kermis_id))]
      if (kermisIds.length) {
        const { data: kerm } = await supabase.from('kermis')
          .select('id, naam, plaats, van, tot').in('id', kermisIds)
        const kMap = new Map<string, any>((kerm ?? []).map((k: any) => [k.id, k]))
        rijen = (ka ?? []).flatMap((r: any) => {
          const k = kMap.get(r.kermis_id)
          if (!k) return []
          return [{ kermisId: k.id, attractieId: r.attractie_id, naam: k.naam, plaats: k.plaats, van: k.van, tot: k.tot }]
        }).sort((a, b) => String(a.van).localeCompare(String(b.van)))
      }
    }
    setLocaties(rijen)
    setLaden(false)
  }

  useEffect(() => { if (session) herlaad() }, [session])

  async function zoekReeks(term: string) {
    setZoek(term); setGekozen(null); setNieuwMode(false); setMelding('')
    if (term.trim().length < 2) { setResultaten([]); return }
    setZoekBezig(true)
    const t = term.trim().replace(/[%,()]/g, '')
    if (t.length < 2) { setZoekBezig(false); setResultaten([]); return }
    const { data } = await supabase.from('kermis_reeks')
      .select('id, naam, plaats, postcode')
      .or(`naam.ilike.%${t}%,plaats.ilike.%${t}%,postcode.ilike.%${t}%`)
      .order('naam').limit(8)
    setZoekBezig(false)
    setResultaten((data ?? []) as Reeks[])
  }

  function kiesReeks(r: Reeks) {
    setGekozen(r); setNieuwMode(false); setResultaten([]); setZoek(r.naam); setFout('')
  }
  function startNieuw() {
    setNieuwMode(true); setGekozen(null); setResultaten([])
    setNaam(zoek.trim()); setPlaats(''); setPostcode(''); setFout('')
  }
  function opnieuwZoeken() {
    setGekozen(null); setNieuwMode(false); setZoek(''); setResultaten([])
    setNaam(''); setPlaats(''); setPostcode(''); setFout(''); setMelding('')
  }

  async function toevoegen() {
    setFout(''); setMelding('')
    if (!attrId) return setFout('Kies eerst een attractie.')
    if (!gekozen && !nieuwMode) return setFout('Zoek een kermis of maak een nieuwe aan.')
    if (nieuwMode && !naam.trim()) return setFout('Geef de kermis een naam.')
    if (!van || !tot) return setFout('Kies een begin- en einddatum.')
    if (postcode.trim() && !/^\d{4}$/.test(postcode.trim())) return setFout('Geef een geldige postcode (4 cijfers).')
    if (tot < van) return setFout('De einddatum ligt vóór de startdatum.')
    setBezig(true)
    let error: any = null
    let data: any = null
    if (gekozen) {
      ({ data, error } = await supabase.rpc('plan_kermis_bestaand', {
        p_reeks_id: gekozen.id, p_attractie_id: attrId, p_van: van, p_tot: tot,
      }))
    } else {
      ({ data, error } = await supabase.rpc('plan_kermis_nieuw', {
        p_naam: naam.trim(), p_plaats: plaats.trim(), p_postcode: postcode.trim(),
        p_attractie_id: attrId, p_van: van, p_tot: tot,
      }))
    }
    setBezig(false)
    if (error) return setFout('Toevoegen mislukt. Probeer opnieuw.')
    if (data?.herbruikt) {
      setMelding(`Deze kermis liep dit jaar al (${toonDatum(data.van)} → ${toonDatum(data.tot)}). Je kraam is eraan toegevoegd.`)
    } else {
      setMelding('Kermis toegevoegd aan je agenda.')
    }
    opnieuwZoeken(); setVan(''); setTot('')
    herlaad()
  }

  if (session === undefined || laden) {
    return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>
  }
  if (session === null) {
    return (
      <View style={[s.scherm, s.center, { padding: 28 }]}>
        <Text style={s.sub}>Log eerst in als uitbater.</Text>
        <Pressable onPress={() => router.push('/uitbater')} style={{ marginTop: 16 }}>
          <Text style={s.terug}>Naar inloggen</Text>
        </Pressable>
      </View>
    )
  }

  const naamVan = (id: string) => attracties.find((a) => a.id === id)?.naam ?? '—'
  const kiesKlaar = !!gekozen || nieuwMode

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/uitbater')} hitSlop={12}><Text style={s.terug}>‹ Dashboard</Text></Pressable>
        <Text style={s.titel}>Agenda</Text>
        <Text style={s.sub}>Zoek een bestaande kermis of maak een nieuwe aan. Bezoekers zien deze kermissen ook.</Text>

        <View style={s.kaart}>
          <Text style={s.blokTitel}>Kermis toevoegen</Text>

          <Text style={[s.label, { marginTop: 14 }]}>Attractie</Text>
          <View style={s.chips}>
            {attracties.map((a) => (
              <Pressable key={a.id} onPress={() => setAttrId(a.id)}
                style={[s.chip, attrId === a.id && s.chipActief]}>
                <Text style={[s.chipT, attrId === a.id && s.chipTActief]}>{a.naam}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.label, { marginTop: 16 }]}>Kermis</Text>
          {!kiesKlaar ? (
            <>
              <View style={s.zoekVak}>
                <Text style={s.zoekIcon}>🔎</Text>
                <TextInput style={s.zoekInput} value={zoek} onChangeText={zoekReeks}
                  placeholder="Zoek op naam, gemeente of postcode" placeholderTextColor={C.muted} />
                {zoekBezig ? <ActivityIndicator color={C.violet} /> : null}
              </View>

              {resultaten.length > 0 ? (
                <View style={s.resultaten}>
                  {resultaten.map((r) => (
                    <Pressable key={r.id} style={s.resRij} onPress={() => kiesReeks(r)}>
                      <Text style={s.resIcon}>🎪</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.resNaam}>{r.naam}</Text>
                        {r.plaats ? <Text style={s.resSub}>{r.plaats}{r.postcode ? ` · ${r.postcode}` : ''}</Text> : null}
                      </View>
                      <Text style={s.resKies}>Kies</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {zoek.trim().length >= 2 ? (
                <Pressable onPress={startNieuw} style={s.nieuwKnop}>
                  <Text style={s.nieuwKnopT}>➕ “{zoek.trim()}” als nieuwe kermis aanmaken</Text>
                </Pressable>
              ) : (
                <Text style={s.veldHint}>Typ minstens 2 letters om te zoeken.</Text>
              )}
            </>
          ) : (
            <>
              <View style={s.gekozenVak}>
                <View style={{ flex: 1 }}>
                  <Text style={s.gekozenNaam}>{gekozen ? gekozen.naam : naam || 'Nieuwe kermis'}</Text>
                  <Text style={s.gekozenSub}>{gekozen ? '✓ Bestaande kermis' : 'Nieuwe kermis'}</Text>
                </View>
                <Pressable onPress={opnieuwZoeken} hitSlop={8}><Text style={s.wijzig}>Wijzig</Text></Pressable>
              </View>

              {nieuwMode ? (
                <>
                  <Text style={[s.label, { marginTop: 14 }]}>Naam</Text>
                  <TextInput style={s.input} value={naam} onChangeText={setNaam}
                    placeholder="bv. Sinksenfoor Antwerpen" placeholderTextColor={C.muted} />
                  <View style={s.datumRij}>
                    <View style={{ flex: 1.4 }}>
                      <Text style={s.label}>Plaats</Text>
                      <TextInput style={s.input} value={plaats} onChangeText={setPlaats}
                        placeholder="bv. Antwerpen" placeholderTextColor={C.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Postcode</Text>
                      <TextInput style={s.input} value={postcode} onChangeText={setPostcode}
                        keyboardType="number-pad" maxLength={4}
                        placeholder="optioneel" placeholderTextColor={C.muted} />
                    </View>
                  </View>
                </>
              ) : null}

              <View style={s.datumRij}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Van</Text>
                  <DatumVeld value={van} onChange={setVan} vrij />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Tot</Text>
                  <DatumVeld value={tot} onChange={setTot} vrij />
                </View>
              </View>

              {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}

              <Pressable onPress={toevoegen} disabled={bezig} style={[s.knop, s.knopViolet, bezig && s.knopUit]}>
                {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>+ Toevoegen aan agenda</Text>}
              </Pressable>
            </>
          )}

          {fout && !kiesKlaar ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
        </View>

        {melding ? <View style={s.okBox}><Text style={s.okT}>{melding}</Text></View> : null}

        <Text style={[s.blokTitel, { marginTop: 24, marginBottom: 4 }]}>Geplande kermissen</Text>
        {locaties.length === 0
          ? <Text style={s.sub}>Nog niets gepland.</Text>
          : locaties.map((l) => (
            <View key={`${l.kermisId}:${l.attractieId}`} style={s.locRij}>
              <View style={{ flex: 1 }}>
                <Text style={s.locNaam}>{l.naam}</Text>
                <Text style={s.locSub}>
                  {naamVan(l.attractieId)}{l.plaats ? ` · ${l.plaats}` : ''} · {toonDatum(l.van)} → {toonDatum(l.tot)}
                </Text>
              </View>
              <Pressable onPress={() => verwijder(l.kermisId, l.attractieId)} hitSlop={8}>
                <Text style={s.verwijder}>Verwijderen</Text>
              </Pressable>
            </View>
          ))}
      </ScrollView>
    </KeyboardAvoidingView>
  )

  async function verwijder(kermisId: string, attractieId: string) {
    setLocaties((l) => l.filter((x) => !(x.kermisId === kermisId && x.attractieId === attractieId)))
    await supabase.rpc('verwijder_kermis_koppeling', { p_kermis_id: kermisId, p_attractie_id: attractieId })
  }
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  blokTitel: { color: C.ink, fontSize: 16, fontWeight: '800' },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  veldHint: { color: C.muted, fontSize: 12.5, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: C.veld, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.line },
  chipActief: { backgroundColor: C.violet, borderColor: C.violet },
  chipT: { color: C.ink, fontWeight: '700', fontSize: 13.5 },
  chipTActief: { color: '#fff' },
  zoekVak: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14 },
  zoekIcon: { fontSize: 16 },
  zoekInput: { flex: 1, color: C.ink, fontSize: 16, paddingVertical: 13 },
  resultaten: { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  resRij: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.card },
  resIcon: { fontSize: 18 },
  resNaam: { color: C.ink, fontSize: 14.5, fontWeight: '800' },
  resSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  resKies: { color: C.violet, fontWeight: '800', fontSize: 13 },
  nieuwKnop: { marginTop: 10, backgroundColor: 'rgba(139,92,246,0.10)', borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  nieuwKnopT: { color: C.violet, fontWeight: '800', fontSize: 13.5, textAlign: 'center' },
  gekozenVak: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.08)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', borderRadius: 12, padding: 14 },
  gekozenNaam: { color: C.ink, fontSize: 15.5, fontWeight: '900' },
  gekozenSub: { color: C.violet, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  wijzig: { color: C.muted, fontWeight: '800', fontSize: 13 },
  datumRij: { flexDirection: 'row', gap: 12, marginTop: 14 },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopViolet: { backgroundColor: C.violet },
  knopVioletT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  okBox: { backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 11, padding: 12, marginTop: 14 },
  okT: { color: '#0E9E70', fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  locRij: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 10,
  },
  locNaam: { color: C.ink, fontSize: 15.5, fontWeight: '700' },
  locSub: { color: C.muted, fontSize: 12.5, marginTop: 3 },
  verwijder: { color: C.red, fontSize: 13, fontWeight: '700' },
})

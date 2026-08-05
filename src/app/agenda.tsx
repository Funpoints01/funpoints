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
  muted: '#7A7290', violet: '#8B5CF6', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}

function toonDatum(iso: string): string {
  const [j, m, d] = iso.split('-')
  return `${d}-${m}-${j}`
}

type Attr = { id: string; naam: string }
// Eén rij per (kermis × attractie): de gedeelde lijst die ook bezoekers zien.
type Loc = { kermisId: string; attractieId: string; naam: string; plaats: string | null; van: string; tot: string }

export default function Agenda() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [attracties, setAttracties] = useState<Attr[]>([])
  const [locaties, setLocaties] = useState<Loc[]>([])
  const [laden, setLaden] = useState(true)

  const [attrId, setAttrId] = useState<string>('')
  const [naam, setNaam] = useState('')
  const [plaats, setPlaats] = useState('')
  const [postcode, setPostcode] = useState('')
  const [van, setVan] = useState('')
  const [tot, setTot] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

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

  async function toevoegen() {
    setFout('')
    if (!attrId) return setFout('Kies eerst een attractie.')
    if (!naam.trim()) return setFout('Geef een naam.')
    if (!van || !tot) return setFout('Kies een begin- en einddatum.')
    if (postcode.trim() && !/^\d{4}$/.test(postcode.trim())) return setFout('Geef een geldige postcode (4 cijfers).')
    if (tot < van) return setFout('De einddatum ligt vóór de startdatum.')
    setBezig(true)
    const { error } = await supabase.rpc('plan_kermis', {
      p_attractie_id: attrId,
      p_naam: naam.trim(),
      p_plaats: plaats.trim() || naam.trim(),
      p_postcode: postcode.trim(),
      p_van: van,
      p_tot: tot,
    })
    setBezig(false)
    if (error) return setFout('Toevoegen mislukt. Probeer opnieuw.')
    setNaam(''); setPlaats(''); setPostcode(''); setVan(''); setTot('')
    herlaad()
  }

  async function verwijder(kermisId: string, attractieId: string) {
    setLocaties((l) => l.filter((x) => !(x.kermisId === kermisId && x.attractieId === attractieId)))
    await supabase.rpc('verwijder_kermis_koppeling', { p_kermis_id: kermisId, p_attractie_id: attractieId })
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

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/uitbater')} hitSlop={12}><Text style={s.terug}>‹ Dashboard</Text></Pressable>
        <Text style={s.titel}>Agenda</Text>
        <Text style={s.sub}>Waar staan je attracties de komende maanden? Bezoekers zien deze kermissen ook.</Text>

        <View style={s.kaart}>
          <Text style={s.blokTitel}>Nieuwe kermis</Text>

          <Text style={[s.label, { marginTop: 14 }]}>Attractie</Text>
          <View style={s.chips}>
            {attracties.map((a) => (
              <Pressable key={a.id} onPress={() => setAttrId(a.id)}
                style={[s.chip, attrId === a.id && s.chipActief]}>
                <Text style={[s.chipT, attrId === a.id && s.chipTActief]}>{a.naam}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.label, { marginTop: 14 }]}>Naam</Text>
          <TextInput style={s.input} value={naam} onChangeText={setNaam}
            placeholder="bv. Aalst Kermis" placeholderTextColor={C.muted} />

          <View style={s.datumRij}>
            <View style={{ flex: 1.4 }}>
              <Text style={s.label}>Plaats</Text>
              <TextInput style={s.input} value={plaats} onChangeText={setPlaats}
                placeholder="bv. Aalst" placeholderTextColor={C.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Postcode</Text>
              <TextInput style={s.input} value={postcode} onChangeText={setPostcode}
                keyboardType="number-pad" maxLength={4}
                placeholder="optioneel" placeholderTextColor={C.muted} />
            </View>
          </View>

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
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>+ Toevoegen</Text>}
          </Pressable>
        </View>

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
  locRij: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 10,
  },
  locNaam: { color: C.ink, fontSize: 15.5, fontWeight: '700' },
  locSub: { color: C.muted, fontSize: 12.5, marginTop: 3 },
  verwijder: { color: C.red, fontSize: 13, fontWeight: '700' },
})

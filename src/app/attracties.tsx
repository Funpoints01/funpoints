import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase, maakLogin } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', violet: '#8B5CF6', green: '#10B981', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', okbg: 'rgba(16,185,129,0.12)', line: 'rgba(36,27,58,0.10)',
}
const SOORTEN = ['lunapark', 'schietkraam', 'eendjes', 'ander'] as const

type Attr = { id: string; naam: string; soort: string; auth_user_id: string | null; hoofdprijs_naam: string | null; hoofdprijs_punten: number | null }

export default function Attracties() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [uitbaterId, setUitbaterId] = useState<string | null>(null)
  const [attracties, setAttracties] = useState<Attr[]>([])
  const [laden, setLaden] = useState(true)

  const [naam, setNaam] = useState('')
  const [soort, setSoort] = useState<string>('ander')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  const [loginVoor, setLoginVoor] = useState<string | null>(null)
  const [lEmail, setLEmail] = useState('')
  const [lWw, setLWw] = useState('')
  const [lBezig, setLBezig] = useState(false)
  const [lFout, setLFout] = useState('')
  const [bevestigDel, setBevestigDel] = useState<string | null>(null)

  const [prijsVoor, setPrijsVoor] = useState<string | null>(null)
  const [pNaam, setPNaam] = useState('')
  const [pPunten, setPPunten] = useState('')
  const [pBezig, setPBezig] = useState(false)

  async function bewaarPrijs(attractieId: string) {
    setPBezig(true)
    const n = pPunten.trim() ? parseInt(pPunten, 10) : null
    const { error } = await supabase.from('attractie')
      .update({ hoofdprijs_naam: pNaam.trim() || null, hoofdprijs_punten: n && n > 0 ? n : null })
      .eq('id', attractieId)
    setPBezig(false)
    if (!error) { setPrijsVoor(null); herlaad() }
  }

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)) }, [])

  async function herlaad() {
    const { data: u } = await supabase.from('uitbater').select('id').eq('auth_user_id', session!.user.id).maybeSingle()
    setUitbaterId(u?.id ?? null)
    const { data: att } = await supabase.from('attractie').select('id, naam, soort, auth_user_id, hoofdprijs_naam, hoofdprijs_punten').order('naam')
    setAttracties((att ?? []) as Attr[])
    setLaden(false)
  }
  useEffect(() => { if (session) herlaad() }, [session])

  async function voegToe() {
    setFout('')
    if (!naam.trim()) return setFout('Geef een naam.')
    if (!uitbaterId) return setFout('Geen uitbater gevonden voor deze login.')
    setBezig(true)
    const { error } = await supabase.from('attractie').insert({ uitbater_id: uitbaterId, naam: naam.trim(), soort })
    setBezig(false)
    if (error) return setFout('Toevoegen mislukt. Probeer opnieuw.')
    setNaam(''); setSoort('ander'); herlaad()
  }

  async function verwijder(id: string) {
    await supabase.from('attractie').delete().eq('id', id)
    setBevestigDel(null); setAttracties((a) => a.filter((x) => x.id !== id))
  }

  async function loginAanmaken(attractieId: string) {
    setLFout('')
    if (!lEmail.trim()) return setLFout('Geef een e-mailadres.')
    if (lWw.length < 6) return setLFout('Wachtwoord minstens 6 tekens.')
    setLBezig(true)
    try {
      const newId = await maakLogin(lEmail, lWw)
      const { error } = await supabase.from('attractie').update({ auth_user_id: newId }).eq('id', attractieId)
      if (error) throw error
      setLBezig(false); setLoginVoor(null); setLEmail(''); setLWw(''); herlaad()
    } catch (e: any) {
      setLBezig(false)
      const m = String(e?.message ?? '').toLowerCase()
      setLFout(m.includes('registered') || m.includes('already') ? 'Dit e-mailadres bestaat al.' : 'Login aanmaken mislukt.')
    }
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

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/uitbater')} hitSlop={12}><Text style={s.terug}>‹ Dashboard</Text></Pressable>
        <Text style={s.titel}>Attracties & logins</Text>
        <Text style={s.sub}>Beheer je kramen en maak per kraam een foorkramer-login aan.</Text>

        <View style={s.kaart}>
          <Text style={s.blokTitel}>Nieuwe attractie</Text>
          <Text style={[s.label, { marginTop: 14 }]}>Naam</Text>
          <TextInput style={s.input} value={naam} onChangeText={setNaam}
            placeholder="bv. Schietkraam Bavikhove" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>Soort</Text>
          <View style={s.chips}>
            {SOORTEN.map((so) => (
              <Pressable key={so} onPress={() => setSoort(so)} style={[s.chip, soort === so && s.chipActief]}>
                <Text style={[s.chipT, soort === so && s.chipTActief]}>{so}</Text>
              </Pressable>
            ))}
          </View>
          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
          <Pressable onPress={voegToe} disabled={bezig} style={[s.knop, s.knopViolet, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>+ Attractie toevoegen</Text>}
          </Pressable>
        </View>

        <Text style={[s.blokTitel, { marginTop: 24, marginBottom: 4 }]}>Je attracties</Text>
        {attracties.length === 0
          ? <Text style={s.sub}>Nog geen attracties.</Text>
          : attracties.map((a) => (
            <View key={a.id} style={s.attrKaart}>
              <View style={s.attrTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.attrNaam}>{a.naam}</Text>
                  <Text style={s.attrSoort}>{a.soort}</Text>
                </View>
                {a.auth_user_id
                  ? <Text style={s.badgeOk}>✓ login actief</Text>
                  : <Text style={s.badgeGeen}>geen login</Text>}
              </View>

              {prijsVoor === a.id ? (
                <View style={s.loginVak}>
                  <Text style={s.blokTitel}>🎁 Hoofdprijs</Text>
                  <Text style={[s.label, { marginTop: 12 }]}>Naam van de prijs</Text>
                  <TextInput style={s.input} value={pNaam} onChangeText={setPNaam}
                    placeholder="bv. Grote knuffelbeer" placeholderTextColor={C.muted} />
                  <Text style={[s.label, { marginTop: 12 }]}>Punten voor de hoofdprijs</Text>
                  <TextInput style={s.input} value={pPunten} onChangeText={setPPunten}
                    keyboardType="number-pad" placeholder="bv. 500" placeholderTextColor={C.muted} />
                  <View style={s.rij}>
                    <Pressable onPress={() => bewaarPrijs(a.id)} disabled={pBezig} style={[s.knop, s.knopViolet, s.knopHalf, pBezig && s.knopUit]}>
                      {pBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>Opslaan</Text>}
                    </Pressable>
                    <Pressable onPress={() => setPrijsVoor(null)} style={[s.knop, s.knopWit, s.knopHalf]}>
                      <Text style={s.knopWitT}>Annuleren</Text>
                    </Pressable>
                  </View>
                  <Text style={s.tip}>Bezoekers zien hun voortgang naar deze prijs op de kraampagina.</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => { setPrijsVoor(a.id); setPNaam(a.hoofdprijs_naam ?? ''); setPPunten(a.hoofdprijs_punten ? String(a.hoofdprijs_punten) : '') }}
                  style={s.prijsKnop}>
                  <Text style={s.prijsKnopT}>
                    🎁 {a.hoofdprijs_naam && a.hoofdprijs_punten
                      ? `${a.hoofdprijs_naam} · ${a.hoofdprijs_punten} ptn — wijzigen`
                      : 'Hoofdprijs instellen'}
                  </Text>
                </Pressable>
              )}

              {loginVoor === a.id ? (
                <View style={s.loginVak}>
                  <Text style={s.label}>E-mail voor de foorkramer</Text>
                  <TextInput style={s.input} value={lEmail} onChangeText={setLEmail}
                    autoCapitalize="none" keyboardType="email-address"
                    placeholder="kraam@funpoints.be" placeholderTextColor={C.muted} />
                  <Text style={[s.label, { marginTop: 12 }]}>Wachtwoord</Text>
                  <TextInput style={s.input} value={lWw} onChangeText={setLWw}
                    secureTextEntry placeholder="minstens 6 tekens" placeholderTextColor={C.muted} />
                  {lFout ? <View style={s.foutBox}><Text style={s.foutT}>{lFout}</Text></View> : null}
                  <View style={s.rij}>
                    <Pressable onPress={() => loginAanmaken(a.id)} disabled={lBezig}
                      style={[s.knop, s.knopViolet, s.knopHalf, lBezig && s.knopUit]}>
                      {lBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>Login aanmaken</Text>}
                    </Pressable>
                    <Pressable onPress={() => { setLoginVoor(null); setLFout('') }} style={[s.knop, s.knopWit, s.knopHalf]}>
                      <Text style={s.knopWitT}>Annuleren</Text>
                    </Pressable>
                  </View>
                  <Text style={s.tip}>Geef deze e-mail en wachtwoord door aan wie in het kraam staat.</Text>
                </View>
              ) : (
                <View style={s.rij}>
                  {!a.auth_user_id ? (
                    <Pressable onPress={() => { setLoginVoor(a.id); setLEmail(''); setLWw(''); setLFout('') }}
                      style={[s.knopKlein, { borderColor: C.violet }]}>
                      <Text style={[s.knopKleinT, { color: C.violet }]}>+ Login aanmaken</Text>
                    </Pressable>
                  ) : null}
                  {bevestigDel === a.id ? (
                    <Pressable onPress={() => verwijder(a.id)} style={[s.knopKlein, { borderColor: C.red }]}>
                      <Text style={[s.knopKleinT, { color: C.red }]}>Zeker verwijderen?</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setBevestigDel(a.id)} style={s.knopKlein}>
                      <Text style={s.knopKleinT}>Verwijderen</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))}
        <Text style={s.voet}>Een attractie verwijderen wist ook zijn puntengeschiedenis.</Text>
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
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopHalf: { flex: 1, marginTop: 0 },
  rij: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  knopViolet: { backgroundColor: C.violet },
  knopVioletT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  knopWit: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line },
  knopWitT: { color: C.ink, fontWeight: '800', fontSize: 15 },
  knopUit: { opacity: 0.5 },
  knopKlein: { borderRadius: 10, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 9 },
  knopKleinT: { color: C.muted, fontWeight: '700', fontSize: 13 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  attrKaart: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 10,
  },
  attrTop: { flexDirection: 'row', alignItems: 'center' },
  attrNaam: { color: C.ink, fontSize: 16, fontWeight: '800' },
  attrSoort: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  badgeOk: { color: C.green, fontSize: 12.5, fontWeight: '700' },
  badgeGeen: { color: C.muted, fontSize: 12.5, fontWeight: '700' },
  loginVak: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  prijsKnop: { marginTop: 12, backgroundColor: 'rgba(139,92,246,0.10)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  prijsKnopT: { color: C.violet, fontWeight: '800', fontSize: 13.5 },
  tip: { color: C.muted, fontSize: 12, marginTop: 10 },
  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 20, opacity: 0.8 },
})

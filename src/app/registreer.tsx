import { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}

function naarISO(s: string): string | null {
  const d = s.match(/\d+/g)
  if (!d || d.length < 3) return null
  const [dag, maand, jaar] = d
  if (jaar.length !== 4) return null
  const di = parseInt(dag, 10), mi = parseInt(maand, 10), ji = parseInt(jaar, 10)
  if (di < 1 || di > 31 || mi < 1 || mi > 12 || ji < 1900) return null
  return `${jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`
}

export default function Registreer() {
  const router = useRouter()
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [gb, setGb] = useState('')
  const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  async function registreer() {
    setFout('')
    if (!naam.trim()) return setFout('Vul je naam in.')
    const iso = naarISO(gb)
    if (!iso) return setFout('Geef je geboortedatum als DD-MM-JJJJ.')
    if (!email.trim()) return setFout('Vul je e-mailadres in.')
    if (ww.length < 6) return setFout('Kies een wachtwoord van minstens 6 tekens.')

    setBezig(true)
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: ww })
    if (error) {
      setBezig(false)
      return setFout(
        error.message.toLowerCase().includes('registered') || error.message.toLowerCase().includes('already')
          ? 'Dit e-mailadres heeft al een account.'
          : 'Registreren mislukt. Controleer je e-mailadres.'
      )
    }
    if (!data.session || !data.user) {
      setBezig(false)
      return setFout('Account aangemaakt, maar e-mailbevestiging staat nog aan in Supabase.')
    }
    // Profiel opslaan
    const { error: e2 } = await supabase.from('bezoeker').insert({
      auth_user_id: data.user.id, naam: naam.trim(), email: email.trim(), geboortedatum: iso,
    })
    if (e2) {
      setBezig(false)
      return setFout('Account gemaakt, maar je profiel opslaan mislukte. Probeer opnieuw.')
    }
    // Kaartje koppelen (punten verhuizen mee) — niet-blokkerend
    if (code) {
      await supabase.rpc('claim_via_code', { p_claim_code: String(code).trim() })
    }
    setBezig(false)
    router.replace('/bezoeker')
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/')} hitSlop={12}>
          <Text style={s.terug}>‹ Terug</Text>
        </Pressable>

        <View style={s.logo}>
          <View style={s.mark}><Text style={s.markT}>F</Text></View>
          <Text style={s.logoT}>Funpoints</Text>
        </View>

        <Text style={s.titel}>Account aanmaken</Text>
        <Text style={s.sub}>
          {code
            ? 'Je spaarkaart wordt meteen aan je account gekoppeld — je punten gaan mee.'
            : 'Maak je Funpoints-account aan om je punten te bewaren.'}
        </Text>

        <View style={s.kaart}>
          <Text style={s.label}>Naam</Text>
          <TextInput style={s.input} value={naam} onChangeText={setNaam}
            placeholder="Voor- en achternaam" placeholderTextColor={C.muted} />

          <Text style={[s.label, { marginTop: 14 }]}>E-mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="jij@voorbeeld.be" placeholderTextColor={C.muted} />

          <Text style={[s.label, { marginTop: 14 }]}>Geboortedatum</Text>
          <TextInput style={s.input} value={gb} onChangeText={setGb}
            keyboardType="numbers-and-punctuation"
            placeholder="DD-MM-JJJJ" placeholderTextColor={C.muted} />

          <Text style={[s.label, { marginTop: 14 }]}>Wachtwoord</Text>
          <TextInput style={s.input} value={ww} onChangeText={setWw}
            secureTextEntry placeholder="minstens 6 tekens" placeholderTextColor={C.muted} />

          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}

          <Pressable onPress={registreer} disabled={bezig} style={[s.knop, s.knopCoral, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopCoralT}>Account aanmaken</Text>}
          </Pressable>

          <Pressable onPress={() => router.push('/bezoeker')} hitSlop={8} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={s.link}>Heb je al een account? Inloggen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1 },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  markT: { color: '#fff', fontWeight: '900', fontSize: 19 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', marginTop: 22, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6, lineHeight: 21 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  knopCoral: { backgroundColor: C.coral },
  knopCoralT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  link: { color: C.muted, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
})

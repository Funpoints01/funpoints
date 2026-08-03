import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#0B0A1F', card: '#17152E', card2: '#1E1B38', ink: '#F5F6FF',
  muted: '#9A9AC2', green: '#10B981', greenl: '#34D399', red: '#F87171',
  redbg: 'rgba(248,113,113,0.12)', okbg: 'rgba(16,185,129,0.12)',
  line: 'rgba(255,255,255,0.10)',
}

export default function Index() {
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLaden(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (laden) {
    return (
      <View style={[s.scherm, s.center]}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    )
  }
  return session ? <Boeken session={session} /> : <Login />
}

function Logo() {
  return (
    <View style={s.logo}>
      <View style={s.mark}><Text style={s.markT}>F</Text></View>
      <Text style={s.logoT}>Funpoints</Text>
    </View>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  async function login() {
    setFout('')
    setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password: ww,
    })
    setBezig(false)
    if (error) setFout('Inloggen mislukt — controleer je e-mail en wachtwoord.')
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.wrap, s.center]} keyboardShouldPersistTaps="handled">
        <Logo />
        <Text style={s.titel}>Attractie-login</Text>
        <Text style={s.sub}>Log in met de account van deze attractie.</Text>

        <View style={s.kaart}>
          <Text style={s.label}>E-mail</Text>
          <TextInput
            style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="attractie@funpoints.be" placeholderTextColor={C.muted}
          />
          <Text style={[s.label, { marginTop: 14 }]}>Wachtwoord</Text>
          <TextInput
            style={s.input} value={ww} onChangeText={setWw}
            secureTextEntry placeholder="••••••••" placeholderTextColor={C.muted}
          />

          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}

          <Pressable onPress={login} disabled={bezig} style={[s.knop, s.knopGroen, bezig && s.knopUit]}>
            {bezig
              ? <ActivityIndicator color="#04121a" />
              : <Text style={s.knopGroenT}>Inloggen</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function vertaalFout(m: string): string {
  if (m.includes('ONVOLDOENDE_SALDO')) return 'Onvoldoende saldo op dit kaartje.'
  if (m.includes('KAARTJE_ONBEKEND')) return 'Deze kaartje-code bestaat niet.'
  if (m.includes('NIET_GEMACHTIGD')) return 'Deze login is geen attractie — boeken mag niet.'
  if (m.includes('PUNTEN_MOET_POSITIEF')) return 'Geef een positief aantal punten.'
  if (m.includes('GEEF_BEZOEKER_OF_KAARTJE')) return 'Geen geldige drager (kaartje).'
  return 'Er ging iets mis. Probeer opnieuw.'
}

function Boeken({ session }: { session: Session }) {
  const [naam, setNaam] = useState<string | null>(null)
  const [naamLaden, setNaamLaden] = useState(true)
  const [code, setCode] = useState('')
  const [punten, setPunten] = useState('')
  const [bezig, setBezig] = useState(false)
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null)

  useEffect(() => {
    supabase.from('attractie').select('naam')
      .eq('auth_user_id', session.user.id).maybeSingle()
      .then(({ data }) => { setNaam(data?.naam ?? null); setNaamLaden(false) })
  }, [])

  async function boek(soort: 'toevoegen' | 'aftrekken') {
    const n = parseInt(punten, 10)
    if (!code.trim()) { setMelding({ ok: false, tekst: 'Typ eerst een kaartje-code.' }); return }
    if (!n || n <= 0) { setMelding({ ok: false, tekst: 'Geef een positief aantal punten.' }); return }
    setBezig(true)
    setMelding(null)
    const { data, error } = await supabase.rpc('boek_punten', {
      p_punten: n, p_soort: soort, p_kaartje_code: code.trim(),
    })
    setBezig(false)
    if (error) {
      setMelding({ ok: false, tekst: vertaalFout(error.message) })
    } else {
      const teken = soort === 'toevoegen' ? '+' : '−'
      setMelding({ ok: true, tekst: `${teken}${n} geboekt. Nieuw saldo: ${data} punten.` })
      setPunten('')
    }
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.topbar}>
          <Logo />
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={s.uitlog}>Uitloggen</Text>
          </Pressable>
        </View>

        <Text style={s.titel}>Punten boeken</Text>
        <Text style={s.sub}>
          {naamLaden ? 'Ingelogd…'
            : naam ? `Attractie: ${naam}`
            : 'Let op: deze login is aan geen attractie gekoppeld.'}
        </Text>

        <View style={s.kaart}>
          <Text style={s.label}>Kaartje-code</Text>
          <TextInput
            style={s.input} value={code} onChangeText={setCode}
            autoCapitalize="characters" autoCorrect={false}
            placeholder="bv. TEST123" placeholderTextColor={C.muted}
          />

          <Text style={[s.label, { marginTop: 14 }]}>Aantal punten</Text>
          <TextInput
            style={s.input} value={punten} onChangeText={setPunten}
            keyboardType="number-pad" placeholder="bv. 50" placeholderTextColor={C.muted}
          />

          {melding
            ? <View style={[s.foutBox, melding.ok && s.okBox]}>
                <Text style={[s.foutT, melding.ok && s.okT]}>{melding.tekst}</Text>
              </View>
            : null}

          <View style={s.knoppenRij}>
            <Pressable onPress={() => boek('toevoegen')} disabled={bezig}
              style={[s.knop, s.knopGroen, s.knopHalf, bezig && s.knopUit]}>
              <Text style={s.knopGroenT}>+ Toevoegen</Text>
            </Pressable>
            <Pressable onPress={() => boek('aftrekken')} disabled={bezig}
              style={[s.knop, s.knopDonker, s.knopHalf, bezig && s.knopUit]}>
              <Text style={s.knopDonkerT}>− Aftrekken</Text>
            </Pressable>
          </View>
          {bezig ? <ActivityIndicator color={C.green} style={{ marginTop: 14 }} /> : null}
        </View>

        <Text style={s.voet}>Fase 1 · kaartje-code met de hand · QR-scan komt hierna</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 22, paddingTop: 60, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center' },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
  },
  markT: { color: '#04121a', fontWeight: '800', fontSize: 18 },
  logoT: { color: C.ink, fontWeight: '700', fontSize: 18 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  uitlog: { color: C.muted, fontSize: 14, fontWeight: '600' },
  titel: { color: C.ink, fontSize: 26, fontWeight: '800', marginTop: 24 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6, marginBottom: 4 },
  kaart: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line,
    padding: 20, marginTop: 18,
  },
  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginBottom: 7 },
  input: {
    backgroundColor: C.card2, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopHalf: { flex: 1, marginTop: 0 },
  knoppenRij: { flexDirection: 'row', gap: 12, marginTop: 18 },
  knopGroen: { backgroundColor: C.green },
  knopGroenT: { color: '#04121a', fontWeight: '800', fontSize: 16 },
  knopDonker: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line },
  knopDonkerT: { color: C.ink, fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  okBox: { backgroundColor: C.okbg },
  okT: { color: C.greenl },
  voet: { color: '#6E6E93', fontSize: 12, textAlign: 'center', marginTop: 26 },
})
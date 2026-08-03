import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', green: '#10B981', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}

export default function BezoekerScherm() {
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLaden(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (laden) {
    return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.coral} size="large" /></View>
  }
  return session ? <Account session={session} /> : <Login />
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
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  async function login() {
    setFout('')
    setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: ww })
    setBezig(false)
    if (error) setFout('Inloggen mislukt — controleer je e-mail en wachtwoord.')
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/')} hitSlop={12}>
          <Text style={s.terug}>‹ Terug</Text>
        </Pressable>
        <Logo />
        <Text style={s.titel}>Bezoeker</Text>
        <Text style={s.sub}>Log in om je punten en QR-codes te bekijken.</Text>

        <View style={s.kaart}>
          <Text style={s.label}>E-mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="jij@voorbeeld.be" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>Wachtwoord</Text>
          <TextInput style={s.input} value={ww} onChangeText={setWw}
            secureTextEntry placeholder="••••••••" placeholderTextColor={C.muted} />

          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}

          <Pressable onPress={login} disabled={bezig} style={[s.knop, s.knopCoral, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopCoralT}>Inloggen</Text>}
          </Pressable>
        </View>

        <View style={s.infoBox}>
          <Text style={s.infoT}>
            Nog geen account? Scan de code op de <Text style={{ fontWeight: '800' }}>achterkant</Text> van je
            Funpoints-kaartje om je te registreren.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

type Kraam = { id: string; naam: string; soort: string; saldo: number }

function Account({ session }: { session: Session }) {
  const router = useRouter()
  const [naam, setNaam] = useState<string>('')
  const [code, setCode] = useState<string | null>(null)
  const [kramen, setKramen] = useState<Kraam[]>([])
  const [laden, setLaden] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: bez } = await supabase.from('bezoeker')
        .select('naam, code').eq('auth_user_id', session.user.id).maybeSingle()
      setNaam(bez?.naam ?? '')
      setCode(bez?.code ?? null)

      const { data: att } = await supabase.from('attractie_publiek').select('id, naam, soort')
      const { data: sal } = await supabase.from('saldo').select('attractie_id, saldo')
      const saldoMap = new Map<string, number>()
      ;(sal ?? []).forEach((r: any) => {
        saldoMap.set(r.attractie_id, (saldoMap.get(r.attractie_id) ?? 0) + (r.saldo ?? 0))
      })
      const lijst: Kraam[] = (att ?? []).map((a: any) => ({
        id: a.id, naam: a.naam, soort: a.soort, saldo: saldoMap.get(a.id) ?? 0,
      })).sort((x, y) => y.saldo - x.saldo || x.naam.localeCompare(y.naam))
      setKramen(lijst)
      setLaden(false)
    })()
  }, [])

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.topbar}>
          <Logo />
          <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }}>
            <Text style={s.uitlog}>Uitloggen</Text>
          </Pressable>
        </View>

        <Text style={s.titel}>Hallo{naam ? `, ${naam.split(' ')[0]}` : ''} 👋</Text>
        <Text style={s.sub}>Tik op een kraam om je QR te tonen aan de foorkramer.</Text>

        {laden
          ? <ActivityIndicator color={C.coral} size="large" style={{ marginTop: 40 }} />
          : kramen.length === 0
            ? <View style={s.infoBox}><Text style={s.infoT}>Er zijn nog geen aangesloten kramen.</Text></View>
            : (
              <View style={{ marginTop: 18, gap: 12 }}>
                {kramen.map((k) => (
                  <Pressable key={k.id} style={s.kraart}
                    onPress={() => setOpenId(openId === k.id ? null : k.id)}>
                    <View style={s.kraartRij}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.kraartNaam}>{k.naam}</Text>
                        <Text style={s.kraartSoort}>{k.soort}</Text>
                      </View>
                      <View style={s.saldoBox}>
                        <Text style={s.saldoNum}>{k.saldo}</Text>
                        <Text style={s.saldoLbl}>punten</Text>
                      </View>
                    </View>

                    {openId === k.id
                      ? (
                        <View style={s.qrBox}>
                          {code
                            ? <View style={s.qrWit}>
                                <QRCode value={`FP-B:${code}:${k.id}`} size={168}
                                  backgroundColor="#FFFFFF" color="#241B3A" />
                              </View>
                            : <Text style={s.kraartSoort}>QR wordt geladen…</Text>}
                          <Text style={s.qrHint}>Toon deze QR aan de foorkramer van {k.naam}</Text>
                        </View>
                      )
                      : <Text style={s.toon}>Tik om je QR te tonen ›</Text>}
                  </Pressable>
                ))}
              </View>
            )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  markT: { color: '#fff', fontWeight: '900', fontSize: 19 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  uitlog: { color: C.muted, fontSize: 14, fontWeight: '600' },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', marginTop: 18, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6 },
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
  infoBox: { backgroundColor: 'rgba(251,113,133,0.10)', borderRadius: 14, padding: 16, marginTop: 20 },
  infoT: { color: C.ink, fontSize: 14, lineHeight: 20 },
  kraart: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  kraartRij: { flexDirection: 'row', alignItems: 'center' },
  kraartNaam: { color: C.ink, fontSize: 17, fontWeight: '800' },
  kraartSoort: { color: C.muted, fontSize: 13, marginTop: 2 },
  saldoBox: { alignItems: 'flex-end' },
  saldoNum: { color: C.green, fontSize: 26, fontWeight: '900' },
  saldoLbl: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: -2 },
  toon: { color: C.coral, fontSize: 13, fontWeight: '700', marginTop: 12 },
  qrBox: { alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  qrWit: { backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line },
  qrHint: { color: C.muted, fontSize: 12.5, marginTop: 12, textAlign: 'center' },
})

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', green: '#10B981', greend: '#0E9E70', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', okbg: 'rgba(16,185,129,0.12)',
  line: 'rgba(36,27,58,0.10)',
}

export default function FoorkramerScherm() {
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
  const router = useRouter()
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
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/')} hitSlop={12}>
          <Text style={s.terug}>‹ Terug</Text>
        </Pressable>

        <Logo />
        <Text style={s.titel}>Foorkramer</Text>
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
              ? <ActivityIndicator color="#fff" />
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
  if (m.includes('BEZOEKER_ONBEKEND')) return 'Deze klant-QR is niet gekend.'
  if (m.includes('NIET_GEMACHTIGD')) return 'Deze login is geen attractie — boeken mag niet.'
  if (m.includes('PUNTEN_MOET_POSITIEF')) return 'Geef een positief aantal punten.'
  if (m.includes('GEEF_BEZOEKER_OF_KAARTJE')) return 'Geen geldige drager (kaartje).'
  return 'Er ging iets mis. Probeer opnieuw.'
}

function Scanner({ onScan, onSluit }: { onScan: (code: string) => void; onSluit: () => void }) {
  const [perm, requestPerm] = useCameraPermissions()
  const [klaar, setKlaar] = useState(false)

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm()
  }, [perm])

  if (!perm) {
    return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.green} /></View>
  }
  if (!perm.granted) {
    return (
      <View style={[s.scherm, s.center, { padding: 28 }]}>
        <Text style={s.scanUitleg}>Funpoints heeft toegang tot je camera nodig om kaartjes te scannen.</Text>
        <Pressable style={[s.knop, s.knopGroen, { alignSelf: 'stretch' }]} onPress={requestPerm}>
          <Text style={s.knopGroenT}>Camera toestaan</Text>
        </Pressable>
        <Pressable style={{ marginTop: 16 }} onPress={onSluit}>
          <Text style={s.terug}>Annuleren</Text>
        </Pressable>
      </View>
    )
  }
  return (
    <View style={[s.scherm, { backgroundColor: '#000' }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={klaar ? undefined : ({ data }) => { setKlaar(true); onScan(data) }}
      />
      <View style={s.scanOverlay}>
        <View style={s.scanKader} />
        <Text style={s.scanHint}>Richt op de QR-code van het kaartje</Text>
        <Pressable style={[s.knop, s.knopWit, { alignSelf: 'stretch' }]} onPress={onSluit}>
          <Text style={s.knopWitT}>Sluiten</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Boeken({ session }: { session: Session }) {
  const router = useRouter()
  const [naam, setNaam] = useState<string | null>(null)
  const [naamLaden, setNaamLaden] = useState(true)
  const [code, setCode] = useState('')
  const [isBezoeker, setIsBezoeker] = useState(false)
  const [punten, setPunten] = useState('')
  const [bezig, setBezig] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [klantSaldo, setKlantSaldo] = useState<number | null>(null)
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null)

  async function haalSaldo(rawCode: string, bez: boolean) {
    const c = rawCode.trim()
    if (!c) { setKlantSaldo(null); return }
    const { data, error } = bez
      ? await supabase.rpc('huidig_saldo', { p_bezoeker_code: c })
      : await supabase.rpc('huidig_saldo', { p_kaartje_code: c })
    setKlantSaldo(error ? null : (data as number))
  }

  useEffect(() => {
    supabase.from('attractie').select('naam')
      .eq('auth_user_id', session.user.id).maybeSingle()
      .then(({ data }) => { setNaam(data?.naam ?? null); setNaamLaden(false) })
  }, [])

  async function boek(soort: 'toevoegen' | 'aftrekken') {
    const n = parseInt(punten, 10)
    if (!code.trim()) { setMelding({ ok: false, tekst: 'Scan of typ eerst een kaartje-code.' }); return }
    if (!n || n <= 0) { setMelding({ ok: false, tekst: 'Geef een positief aantal punten.' }); return }
    setBezig(true)
    setMelding(null)
    const { data, error } = isBezoeker
      ? await supabase.rpc('boek_bezoeker', {
          p_bezoeker_code: code.trim(), p_punten: n, p_soort: soort,
        })
      : await supabase.rpc('boek_punten', {
          p_punten: n, p_soort: soort, p_kaartje_code: code.trim(),
        })
    setBezig(false)
    if (error) {
      setMelding({ ok: false, tekst: vertaalFout(error.message) })
    } else {
      const teken = soort === 'toevoegen' ? '+' : '−'
      setMelding({ ok: true, tekst: `${teken}${n} geboekt. Nieuw saldo: ${data} punten.` })
      setPunten('')
      setKlantSaldo(data as number)
    }
  }

  if (scannerOpen) {
    return (
      <Scanner
        onScan={(d) => {
          const raw = d.trim()
          let c = ''; let bez = false
          if (raw.startsWith('FP-B:')) {
            c = (raw.split(':')[1] ?? '').trim(); bez = true
          } else {
            c = raw.toUpperCase(); bez = false
          }
          setCode(c); setIsBezoeker(bez)
          setScannerOpen(false); setMelding(null)
          haalSaldo(c, bez)
        }}
        onSluit={() => setScannerOpen(false)}
      />
    )
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.topbar}>
          <Logo />
          <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }}>
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
          <Pressable style={[s.knop, s.knopGroen, { marginTop: 0 }]} onPress={() => setScannerOpen(true)}>
            <Text style={s.knopGroenT}>📷 Scan kaartje</Text>
          </Pressable>

          <Text style={[s.label, { marginTop: 18 }]}>Kaartje-code</Text>
          <TextInput
            style={s.input} value={code}
            onChangeText={(t) => { setCode(t); setIsBezoeker(false); setKlantSaldo(null) }}
            onBlur={() => haalSaldo(code, isBezoeker)}
            autoCapitalize="characters" autoCorrect={false}
            placeholder="of typ bv. TEST123" placeholderTextColor={C.muted}
          />
          {isBezoeker ? <Text style={s.klantNote}>👤 Klant-QR herkend</Text> : null}

          {klantSaldo !== null ? (
            <View style={s.saldoInfo}>
              <Text style={s.saldoInfoLabel}>Huidig saldo van deze klant</Text>
              <Text style={s.saldoInfoT}>{klantSaldo} punten</Text>
            </View>
          ) : null}

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
              style={[s.knop, s.knopWit, s.knopHalf, bezig && s.knopUit]}>
              <Text style={s.knopWitT}>− Aftrekken</Text>
            </Pressable>
          </View>
          {bezig ? <ActivityIndicator color={C.green} style={{ marginTop: 14 }} /> : null}
        </View>

        <Text style={s.voet}>Fase 1 · scan of typ de kaartje-code</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  markT: { color: '#fff', fontWeight: '900', fontSize: 19 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  uitlog: { color: C.muted, fontSize: 14, fontWeight: '600' },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', marginTop: 22, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6, marginBottom: 4 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopHalf: { flex: 1, marginTop: 0 },
  knoppenRij: { flexDirection: 'row', gap: 12, marginTop: 18 },
  knopGroen: { backgroundColor: C.green },
  knopGroenT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopWit: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line },
  knopWitT: { color: C.ink, fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  okBox: { backgroundColor: C.okbg },
  okT: { color: C.greend },
  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 26, opacity: 0.7 },
  klantNote: { color: C.green, fontSize: 13, fontWeight: '700', marginTop: 8 },
  saldoInfo: {
    backgroundColor: C.okbg, borderRadius: 12, padding: 14, marginTop: 14,
    alignItems: 'center',
  },
  saldoInfoLabel: { color: C.greend, fontSize: 13, fontWeight: '700' },
  saldoInfoT: { color: C.greend, fontSize: 26, fontWeight: '900', marginTop: 2 },
  scanOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 0,
    justifyContent: 'center', alignItems: 'center', padding: 28, gap: 20,
  },
  scanKader: {
    width: 240, height: 240, borderRadius: 24,
    borderWidth: 3, borderColor: C.green, backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  scanUitleg: { color: C.ink, fontSize: 15.5, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
})

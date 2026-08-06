import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#F7F6FB', card: '#FFFFFF', veld: '#F1EEF9', ink: '#241B3A',
  muted: '#7A7290', violet: '#8B5CF6', violetD: '#6D28D9', green: '#10B981',
  coral: '#FB7185', amber: '#F59E0B', red: '#E11D48', redbg: 'rgba(225,29,72,0.10)',
  line: 'rgba(36,27,58,0.10)',
}
const PROV: Record<string, string> = {
  ANT: 'Antwerpen', OVL: 'Oost-Vlaanderen', WVL: 'West-Vlaanderen', VBR: 'Vlaams-Brabant',
  LIM: 'Limburg', BRU: 'Brussel', WBR: 'Waals-Brabant', HEN: 'Henegouwen',
  NAM: 'Namen', LIE: 'Luik', LUX: 'Luxemburg', Onbekend: 'Onbekend',
}

export default function Beheer() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [manager, setManager] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setManager(null) })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setManager(false); return }
    supabase.rpc('is_manager').then(({ data }) => setManager(data === true))
  }, [session])

  if (session === undefined || (session && manager === null)) {
    return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>
  }
  if (!session) return <Login />
  if (!manager) return <GeenToegang />
  return <Dashboard />
}

function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  async function login() {
    setFout(''); setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: ww })
    setBezig(false)
    if (error) setFout('Inloggen mislukt — controleer je e-mail en wachtwoord.')
  }
  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.loginWrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/')} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>
        <View style={s.mark}><Text style={s.markT}>F</Text></View>
        <Text style={s.titel}>Management</Text>
        <Text style={s.sub}>Enkel voor het Funpoints-team.</Text>
        <View style={s.kaart}>
          <Text style={s.label}>E-mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" placeholder="jij@funpoints.be" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>Wachtwoord</Text>
          <TextInput style={s.input} value={ww} onChangeText={setWw} secureTextEntry placeholder="••••••••" placeholderTextColor={C.muted} />
          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
          <Pressable onPress={login} disabled={bezig} style={[s.knop, bezig && { opacity: 0.5 }]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopT}>Inloggen</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function GeenToegang() {
  const router = useRouter()
  return (
    <View style={[s.scherm, s.center, { padding: 28 }]}>
      <Text style={{ fontSize: 40 }}>🔒</Text>
      <Text style={[s.titel, { textAlign: 'center', marginTop: 10 }]}>Geen toegang</Text>
      <Text style={[s.sub, { textAlign: 'center' }]}>Dit account is geen manager. Vraag een beheerder om je toe te voegen.</Text>
      <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }} style={[s.knop, { marginTop: 18, paddingHorizontal: 24 }]}>
        <Text style={s.knopT}>Uitloggen</Text>
      </Pressable>
    </View>
  )
}

function Balk({ label, aantal, max, kleur }: { label: string; aantal: number; max: number; kleur: string }) {
  const pct = max > 0 ? Math.round((aantal / max) * 100) : 0
  return (
    <View style={s.balkRij}>
      <Text style={s.balkLabel} numberOfLines={1}>{label}</Text>
      <View style={s.balkBg}><View style={[s.balkVul, { width: `${pct}%`, backgroundColor: kleur }]} /></View>
      <Text style={s.balkNum}>{aantal}</Text>
    </View>
  )
}

function Dashboard() {
  const router = useRouter()
  const [ov, setOv] = useState<any>(null)
  const [leeftijden, setLeeftijden] = useState<any[]>([])
  const [provincies, setProvincies] = useState<any[]>([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: l }, { data: p }] = await Promise.all([
        supabase.rpc('mgmt_overzicht'),
        supabase.rpc('mgmt_leeftijden'),
        supabase.rpc('mgmt_provincies'),
      ])
      setOv(o); setLeeftijden(l ?? []); setProvincies(p ?? [])
      setLaden(false)
    })()
  }, [])

  const maxL = Math.max(1, ...leeftijden.map((r: any) => Number(r.aantal)))
  const maxP = Math.max(1, ...provincies.map((r: any) => Number(r.aantal)))

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.top}>
          <View style={s.logo}><View style={s.markSm}><Text style={s.markTSm}>F</Text></View><Text style={s.logoT}>Management</Text></View>
          <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }} hitSlop={8}><Text style={s.uitlog}>Uitloggen</Text></Pressable>
        </View>

        {laden ? <View style={{ paddingVertical: 50 }}><ActivityIndicator color={C.violet} size="large" /></View> : (
          <>
            <View style={s.tegels}>
              <View style={s.tegel}><Text style={s.tegelNum}>{ov?.actieve_accounts ?? 0}</Text><Text style={s.tegelLbl}>Actieve accounts</Text></View>
              <View style={s.tegel}><Text style={s.tegelNum}>{ov?.attracties ?? 0}</Text><Text style={s.tegelLbl}>Attracties</Text></View>
              <View style={s.tegel}><Text style={s.tegelNum}>{ov?.kermissen ?? 0}</Text><Text style={s.tegelLbl}>Kermissen</Text></View>
              <View style={s.tegel}><Text style={s.tegelNum}>{ov?.check_ins ?? 0}</Text><Text style={s.tegelLbl}>Check-ins</Text></View>
            </View>

            <View style={s.blok}>
              <Text style={s.blokTitel}>Leeftijdscategorieën</Text>
              <Text style={s.blokSub}>Van de geactiveerde accounts</Text>
              <View style={{ marginTop: 12, gap: 9 }}>
                {leeftijden.length === 0 ? <Text style={s.leeg}>Nog geen data.</Text> :
                  leeftijden.map((r: any) => <Balk key={r.categorie} label={r.categorie} aantal={Number(r.aantal)} max={maxL} kleur={C.violet} />)}
              </View>
            </View>

            <View style={s.blok}>
              <Text style={s.blokTitel}>Gebruikers per provincie</Text>
              <Text style={s.blokSub}>Op basis van postcode · de kaart-heatmap komt eraan</Text>
              <View style={{ marginTop: 12, gap: 9 }}>
                {provincies.length === 0 ? <Text style={s.leeg}>Nog geen data.</Text> :
                  provincies.map((r: any) => <Balk key={r.provincie} label={PROV[r.provincie] ?? r.provincie} aantal={Number(r.aantal)} max={maxP} kleur={C.green} />)}
              </View>
            </View>

            <View style={[s.blok, s.komt]}>
              <Text style={s.blokTitel}>Binnenkort in dit dashboard</Text>
              <Text style={s.komtT}>• Lijngrafiek van accounts over tijd (slapende kaartjes vs. geactiveerd){'\n'}• Attracties aanklikbaar met openstaande punten &amp; uitgedeelde accounts{'\n'}• Kermissen toevoegen &amp; aanpassen{'\n'}• Heatmap op de Belgische kaart</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  wrap: { padding: 24, paddingTop: 34, maxWidth: 900, width: '100%', alignSelf: 'center' },
  loginWrap: { padding: 24, paddingTop: 60, maxWidth: 420, width: '100%', alignSelf: 'center', flexGrow: 1 },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  mark: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center' },
  markT: { color: '#fff', fontWeight: '900', fontSize: 22 },
  titel: { color: C.ink, fontSize: 26, fontWeight: '900', marginTop: 14, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6 },
  kaart: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18 },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  knop: { backgroundColor: C.violet, borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markSm: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center' },
  markTSm: { color: '#fff', fontWeight: '900', fontSize: 18 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  uitlog: { color: C.muted, fontSize: 14, fontWeight: '700' },
  tegels: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  tegel: { flexGrow: 1, flexBasis: 170, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 18 },
  tegelNum: { color: C.violetD, fontSize: 30, fontWeight: '900' },
  tegelLbl: { color: C.muted, fontSize: 13, fontWeight: '700', marginTop: 2 },
  blok: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 16 },
  blokTitel: { color: C.ink, fontSize: 16, fontWeight: '900' },
  blokSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  leeg: { color: C.muted, fontSize: 13 },
  balkRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balkLabel: { width: 130, color: C.ink, fontSize: 13, fontWeight: '700' },
  balkBg: { flex: 1, height: 14, backgroundColor: C.veld, borderRadius: 999, overflow: 'hidden' },
  balkVul: { height: 14, borderRadius: 999 },
  balkNum: { width: 44, textAlign: 'right', color: C.ink, fontSize: 13, fontWeight: '800' },
  komt: { backgroundColor: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.25)' },
  komtT: { color: C.muted, fontSize: 13, lineHeight: 22, marginTop: 8, fontWeight: '600' },
})

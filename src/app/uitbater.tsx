import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', violet: '#8B5CF6', green: '#10B981', coral: '#FB7185',
  red: '#E11D48', redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}

export default function UitbaterScherm() {
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLaden(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>
  return session ? <Dashboard session={session} /> : <Login />
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
    setFout(''); setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: ww })
    setBezig(false)
    if (error) setFout('Inloggen mislukt — controleer je e-mail en wachtwoord.')
  }
  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/')} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>
        <Logo />
        <Text style={s.titel}>Uitbater</Text>
        <Text style={s.sub}>Log in om je attracties, cijfers en agenda te beheren.</Text>
        <View style={s.kaart}>
          <Text style={s.label}>E-mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="uitbater@funpoints.be" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>Wachtwoord</Text>
          <TextInput style={s.input} value={ww} onChangeText={setWw}
            secureTextEntry placeholder="••••••••" placeholderTextColor={C.muted} />
          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
          <Pressable onPress={login} disabled={bezig} style={[s.knop, s.knopViolet, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>Inloggen</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function laatsteDagen(n: number): Date[] {
  const uit: Date[] = []
  const nu = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - i)
    uit.push(d)
  }
  return uit
}
function dagKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Attr = { id: string; naam: string; soort: string }

function Dashboard({ session }: { session: Session }) {
  const router = useRouter()
  const [naam, setNaam] = useState<string>('')
  const [isUitbater, setIsUitbater] = useState<boolean | null>(null)
  const [attracties, setAttracties] = useState<Attr[]>([])
  const [openstaand, setOpenstaand] = useState(0)
  const [opgeladen, setOpgeladen] = useState(0)
  const [ingewisseld, setIngewisseld] = useState(0)
  const [perAttr, setPerAttr] = useState<Record<string, { saldo: number; boekingen: number }>>({})
  const [dagen, setDagen] = useState<{ label: string; waarde: number }[]>([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.from('uitbater').select('naam')
        .eq('auth_user_id', session.user.id).maybeSingle()
      if (!u) { setIsUitbater(false); setLaden(false); return }
      setIsUitbater(true); setNaam(u.naam ?? '')

      const [{ data: att }, { data: sal }, { data: boek }] = await Promise.all([
        supabase.from('attractie').select('id, naam, soort'),
        supabase.from('saldo').select('attractie_id, saldo'),
        supabase.from('puntenboeking').select('attractie_id, created_at, punten, soort'),
      ])
      const attrLijst = (att ?? []) as Attr[]
      setAttracties(attrLijst)

      const pa: Record<string, { saldo: number; boekingen: number }> = {}
      attrLijst.forEach((a) => { pa[a.id] = { saldo: 0, boekingen: 0 } })
      let tot = 0
      ;(sal ?? []).forEach((r: any) => {
        tot += r.saldo ?? 0
        if (pa[r.attractie_id]) pa[r.attractie_id].saldo += r.saldo ?? 0
      })
      setOpenstaand(tot)

      let up = 0, neer = 0
      const perDag: Record<string, number> = {}
      ;(boek ?? []).forEach((r: any) => {
        if (r.soort === 'toevoegen') up += r.punten
        else neer += Math.abs(r.punten)
        if (pa[r.attractie_id]) pa[r.attractie_id].boekingen += 1
        if (r.soort === 'toevoegen') {
          const k = String(r.created_at).slice(0, 10)
          perDag[k] = (perDag[k] ?? 0) + r.punten
        }
      })
      setOpgeladen(up); setIngewisseld(neer); setPerAttr(pa)

      const reeks = laatsteDagen(14).map((d) => ({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        waarde: perDag[dagKey(d)] ?? 0,
      }))
      setDagen(reeks)
      setLaden(false)
    })()
  }, [])

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>

  if (isUitbater === false) {
    return (
      <View style={[s.scherm, s.center, { padding: 28 }]}>
        <Text style={s.sub}>Deze login is niet gekoppeld aan een uitbater.</Text>
        <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }} style={{ marginTop: 16 }}>
          <Text style={s.terug}>Uitloggen</Text>
        </Pressable>
      </View>
    )
  }

  const maxDag = Math.max(1, ...dagen.map((d) => d.waarde))

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.topbar}>
          <Logo />
          <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }}>
            <Text style={s.uitlog}>Uitloggen</Text>
          </Pressable>
        </View>

        <Text style={s.titel}>Dashboard</Text>
        <Text style={s.sub}>{naam ? `${naam} · ` : ''}{attracties.length} attractie{attracties.length === 1 ? '' : 's'}</Text>

        <View style={s.kpiRij}>
          <View style={[s.kpi, { borderColor: 'rgba(16,185,129,0.3)' }]}>
            <Text style={[s.kpiNum, { color: C.green }]}>{openstaand}</Text>
            <Text style={s.kpiLbl}>openstaande punten</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiNum}>{attracties.length}</Text>
            <Text style={s.kpiLbl}>attracties</Text>
          </View>
        </View>
        <View style={s.kpiRij}>
          <View style={s.kpi}>
            <Text style={s.kpiNum}>{opgeladen}</Text>
            <Text style={s.kpiLbl}>totaal opgeladen</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiNum}>{ingewisseld}</Text>
            <Text style={s.kpiLbl}>ingewisseld</Text>
          </View>
        </View>

        <View style={s.blok}>
          <Text style={s.blokTitel}>Punten opgeladen · 14 dagen</Text>
          <View style={s.grafiek}>
            {dagen.map((d, i) => (
              <View key={i} style={s.balkKolom}>
                <View style={s.balkVak}>
                  <View style={[s.balk, { height: `${Math.round((d.waarde / maxDag) * 100)}%` }]} />
                </View>
                {i % 2 === 0 ? <Text style={s.balkLbl}>{d.label}</Text> : <Text style={s.balkLbl}> </Text>}
              </View>
            ))}
          </View>
          <Text style={s.grafiekVoet}>hoogste dag: {maxDag} punten</Text>
        </View>

        <View style={s.blok}>
          <Text style={s.blokTitel}>Per attractie</Text>
          {attracties.length === 0
            ? <Text style={s.sub}>Nog geen attracties.</Text>
            : attracties.map((a) => (
              <View key={a.id} style={s.attrRij}>
                <View style={{ flex: 1 }}>
                  <Text style={s.attrNaam}>{a.naam}</Text>
                  <Text style={s.attrSub}>{a.soort} · {perAttr[a.id]?.boekingen ?? 0} boekingen</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.attrNum, { color: C.green }]}>{perAttr[a.id]?.saldo ?? 0}</Text>
                  <Text style={s.attrSub}>open</Text>
                </View>
              </View>
            ))}
        </View>

        <Pressable style={[s.knop, s.knopViolet]} onPress={() => router.push('/agenda')}>
          <Text style={s.knopVioletT}>📅 Agenda beheren</Text>
        </Pressable>

        <View style={[s.blok, s.credits]}>
          <View style={s.creditsTop}>
            <Text style={s.blokTitel}>Advertentie-credits</Text>
            <Text style={s.binnenkort}>binnenkort</Text>
          </View>
          <Text style={s.sub}>Straks koop je hier credits om advertentieruimte in de app te reserveren.</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center' },
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
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopViolet: { backgroundColor: C.violet },
  knopVioletT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  kpiRij: { flexDirection: 'row', gap: 12, marginTop: 12 },
  kpi: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  kpiNum: { color: C.ink, fontSize: 28, fontWeight: '900' },
  kpiLbl: { color: C.muted, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  blok: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18, marginTop: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1,
  },
  blokTitel: { color: C.ink, fontSize: 15, fontWeight: '800' },
  grafiek: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 130, marginTop: 16 },
  balkKolom: { flex: 1, alignItems: 'center' },
  balkVak: { width: '100%', height: 104, justifyContent: 'flex-end' },
  balk: { width: '68%', alignSelf: 'center', backgroundColor: C.violet, borderRadius: 4, minHeight: 2 },
  balkLbl: { color: C.muted, fontSize: 9, marginTop: 4 },
  grafiekVoet: { color: C.muted, fontSize: 12, marginTop: 8 },
  attrRij: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
  attrNaam: { color: C.ink, fontSize: 15.5, fontWeight: '700' },
  attrSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  attrNum: { fontSize: 20, fontWeight: '900' },
  credits: { backgroundColor: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' },
  creditsTop: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 4 },
  binnenkort: {
    color: C.violet, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
    backgroundColor: 'rgba(139,92,246,0.14)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
})

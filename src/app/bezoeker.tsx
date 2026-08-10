import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import type { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { pushOndersteund, pushStatus, zetPushAan, zetPushUit, type PushStatus } from '../lib/push'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { KermisKalender } from '../components/KermisKalender'
import { Vrienden } from '../components/Vrienden'
import { BottomNav } from '../components/BottomNav'
import { niveau } from '../lib/levels'
import { useT, TaalKiezer } from '../lib/i18n'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', coralD: '#E11D63', green: '#10B981',
  amber: '#F59E0B', violet: '#8B5CF6', red: '#E11D48',
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
  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.coral} size="large" /></View>
  return session ? <Home session={session} /> : <Login />
}

function Logo({ licht }: { licht?: boolean }) {
  return (
    <View style={s.logo}>
      <View style={s.mark}><Text style={s.markT}>F</Text></View>
      <Text style={[s.logoT, licht && { color: '#fff' }]}>Funpoints</Text>
    </View>
  )
}

function Login() {
  const router = useRouter()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  async function login() {
    setFout(''); setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: ww })
    setBezig(false)
    if (error) setFout(t('Inloggen mislukt — controleer je e-mail en wachtwoord.'))
  }
  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={wrapC} keyboardShouldPersistTaps="handled">
        {Platform.OS === 'web' ? (
          <Pressable onPress={() => router.push('/')} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>
        ) : null}
        <Logo />
        <Text style={s.titel}>{t('Bezoeker')}</Text>
        <Text style={s.sub}>{t('Log in om je kermis-belevenis te openen.')}</Text>
        <View style={s.kaart}>
          <Text style={s.label}>{t('E-mail')}</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="jij@voorbeeld.be" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>{t('Wachtwoord')}</Text>
          <TextInput style={s.input} value={ww} onChangeText={setWw}
            secureTextEntry placeholder="••••••••" placeholderTextColor={C.muted} />
          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
          <Pressable onPress={login} disabled={bezig} style={[s.knop, s.knopCoral, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopCoralT}>{t('Inloggen')}</Text>}
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/registreer')} style={[s.knop, s.knopWit]}>
          <Text style={s.knopWitT}>{t('Account aanmaken')}</Text>
        </Pressable>
        <Text style={s.hint}>{t('Heb je een Funpoints-kaartje? Scan de achterkant bij het registreren om je punten mee te nemen.')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

type Kraam = { id: string; naam: string; soort: string; saldo: number }
type Kermis = { id: string; naam: string; plaats: string; van: string; tot: string; kramen: number }

function kort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
function provVan(pc?: string | null): string | null {
  const n = parseInt(((pc || '').match(/\d+/g) || []).join(''), 10)
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
function streakVan(dagen: Set<string>): number {
  if (dagen.size === 0) return 0
  const sorted = [...dagen].sort().reverse()
  let streak = 1
  let prev = new Date(sorted[0])
  for (let i = 1; i < sorted.length; i++) {
    const d = new Date(sorted[i])
    const diff = Math.round((prev.getTime() - d.getTime()) / 86400000)
    if (diff === 1) { streak++; prev = d } else break
  }
  return streak
}

const TABS = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'kermissen', icon: '📅', label: 'Kermissen' },
  { key: 'qr', icon: '🎟️', label: 'QR' },
  { key: 'saldo', icon: '⭐', label: 'Saldo' },
  { key: 'social', icon: '👥', label: 'Vrienden' },
] as const

function SupersterBanner({ actie, onPress }: { actie: any; onPress: () => void }) {
  const { t } = useT()
  const x = useRef(new Animated.Value(-80)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 480, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(1300),
        Animated.timing(x, { toValue: -80, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])
  return (
    <Pressable onPress={onPress} style={s.superBanner}>
      <Animated.View style={[s.superShine, { transform: [{ translateX: x }, { skewX: '-20deg' }] }]} />
      <Text style={s.superKicker}>{t('⭐ SUPERSTER-ACTIE')}</Text>
      <Text style={s.superTitel}>{actie.titel}</Text>
      <Text style={s.superKraam}>{actie.kraam}{actie.beschrijving ? ` · ${actie.beschrijving}` : ''}</Text>
    </Pressable>
  )
}

function Home({ session }: { session: Session }) {
  const router = useRouter()
  const { t } = useT()
  const [naam, setNaam] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [isBez, setIsBez] = useState<boolean | null>(null)
  const [kramen, setKramen] = useState<Kraam[]>([])
  const [doelen, setDoelen] = useState<Record<string, { naam: string; punten: number }>>({})
  const [checkins, setCheckins] = useState(0)
  const [kermissen, setKermissen] = useState<Kermis[]>([])
  const [acties, setActies] = useState<any[]>([])
  const [superAct, setSuperAct] = useState<any | null>(null)
  const [stats, setStats] = useState({ punten: 0, bezocht: 0, streak: 0, lunapark: false })
  const [gevolgdAantal, setGevolgdAantal] = useState(0)
  const [dezeWeek, setDezeWeek] = useState<any[]>([])
  const [favBuurt, setFavBuurt] = useState<any[]>([])
  const [ongelezen, setOngelezen] = useState(0)
  const [laden, setLaden] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [vActie, setVActie] = useState<any | null>(null)
  const [vCode, setVCode] = useState<string | null>(null)
  const [vGebruikt, setVGebruikt] = useState<string | null>(null)
  const [vLaden, setVLaden] = useState(false)
  const [push, setPush] = useState<PushStatus>('niet')
  const [pushBezig, setPushBezig] = useState(false)
  const [tab, setTab] = useState<(typeof TABS)[number]['key'] | 'settings'>('home')
  const insets = useSafeAreaInsets()
  const [bezId, setBezId] = useState<string | null>(null)
  const [fNaam, setFNaam] = useState('')
  const [fGebruikersnaam, setFGebruikersnaam] = useState('')
  const [fPostcode, setFPostcode] = useState('')
  const [profielBezig, setProfielBezig] = useState(false)
  const [profielMelding, setProfielMelding] = useState<string | null>(null)
  const [verwijderStap, setVerwijderStap] = useState(0)
  const [verwijderBezig, setVerwijderBezig] = useState(false)

  async function verwijderAccount() {
    setVerwijderBezig(true)
    const { error } = await supabase.rpc('verwijder_mijn_account')
    if (error) { setVerwijderBezig(false); setVerwijderStap(0); setProfielMelding(t('Account verwijderen mislukt. Probeer later opnieuw.')); return }
    await supabase.auth.signOut()
    router.push('/')
  }

  async function bewaarProfiel() {
    if (!bezId) return
    if (fPostcode.trim() && !/^\d{4}$/.test(fPostcode.trim())) {
      setProfielMelding(t('Geef een geldige postcode (4 cijfers).')); return
    }
    const gnaam = fGebruikersnaam.trim()
    if (gnaam && !/^[A-Za-z0-9_]{3,20}$/.test(gnaam)) {
      setProfielMelding(t('Gebruikersnaam: 3–20 tekens, enkel letters, cijfers en _.')); return
    }
    setProfielBezig(true); setProfielMelding(null)
    if (gnaam) {
      const { error: ge } = await supabase.rpc('zet_gebruikersnaam', { p_naam: gnaam })
      if (ge) {
        setProfielBezig(false)
        setProfielMelding(ge.message.includes('BEZET') ? t('Die gebruikersnaam is al bezet.') : t('Gebruikersnaam ongeldig.'))
        return
      }
    }
    const { error } = await supabase.from('bezoeker')
      .update({ naam: fNaam.trim() || null, postcode: fPostcode.trim() || null })
      .eq('id', bezId)
    setProfielBezig(false)
    if (error) { setProfielMelding(t('Opslaan mislukt. Probeer opnieuw.')); return }
    setNaam(fNaam.trim())
    setProfielMelding(t('Opgeslagen ✓'))
  }

  useEffect(() => { pushStatus().then(setPush) }, [])

  const laadOngelezen = useCallback(async () => {
    const { count } = await supabase.from('melding').select('id', { count: 'exact', head: true }).eq('gelezen', false)
    setOngelezen(count ?? 0)
  }, [])
  useFocusEffect(useCallback(() => { laadOngelezen() }, [laadOngelezen]))

  const params = useLocalSearchParams<{ tab?: string }>()
  useEffect(() => {
    const t = params.tab ? String(params.tab) : ''
    if (['home', 'kermissen', 'qr', 'saldo', 'social'].includes(t)) setTab(t as any)
  }, [params.tab])

  async function wisselPush() {
    setPushBezig(true)
    if (push === 'aan') { await zetPushUit(); setPush('uit') }
    else { setPush(await zetPushAan()) }
    setPushBezig(false)
  }

  async function toonVoucher(a: any) {
    setVActie(a); setVCode(null); setVGebruikt(null); setVLaden(true)
    const { data, error } = await supabase.rpc('claim_actie', { p_actie_id: a.id })
    if (!error && data) {
      setVCode(data as string)
      const { data: cl } = await supabase.from('actie_claim')
        .select('gebruikt_op').eq('actie_id', a.id).maybeSingle()
      setVGebruikt(cl?.gebruikt_op ?? null)
    }
    setVLaden(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    setOnline((navigator as any).onLine !== false)
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    (async () => {
      // Toon de QR meteen uit lokale cache, ook zonder internet.
      try { const cc = await AsyncStorage.getItem('fp_bezoeker_code'); if (cc) setCode(cc) } catch {}
      const { data: bez } = await supabase.from('bezoeker').select('id, naam, code, postcode, gebruikersnaam')
        .eq('auth_user_id', session.user.id).maybeSingle()
      setNaam(bez?.naam ?? ''); setIsBez(!!bez)
      if (bez?.code) { setCode(bez.code); AsyncStorage.setItem('fp_bezoeker_code', bez.code).catch(() => {}) }
      setBezId(bez?.id ?? null); setFNaam(bez?.naam ?? ''); setFPostcode(bez?.postcode ?? '')
      setFGebruikersnaam(bez?.gebruikersnaam ?? '')

      const todayISO = new Date().toISOString().slice(0, 10)
      const [{ data: att }, { data: sal }, { data: boek }, { data: kerm }, { data: ka }, { data: act }, { data: volg }, { data: sd }, { data: inc }] = await Promise.all([
        supabase.from('attractie_publiek').select('id, naam, soort'),
        supabase.from('saldo').select('attractie_id, saldo'),
        supabase.from('puntenboeking').select('attractie_id, punten, soort, created_at'),
        supabase.from('kermis').select('id, naam, plaats, postcode, van, tot').gte('tot', todayISO).order('van'),
        supabase.from('kermis_attractie').select('kermis_id, attractie_id'),
        supabase.rpc('zichtbare_acties'),  // regio- en segment-targeting server-side
        supabase.from('kraam_volger').select('attractie_id'),
        supabase.from('spaardoel').select('attractie_id, naam, punten'),
        supabase.from('incheck').select('id'),
      ])
      setCheckins((inc ?? []).length)
      const doelMap: Record<string, { naam: string; punten: number }> = {}
      ;(sd ?? []).forEach((r: any) => { doelMap[r.attractie_id] = { naam: r.naam, punten: r.punten } })
      setDoelen(doelMap)

      const { data: ss } = await supabase.rpc('actieve_superster')
      setSuperAct(ss ?? null)

      const saldoMap = new Map<string, number>()
      ;(sal ?? []).forEach((r: any) => saldoMap.set(r.attractie_id, (saldoMap.get(r.attractie_id) ?? 0) + (r.saldo ?? 0)))
      const attrLijst: Kraam[] = (att ?? []).map((a: any) => ({
        id: a.id, naam: a.naam, soort: a.soort, saldo: saldoMap.get(a.id) ?? 0,
      })).sort((x, y) => y.saldo - x.saldo || x.naam.localeCompare(y.naam))
      setKramen(attrLijst)

      const soortVan = new Map<string, string>((att ?? []).map((a: any) => [a.id, a.soort]))
      const bezochtSet = new Set<string>()
      const dagenSet = new Set<string>()
      let gespaard = 0, lunapark = false
      ;(boek ?? []).forEach((b: any) => {
        bezochtSet.add(b.attractie_id)
        if (b.soort === 'toevoegen') { gespaard += b.punten; dagenSet.add(String(b.created_at).slice(0, 10)) }
        if (soortVan.get(b.attractie_id) === 'lunapark') lunapark = true
      })
      setStats({ punten: gespaard, bezocht: bezochtSet.size, streak: streakVan(dagenSet), lunapark })

      const cnt = new Map<string, number>()
      ;(ka ?? []).forEach((r: any) => cnt.set(r.kermis_id, (cnt.get(r.kermis_id) ?? 0) + 1))
      setKermissen((kerm ?? []).map((k: any) => ({ ...k, kramen: cnt.get(k.id) ?? 0 })))

      const naamMap = new Map<string, string>(attrLijst.map((a) => [a.id, a.naam]))
      const nu = Date.now()
      const actLijst = (act ?? []).map((x: any) => ({
        ...x, kraam: naamMap.get(x.attractie_id) ?? '',
        geboost: !!x.boost_tot && new Date(x.boost_tot).getTime() > nu,
      })).sort((p: any, q: any) => (q.geboost ? 1 : 0) - (p.geboost ? 1 : 0) || String(p.van).localeCompare(String(q.van)))
      setActies(actLijst)

      // --- Volgen, "deze week" en favorieten in de buurt ---
      const follows = new Set((volg ?? []).map((r: any) => r.attractie_id))
      setGevolgdAantal(follows.size)
      const bezProv = provVan(bez?.postcode)

      const kMap = new Map<string, any>((kerm ?? []).map((k: any) => [k.id, k]))
      const attrPerKermis = new Map<string, number>()
      const kermisPerAttr = new Map<string, any[]>()
      ;(ka ?? []).forEach((r: any) => {
        attrPerKermis.set(r.kermis_id, (attrPerKermis.get(r.kermis_id) ?? 0) + 1)
        const k = kMap.get(r.kermis_id)
        if (k) { const arr = kermisPerAttr.get(r.attractie_id) ?? []; arr.push(k); kermisPerAttr.set(r.attractie_id, arr) }
      })

      const week = (kerm ?? []).map((k: any) => {
        const actief = k.van <= todayISO && k.tot >= todayISO
        const dagen = Math.round((new Date(k.van).getTime() - new Date(todayISO).getTime()) / 86400000)
        return { ...k, actief, kramen: attrPerKermis.get(k.id) ?? 0, inBuurt: !!bezProv && provVan(k.postcode) === bezProv, dagen }
      }).filter((k: any) => k.actief || (k.van > todayISO && k.dagen <= 14))
        .sort((a: any, b: any) => (b.actief ? 1 : 0) - (a.actief ? 1 : 0) || String(a.van).localeCompare(String(b.van)))
        .slice(0, 6)
      setDezeWeek(week)

      const fav = [...follows].map((aid) => {
        const ks = (kermisPerAttr.get(aid) ?? []).slice().sort((x, y) => String(x.van).localeCompare(String(y.van)))
        const huidig = ks.find((k) => k.van <= todayISO && k.tot >= todayISO)
        const volgend = ks.find((k) => k.van > todayISO)
        const ref = huidig ?? volgend
        if (!ref) return null
        if (!(bezProv && provVan(ref.postcode) === bezProv)) return null
        return { attractieId: aid, kraam: naamMap.get(aid) ?? 'Kraam', kermis: ref.naam, plaats: ref.plaats, nu: !!huidig }
      }).filter(Boolean).slice(0, 5)
      setFavBuurt(fav as any[])

      const { count } = await supabase.from('melding').select('id', { count: 'exact', head: true }).eq('gelezen', false)
      setOngelezen(count ?? 0)

      setLaden(false)
    })()
  }, [])

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.coral} size="large" /></View>

  if (isBez === false) {
    return (
      <View style={[s.scherm, s.center, { padding: 28 }]}>
        <Text style={s.sub}>{t('Deze login is geen bezoeker-account. Log uit en registreer je, of log in met je bezoeker-account.')}</Text>
        <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }} style={{ marginTop: 16 }}>
          <Text style={s.terug}>{t('Uitloggen')}</Text>
        </Pressable>
      </View>
    )
  }

  const niveaus = [
    { icon: '🎯', titel: 'Ontdekker', waarde: stats.bezocht, basis: [3, 5, 8, 12, 20], kleur: C.coral, eenheid: 'kramen' },
    { icon: '🎪', titel: 'Kermisganger', waarde: checkins, basis: [1, 3, 6, 10, 20], kleur: C.violet, eenheid: 'check-ins' },
    { icon: '⭐', titel: 'Puntenjager', waarde: stats.punten, basis: [50, 150, 350, 700, 1500], kleur: C.amber, eenheid: 'punten' },
    { icon: '❤️', titel: 'Kraamfan', waarde: gevolgdAantal, basis: [1, 3, 5, 10, 20], kleur: C.green, eenheid: 'gevolgde kramen' },
    { icon: '🔥', titel: 'Streakmeester', waarde: stats.streak, basis: [2, 3, 5, 7, 14], kleur: C.coralD, eenheid: 'dagen op rij' },
  ].map((t) => ({ ...t, ...niveau(t.waarde, t.basis) }))
  const voornaam = naam ? naam.split(' ')[0] : ''
  const gewoneActies = acties.filter((a: any) => a.id !== superAct?.id)
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 74 : insets.top + 60 }]

  return (
    <View style={s.scherm}>
      <Pressable
        style={[s.belKnop, { top: Platform.OS === 'web' ? 14 : insets.top + 4 }]}
        onPress={() => router.push('/inbox')} hitSlop={8}>
        <Text style={s.radKnopT}>🔔</Text>
        {ongelezen > 0 ? <View style={s.belBadge}><Text style={s.belBadgeT}>{ongelezen > 9 ? '9+' : ongelezen}</Text></View> : null}
      </Pressable>
      <Pressable
        style={[s.radKnop, { top: Platform.OS === 'web' ? 14 : insets.top + 4 }]}
        onPress={() => setTab(tab === 'settings' ? 'home' : 'settings')} hitSlop={8}>
        <Text style={s.radKnopT}>{tab === 'settings' ? '🏠' : '🎡'}</Text>
      </Pressable>

      {tab === 'home' ? (
      <ScrollView style={s.blad} contentContainerStyle={wrapC}>
        <View style={s.hero}>
          <View style={s.heroDeco} />
          <View style={s.heroDeco2} />
          <Text style={s.heroHi}>{t('Hallo')}{voornaam ? `, ${voornaam}` : ''} 👋</Text>
          <Text style={s.heroTag}>{t('Klaar voor wat kermisplezier?')}</Text>
          <View style={s.heroStats}>
            <View style={s.heroStat}><Text style={s.heroStatIcon}>🎪</Text><Text style={s.heroNum}>{stats.bezocht}</Text><Text style={s.heroSub}>{t('bezocht')}</Text></View>
            <View style={s.heroLijn} />
            <View style={s.heroStat}><Text style={s.heroStatIcon}>⭐</Text><Text style={s.heroNum}>{stats.punten}</Text><Text style={s.heroSub}>{t('punten')}</Text></View>
            <View style={s.heroLijn} />
            <View style={s.heroStat}><Text style={s.heroStatIcon}>❤️</Text><Text style={s.heroNum}>{gevolgdAantal}</Text><Text style={s.heroSub}>{t('gevolgd')}</Text></View>
          </View>
        </View>

        <View style={s.tegelRij}>
          <Pressable style={[s.tegel, s.tegelKramen]} onPress={() => router.push('/kramen')}>
            <Text style={s.tegelIcon}>🎪</Text>
            <Text style={s.tegelTitel}>{t('Kramen')}</Text>
            <Text style={s.tegelSub}>{t('Volg je favorieten')}</Text>
          </Pressable>
          <Pressable style={[s.tegel, s.tegelTradities]} onPress={() => router.push('/tradities')}>
            <Text style={s.tegelIcon}>🏆</Text>
            <Text style={s.tegelTitel}>{t('Tradities')}</Text>
            <Text style={s.tegelSub}>{t('Je jaarlijkse streaks')}</Text>
          </Pressable>
        </View>

        {pushOndersteund() && push !== 'aan' ? (
          <Pressable style={s.pushBalk} onPress={wisselPush} disabled={pushBezig}>
            <Text style={s.pushBalkT}>
              {push === 'geblokkeerd'
                ? t('🔔 Meldingen staan uit in je browser — zet ze aan bij de site-instellingen')
                : t('🔔 Zet meldingen aan en mis geen enkele actie in je buurt')}
            </Text>
            {push !== 'geblokkeerd' ? <Text style={s.pushBalkKnop}>{pushBezig ? '…' : t('Aanzetten')}</Text> : null}
          </Pressable>
        ) : null}

        {superAct ? (
          <SupersterBanner
            actie={superAct}
            onPress={() => (superAct.eenmalig ? toonVoucher(superAct) : router.push(`/kraam/${superAct.attractie_id}`))}
          />
        ) : null}

        {favBuurt.length > 0 ? (
          <>
            <Text style={s.sectie}>{t('❤️ Favorieten in de buurt')}</Text>
            <View style={{ gap: 10 }}>
              {favBuurt.map((f: any) => (
                <Pressable key={f.attractieId} style={s.favKaart} onPress={() => router.push(`/kraam/${f.attractieId}`)}>
                  <View style={s.favIcon}><Text style={{ fontSize: 20 }}>🎪</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.favNaam}>{f.kraam}</Text>
                    <Text style={[s.favSub, f.nu && s.favNu]}>
                      {f.nu ? t('🟢 Nu op {kermis}', { kermis: f.kermis }) : t('📍 Binnenkort · {kermis}', { kermis: f.kermis })}{f.plaats ? ` · ${f.plaats}` : ''}
                    </Text>
                  </View>
                  <Text style={s.favChev}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {dezeWeek.length > 0 ? (
          <>
            <Text style={s.sectie}>{t('🔥 Deze week')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4, paddingRight: 4 }}>
              {dezeWeek.map((k: any) => (
                <Pressable key={k.id} style={s.weekKaart} onPress={() => router.push(`/kermis/${k.id}`)}>
                  <View style={s.weekBadgeRij}>
                    {k.actief
                      ? <Text style={[s.weekBadge, s.weekBadgeNu]}>{t('🟢 Nu open')}</Text>
                      : <Text style={[s.weekBadge, s.weekBadgeSoon]}>{t('Binnenkort')}</Text>}
                    {k.inBuurt ? <Text style={[s.weekBadge, s.weekBadgeBuurt]}>{t('📍 regio')}</Text> : null}
                  </View>
                  <Text style={s.weekNaam} numberOfLines={2}>{k.naam}</Text>
                  <Text style={s.weekSub}>📅 {kort(k.van)} – {kort(k.tot)}</Text>
                  <Text style={s.weekMeta}>{k.plaats ? `${k.plaats} · ` : ''}{k.kramen} {k.kramen === 1 ? t('kraam') : t('kramen')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {gewoneActies.length > 0 ? (
          <>
            <Text style={s.sectie}>{t('🔥 Acties & deals')}</Text>
            <View style={{ gap: 10 }}>
              {gewoneActies.map((a) => (
                <Pressable key={a.id} style={[s.actieKaart, a.geboost && s.actieBoost]}
                  onPress={() => a.eenmalig ? toonVoucher(a) : router.push(`/kraam/${a.attractie_id}`)}>
                  {a.geboost ? <Text style={s.uitgelicht}>{t('⭐ UITGELICHT')}</Text> : null}
                  <View style={s.actieBinnen}>
                    <View style={{ flex: 1 }}>
                      <View style={s.kraamChip}><Text style={s.kraamChipT}>🎪 {a.kraam}</Text></View>
                      <Text style={s.actieTitel}>{a.titel}</Text>
                      {a.beschrijving ? <Text style={s.actieDesc}>{a.beschrijving}</Text> : null}
                      {a.eenmalig ? <Text style={s.voucherTag}>{t('🎟️ Tik om je voucher op te halen')}</Text> : null}
                    </View>
                    {a.eenmalig ? (
                      <View style={s.voucherChip}><Text style={s.voucherChipT}>{t('voucher')}</Text></View>
                    ) : a.soort === 'bonus_punten' && (a.bonus_modus === 'vast' ? a.bonus_vast : a.bonus_pct) ? (
                      <View style={s.bonusChip}><Text style={s.bonusChipT}>{a.bonus_modus === 'vast' ? `+${a.bonus_vast}` : `+${a.bonus_pct}%`}</Text></View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.sectie}>🏅 {t('Levels')}</Text>
        <View style={{ gap: 10 }}>
          {niveaus.map((nv, i) => {
            const pct = Math.max(0, Math.min(1, (nv.waarde - nv.start) / (nv.volgende - nv.start)))
            const resterend = Math.max(0, nv.volgende - nv.waarde)
            return (
              <View key={i} style={s.chalKaart}>
                <View style={[s.lvlIcon, { backgroundColor: nv.kleur + '22' }]}><Text style={{ fontSize: 22 }}>{nv.icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <View style={s.chalTop}>
                    <Text style={s.chalTitel}>{t(nv.titel)}</Text>
                    <View style={[s.lvlBadge, { backgroundColor: nv.kleur }]}><Text style={s.lvlBadgeT}>{t('Level {lvl}', { lvl: nv.level })}</Text></View>
                  </View>
                  <Text style={s.chalDesc}>{t('Nog {n} {eenheid} tot level {lvl}', { n: resterend, eenheid: t(nv.eenheid), lvl: nv.level + 1 })}</Text>
                  <View style={s.balkBg}>
                    <View style={[s.balkVul, { width: `${Math.round(pct * 100)}%`, backgroundColor: nv.kleur }]} />
                  </View>
                  <Text style={s.lvlSub}>{nv.waarde} / {nv.volgende} {t(nv.eenheid)}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
      ) : null}

      {tab === 'kermissen' ? (
      <ScrollView style={s.blad} contentContainerStyle={wrapC}>
        <KermisKalender postcode={fPostcode} />
      </ScrollView>
      ) : null}

      {tab === 'qr' ? (
      <ScrollView style={s.blad} contentContainerStyle={wrapC}>
        <Text style={s.paginaTitel}>{t('🎟️ Mijn QR')}</Text>
        <View style={s.qrKaart}>
          {code
            ? <View style={s.qrWit}><QRCode value={`FP-B:${code}`} size={196} backgroundColor="#FFFFFF" color="#241B3A" /></View>
            : <Text style={s.kraartSoort}>{t('QR wordt geladen…')}</Text>}
          <Text style={s.qrTitel}>{t('Jouw punten-QR')}</Text>
          <Text style={s.qrHint}>{t('Toon deze ene QR aan elk kraam. De foorkramer scant hem en je punten worden automatisch bij dàt kraam bijgeschreven of ingeruild — nooit door elkaar.')}</Text>
          {!online ? (
            <Text style={s.qrOffline}>{t('📴 Geen internet — je QR werkt gewoon. Je punten verschijnen zodra je terug online bent.')}</Text>
          ) : null}
        </View>
      </ScrollView>
      ) : null}

      {tab === 'saldo' ? (
      <ScrollView style={s.blad} contentContainerStyle={wrapC}>
        <Text style={s.paginaTitel}>{t("⭐ Mijn saldo's")}</Text>
        {kramen.some((k) => k.saldo !== 0) ? (
          <>
            <Text style={s.subKop}>{t('Je saldo per kraam')}</Text>
            <View style={{ gap: 10 }}>
              {kramen.filter((k) => k.saldo !== 0).map((k) => (
                <Pressable key={k.id} style={s.kraart} onPress={() => router.push(`/kraam/${k.id}`)}>
                  <View style={s.kraartRij}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.kraartNaam}>{k.naam}</Text>
                      <Text style={s.kraartSoort}>{k.soort}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.saldoNum}>{k.saldo}</Text>
                      <Text style={s.saldoLbl}>{t('punten')}</Text>
                    </View>
                  </View>
                  {doelen[k.id] ? (
                    <View style={s.doelMini}>
                      <Text style={s.doelMiniT}>🎯 {doelen[k.id].naam} · {Math.min(100, Math.round(k.saldo / doelen[k.id].punten * 100))}%</Text>
                      <View style={s.doelMiniBg}>
                        <View style={[s.doelMiniVul, { width: `${Math.min(100, Math.round(k.saldo / doelen[k.id].punten * 100))}%` }]} />
                      </View>
                    </View>
                  ) : null}
                  <View style={s.detailLink}>
                    <Text style={s.detailLinkT}>{t('🎁 Bekijk je prijs-voortgang ›')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={s.sub}>{t('Je hebt nog geen punten gespaard. Laat je QR scannen bij een kraam om te beginnen.')}</Text>
        )}
        <Text style={s.voet}>{t('Funpoints · meer belevenis komt eraan 🎠')}</Text>
      </ScrollView>
      ) : null}

      {tab === 'settings' ? (
      <ScrollView style={s.blad} contentContainerStyle={wrapC}>
        <Text style={s.paginaTitel}>{t('👤 Account')}</Text>

        <Text style={s.sectie}>Taal · Langue · Language</Text>
        <View style={s.kaart}><TaalKiezer /></View>

        <Text style={s.sectie}>{t('Profiel')}</Text>
        <View style={s.kaart}>
          <Text style={s.label}>{t('Naam')}</Text>
          <TextInput style={s.input} value={fNaam} onChangeText={setFNaam}
            placeholder={t('Je naam')} placeholderTextColor={C.muted} />

          <Text style={[s.label, { marginTop: 14 }]}>{t('Gebruikersnaam')}</Text>
          <TextInput style={s.input} value={fGebruikersnaam}
            onChangeText={(t) => setFGebruikersnaam(t.replace(/[^A-Za-z0-9_]/g, ''))}
            autoCapitalize="none" maxLength={20}
            placeholder={t('bv. kermiskoning')} placeholderTextColor={C.muted} />
          <Text style={s.veldHint}>{t('Zo vinden vrienden je. 3–20 tekens: letters, cijfers of _.')}</Text>

          <Text style={[s.label, { marginTop: 14 }]}>{t('Postcode')}</Text>
          <TextInput style={s.input} value={fPostcode} onChangeText={setFPostcode}
            keyboardType="number-pad" maxLength={4}
            placeholder="bv. 8531" placeholderTextColor={C.muted} />
          <Text style={s.veldHint}>{t('Zo tonen we je kermissen en acties in je buurt.')}</Text>

          <Text style={[s.label, { marginTop: 14 }]}>{t('E-mail')}</Text>
          <View style={s.leesveld}><Text style={s.leesveldT}>{session.user.email ?? '—'}</Text></View>

          {profielMelding ? (
            <View style={[s.foutBox, profielMelding.includes('✓') && s.okBox]}>
              <Text style={[s.foutT, profielMelding.includes('✓') && s.okT]}>{profielMelding}</Text>
            </View>
          ) : null}

          <Pressable onPress={bewaarProfiel} disabled={profielBezig} style={[s.knop, s.knopCoral, profielBezig && { opacity: 0.5 }]}>
            {profielBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopCoralT}>{t('Opslaan')}</Text>}
          </Pressable>
        </View>

        <Text style={s.sectie}>{t('Meldingen')}</Text>
        <View style={s.kaart}>
          {pushOndersteund() ? (
            <View style={s.instelRij}>
              <View style={{ flex: 1 }}>
                <Text style={s.instelLabel}>{t('Pushmeldingen')}</Text>
                <Text style={s.veldHint}>{t('Een seintje bij nieuwe acties in je buurt.')}</Text>
              </View>
              <Pressable onPress={wisselPush} disabled={pushBezig}
                style={[s.miniKnop, push === 'aan' && s.miniKnopAan]}>
                <Text style={[s.miniKnopT, push === 'aan' && s.miniKnopTAan]}>
                  {pushBezig ? '…' : push === 'aan' ? t('Aan') : push === 'geblokkeerd' ? t('Geblokkeerd') : t('Uit')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={s.sub}>
              {Platform.OS === 'web'
                ? t('Meldingen werken in de Funpoints-app op je beginscherm (voeg de site toe via ‘Zet op beginscherm’).')
                : t('Pushmeldingen komen binnenkort in de app.')}
            </Text>
          )}
        </View>

        <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }} style={[s.knop, s.knopWit, { marginTop: 22 }]}>
          <Text style={s.knopWitT}>{t('Uitloggen')}</Text>
        </Pressable>

        <Text style={[s.sectie, { marginTop: 22 }]}>{t('Account')}</Text>
        <View style={s.kaart}>
          {verwijderStap === 0 ? (
            <Pressable onPress={() => setVerwijderStap(1)} hitSlop={6}>
              <Text style={s.gevaarLink}>{t('Account verwijderen')}</Text>
            </Pressable>
          ) : (
            <>
              <Text style={s.gevaarUitleg}>{t('Weet je het zeker? Je account, je gespaarde punten en al je gegevens worden definitief verwijderd. Dit kan niet ongedaan gemaakt worden.')}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable onPress={() => setVerwijderStap(0)} style={[s.knop, s.knopWit, { flex: 1, marginTop: 0 }]}>
                  <Text style={s.knopWitT}>{t('Annuleren')}</Text>
                </Pressable>
                <Pressable onPress={verwijderAccount} disabled={verwijderBezig} style={[s.knop, s.knopGevaar, { flex: 1, marginTop: 0 }, verwijderBezig && { opacity: 0.5 }]}>
                  {verwijderBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopGevaarT}>{t('Definitief verwijderen')}</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
      ) : null}

      {tab === 'social' ? (
      <ScrollView style={s.blad} contentContainerStyle={wrapC}>
        <Vrienden />
      </ScrollView>
      ) : null}

      <BottomNav active={tab === 'settings' ? undefined : tab} onSelect={(k) => setTab(k as any)} />

      {vActie ? (
        <View style={s.vOverlay}>
          <View style={s.vModal}>
            <Text style={s.vModalKraam}>{vActie.kraam}</Text>
            <Text style={s.vModalTitel}>{vActie.titel}</Text>
            {vActie.beschrijving ? <Text style={s.vModalDesc}>{vActie.beschrijving}</Text> : null}

            {vLaden ? (
              <View style={{ paddingVertical: 40 }}><ActivityIndicator color={C.coral} size="large" /></View>
            ) : vCode ? (
              vGebruikt ? (
                <View style={s.vGebruiktVak}>
                  <Text style={s.vGebruiktIcon}>✓</Text>
                  <Text style={s.vGebruiktT}>{t('Al ingewisseld')}</Text>
                  <Text style={s.vGebruiktSub}>{t('op')} {new Date(vGebruikt).toLocaleString('nl-BE')}</Text>
                </View>
              ) : (
                <>
                  <View style={s.vQrWit}>
                    <QRCode value={`FP-V:${vCode}`} size={200} backgroundColor="#FFFFFF" color="#241B3A" />
                  </View>
                  <Text style={s.vModalHint}>{t('Toon deze QR aan de foorkramer. Hij kan hem één keer scannen.')}</Text>
                </>
              )
            ) : (
              <Text style={s.vModalFout}>{t('Voucher ophalen mislukt. Probeer straks opnieuw.')}</Text>
            )}

            <Pressable style={s.vSluit} onPress={() => setVActie(null)}>
              <Text style={s.vSluitT}>{t('Sluiten')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  blad: { flex: 1 },
  wrap: { padding: 22, paddingTop: 56, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  paginaTitel: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginBottom: 8 },
  tabBar: {
    flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line,
    paddingTop: 9, paddingBottom: 24, paddingHorizontal: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 3 },
  tabIcon: { fontSize: 22, opacity: 0.45 },
  tabIconAan: { opacity: 1 },
  tabLabel: { color: C.muted, fontSize: 11, fontWeight: '700' },
  tabLabelAan: { color: C.coralD },
  tabMidWrap: { flex: 1, alignItems: 'center', gap: 3 },
  tabMid: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.coral,
    alignItems: 'center', justifyContent: 'center', marginTop: -26,
    borderWidth: 4, borderColor: C.card,
    shadowColor: C.coral, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  tabMidAan: { backgroundColor: C.coralD },
  tabMidIcon: { fontSize: 26 },
  veldHint: { color: C.muted, fontSize: 12, marginTop: 6, lineHeight: 16 },
  leesveld: { backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13 },
  leesveldT: { color: C.muted, fontSize: 15 },
  okBox: { backgroundColor: 'rgba(16,185,129,0.12)' },
  okT: { color: C.green },
  instelRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instelLabel: { color: C.ink, fontSize: 15, fontWeight: '700' },
  miniKnop: { backgroundColor: C.veld, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1, borderColor: C.line },
  miniKnopAan: { backgroundColor: C.green, borderColor: C.green },
  miniKnopT: { color: C.muted, fontWeight: '800', fontSize: 13.5 },
  miniKnopTAan: { color: '#fff' },
  gevaarLink: { color: C.red, fontSize: 15, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },
  gevaarUitleg: { color: C.muted, fontSize: 13.5, lineHeight: 20 },
  knopGevaar: { backgroundColor: C.red },
  knopGevaarT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  markT: { color: '#fff', fontWeight: '900', fontSize: 19 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  uitlog: { color: C.muted, fontSize: 14, fontWeight: '600' },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', marginTop: 18, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopCoral: { backgroundColor: C.coral },
  knopCoralT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopWit: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.coral, marginTop: 14 },
  knopWitT: { color: C.coral, fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  hint: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  hero: {
    backgroundColor: C.coral, borderRadius: 22, padding: 22, marginTop: 4, overflow: 'hidden',
    shadowColor: C.coral, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  heroDeco: { position: 'absolute', top: -40, right: -30, width: 130, height: 130, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroDeco2: { position: 'absolute', bottom: -50, left: -25, width: 110, height: 110, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroHi: { color: '#fff', fontSize: 23, fontWeight: '900' },
  heroTag: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, fontWeight: '600', marginTop: 3 },
  heroStatIcon: { fontSize: 16, marginBottom: 2 },
  streakRij: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 12 },
  streakBig: { color: '#fff', fontSize: 40, fontWeight: '900' },
  streakLbl: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingVertical: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLijn: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroNum: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  tegelRij: { flexDirection: 'row', gap: 12, marginTop: 14 },
  tegel: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  tegelKramen: { backgroundColor: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.25)' },
  tegelTradities: { backgroundColor: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.30)' },
  tegelIcon: { fontSize: 24 },
  tegelTitel: { color: C.ink, fontSize: 15.5, fontWeight: '900', marginTop: 8 },
  tegelSub: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  radKnop: {
    position: 'absolute', right: 18, zIndex: 30, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  radKnopT: { fontSize: 20 },
  belKnop: {
    position: 'absolute', right: 70, zIndex: 30, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  belBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 999, backgroundColor: C.coralD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  belBadgeT: { color: '#fff', fontSize: 10, fontWeight: '900' },
  kraamChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(251,113,133,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  kraamChipT: { color: C.coralD, fontSize: 12, fontWeight: '800' },
  binnenkort: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 26, alignItems: 'center', marginTop: 4 },
  binnenkortIcon: { fontSize: 44 },
  binnenkortT: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 10 },
  binnenkortSub: { color: C.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginTop: 8 },

  sectie: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 26, marginBottom: 12 },
  favKaart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(251,113,133,0.4)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  favIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(251,113,133,0.14)', alignItems: 'center', justifyContent: 'center' },
  favNaam: { color: C.ink, fontSize: 15.5, fontWeight: '800' },
  favSub: { color: C.muted, fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  favNu: { color: C.green },
  favChev: { color: C.coral, fontSize: 24, fontWeight: '700' },
  weekKaart: { width: 220, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16 },
  weekBadgeRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  weekBadge: { fontSize: 10.5, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  weekBadgeNu: { color: '#0E7C5A', backgroundColor: 'rgba(16,185,129,0.14)' },
  weekBadgeSoon: { color: '#B45309', backgroundColor: 'rgba(245,158,11,0.16)' },
  weekBadgeBuurt: { color: C.coralD, backgroundColor: 'rgba(251,113,133,0.14)' },
  weekNaam: { color: C.ink, fontSize: 16, fontWeight: '900', minHeight: 40 },
  weekSub: { color: C.muted, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  weekMeta: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  chalKaart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  chalIcon: { fontSize: 26, marginTop: 2 },
  lvlIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lvlBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  lvlBadgeT: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
  lvlSub: { color: C.muted, fontSize: 11.5, fontWeight: '700', marginTop: 6 },
  chalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chalTitel: { color: C.ink, fontSize: 15.5, fontWeight: '800' },
  chalNu: { color: C.muted, fontSize: 13, fontWeight: '700' },
  chalKlaar: { color: C.green, fontSize: 13, fontWeight: '800' },
  chalDesc: { color: C.muted, fontSize: 13, marginTop: 2 },
  balkBg: { height: 8, backgroundColor: C.veld, borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  balkVul: { height: 8, borderRadius: 999 },

  leeg: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 18 },
  kermKaart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  kermIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(251,113,133,0.14)', alignItems: 'center', justifyContent: 'center' },
  kermNaam: { color: C.ink, fontSize: 16, fontWeight: '800' },
  kermSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  kermKramen: { color: C.coralD, fontSize: 12.5, fontWeight: '800' },
  kermChev: { color: C.coral, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  detailLink: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  detailLinkT: { color: C.coral, fontSize: 13.5, fontWeight: '700' },
  doelMini: { marginTop: 12 },
  doelMiniT: { color: C.ink, fontSize: 12.5, fontWeight: '800', marginBottom: 6 },
  doelMiniBg: { height: 8, backgroundColor: C.veld, borderRadius: 999, overflow: 'hidden' },
  doelMiniVul: { height: 8, borderRadius: 999, backgroundColor: C.amber },

  kraart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16 },
  kraartRij: { flexDirection: 'row', alignItems: 'center' },
  kraartNaam: { color: C.ink, fontSize: 16, fontWeight: '800' },
  kraartSoort: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  saldoNum: { color: C.green, fontSize: 24, fontWeight: '900' },
  saldoLbl: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: -2 },
  toon: { color: C.coral, fontSize: 13, fontWeight: '700', marginTop: 12 },
  qrBox: { alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  qrWit: { backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line },
  qrHint: { color: C.muted, fontSize: 12.5, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  qrOffline: { color: '#b45309', fontSize: 12.5, fontWeight: '700', textAlign: 'center', marginTop: 12, lineHeight: 18 },
  qrKaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line,
    padding: 22, alignItems: 'center', marginBottom: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  qrTitel: { color: C.ink, fontSize: 16, fontWeight: '900', marginTop: 14 },
  subKop: { color: C.ink, fontSize: 15, fontWeight: '800', marginTop: 4, marginBottom: 10 },
  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 30, opacity: 0.8 },
  actieKaart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16 },
  actieBoost: { borderColor: C.amber, borderWidth: 1.5, backgroundColor: 'rgba(245,158,11,0.05)' },
  uitgelicht: { color: C.amber, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  actieBinnen: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actieTitel: { color: C.ink, fontSize: 15.5, fontWeight: '800' },
  actieKraam: { color: C.muted, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  actieDesc: { color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  voucherTag: { color: C.green, fontSize: 12.5, fontWeight: '800', marginTop: 6 },
  superBanner: {
    backgroundColor: C.amber, borderRadius: 18, padding: 18, marginTop: 16, overflow: 'hidden',
    shadowColor: C.amber, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  superShine: { position: 'absolute', top: -20, bottom: -20, width: 55, backgroundColor: 'rgba(255,255,255,0.30)' },
  superKicker: { color: '#fff', fontSize: 11.5, fontWeight: '900', letterSpacing: 1.2, opacity: 0.95 },
  superTitel: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 5, letterSpacing: -0.3 },
  superKraam: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, fontWeight: '600', marginTop: 3 },
  pushBalk: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14,
    backgroundColor: 'rgba(251,113,133,0.10)', borderWidth: 1, borderColor: 'rgba(251,113,133,0.30)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
  },
  pushBalkAan: { backgroundColor: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.30)' },
  pushBalkT: { color: C.coralD, fontSize: 13.5, fontWeight: '700', flex: 1, lineHeight: 18 },
  pushBalkKnop: { color: C.coralD, fontSize: 13.5, fontWeight: '900' },
  voucherChip: { backgroundColor: 'rgba(16,185,129,0.14)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  voucherChipT: { color: C.green, fontWeight: '800', fontSize: 12.5 },
  vOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(36,27,58,0.55)', justifyContent: 'center', alignItems: 'center', padding: 26,
  },
  vModal: {
    backgroundColor: C.card, borderRadius: 22, padding: 24, width: '100%', maxWidth: 380, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 8,
  },
  vModalKraam: { color: C.muted, fontSize: 13, fontWeight: '700' },
  vModalTitel: { color: C.ink, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  vModalDesc: { color: C.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  vQrWit: { backgroundColor: '#fff', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginTop: 20 },
  vModalHint: { color: C.muted, fontSize: 12.5, textAlign: 'center', marginTop: 14, lineHeight: 18 },
  vModalFout: { color: C.red, fontSize: 14, textAlign: 'center', marginVertical: 24, fontWeight: '600' },
  vGebruiktVak: { alignItems: 'center', paddingVertical: 26 },
  vGebruiktIcon: { color: C.green, fontSize: 54, fontWeight: '900' },
  vGebruiktT: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 6 },
  vGebruiktSub: { color: C.muted, fontSize: 13, marginTop: 4 },
  vSluit: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 28 },
  vSluitT: { color: C.coralD, fontSize: 15, fontWeight: '800' },
  bonusChip: { backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  bonusChipT: { color: '#fff', fontWeight: '900', fontSize: 15 },
})


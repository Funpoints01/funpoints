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
        <Text style={s.titel}>Bezoeker</Text>
        <Text style={s.sub}>Log in om je kermis-belevenis te openen.</Text>
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
        <Pressable onPress={() => router.push('/registreer')} style={[s.knop, s.knopWit]}>
          <Text style={s.knopWitT}>Account aanmaken</Text>
        </Pressable>
        <Text style={s.hint}>Heb je een Funpoints-kaartje? Scan de achterkant bij het registreren om je punten mee te nemen.</Text>
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

function Home({ session }: { session: Session }) {
  const router = useRouter()
  const [naam, setNaam] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [isBez, setIsBez] = useState<boolean | null>(null)
  const [kramen, setKramen] = useState<Kraam[]>([])
  const [kermissen, setKermissen] = useState<Kermis[]>([])
  const [acties, setActies] = useState<any[]>([])
  const [stats, setStats] = useState({ punten: 0, bezocht: 0, streak: 0, lunapark: false })
  const [laden, setLaden] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [vActie, setVActie] = useState<any | null>(null)
  const [vCode, setVCode] = useState<string | null>(null)
  const [vGebruikt, setVGebruikt] = useState<string | null>(null)
  const [vLaden, setVLaden] = useState(false)

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
    (async () => {
      const { data: bez } = await supabase.from('bezoeker').select('naam, code')
        .eq('auth_user_id', session.user.id).maybeSingle()
      setNaam(bez?.naam ?? ''); setCode(bez?.code ?? null); setIsBez(!!bez)

      const todayISO = new Date().toISOString().slice(0, 10)
      const [{ data: att }, { data: sal }, { data: boek }, { data: kerm }, { data: ka }, { data: act }] = await Promise.all([
        supabase.from('attractie_publiek').select('id, naam, soort'),
        supabase.from('saldo').select('attractie_id, saldo'),
        supabase.from('puntenboeking').select('attractie_id, punten, soort, created_at'),
        supabase.from('kermis').select('id, naam, plaats, van, tot').gte('tot', todayISO).order('van'),
        supabase.from('kermis_attractie').select('kermis_id'),
        supabase.from('actie').select('id, attractie_id, titel, beschrijving, soort, bonus_pct, van, tot, boost_tot, eenmalig').eq('actief', true).gte('tot', todayISO),
      ])

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

      setLaden(false)
    })()
  }, [])

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.coral} size="large" /></View>

  if (isBez === false) {
    return (
      <View style={[s.scherm, s.center, { padding: 28 }]}>
        <Text style={s.sub}>Deze login is geen bezoeker-account. Log uit en registreer je, of log in met je bezoeker-account.</Text>
        <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }} style={{ marginTop: 16 }}>
          <Text style={s.terug}>Uitloggen</Text>
        </Pressable>
      </View>
    )
  }

  const challenges = [
    { icon: '🎯', titel: 'Ontdekker', desc: 'Bezoek 3 verschillende kramen', nu: Math.min(stats.bezocht, 3), doel: 3, kleur: C.coral },
    { icon: '⭐', titel: 'Spaarder', desc: 'Spaar 100 punten', nu: Math.min(stats.punten, 100), doel: 100, kleur: C.amber },
    { icon: '🎡', titel: 'Avonturier', desc: 'Probeer een lunapark', nu: stats.lunapark ? 1 : 0, doel: 1, kleur: C.violet },
  ]
  const voornaam = naam ? naam.split(' ')[0] : ''

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.topbar}>
          <Logo />
          <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }}>
            <Text style={s.uitlog}>Uitloggen</Text>
          </Pressable>
        </View>

        <View style={s.hero}>
          <Text style={s.heroHi}>Hallo{voornaam ? `, ${voornaam}` : ''} 👋</Text>
          <View style={s.heroStats}>
            <View style={s.heroStat}><Text style={s.heroNum}>{stats.bezocht}</Text><Text style={s.heroSub}>kramen bezocht</Text></View>
            <View style={s.heroLijn} />
            <View style={s.heroStat}><Text style={s.heroNum}>{stats.punten}</Text><Text style={s.heroSub}>punten gespaard</Text></View>
          </View>
        </View>

        {acties.length > 0 ? (
          <>
            <Text style={s.sectie}>🔥 Acties & deals</Text>
            <View style={{ gap: 10 }}>
              {acties.map((a) => (
                <Pressable key={a.id} style={[s.actieKaart, a.geboost && s.actieBoost]}
                  onPress={() => a.eenmalig ? toonVoucher(a) : router.push(`/kraam/${a.attractie_id}`)}>
                  {a.geboost ? <Text style={s.uitgelicht}>⭐ UITGELICHT</Text> : null}
                  <View style={s.actieBinnen}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.actieTitel}>{a.titel}</Text>
                      <Text style={s.actieKraam}>{a.kraam}</Text>
                      {a.beschrijving ? <Text style={s.actieDesc}>{a.beschrijving}</Text> : null}
                      {a.eenmalig ? <Text style={s.voucherTag}>🎟️ Tik om je voucher op te halen</Text> : null}
                    </View>
                    {a.eenmalig ? (
                      <View style={s.voucherChip}><Text style={s.voucherChipT}>voucher</Text></View>
                    ) : a.soort === 'bonus_punten' && a.bonus_pct ? (
                      <View style={s.bonusChip}><Text style={s.bonusChipT}>+{a.bonus_pct}%</Text></View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.sectie}>🏆 Challenges</Text>
        <View style={{ gap: 10 }}>
          {challenges.map((c, i) => {
            const klaar = c.nu >= c.doel
            return (
              <View key={i} style={s.chalKaart}>
                <Text style={s.chalIcon}>{c.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={s.chalTop}>
                    <Text style={s.chalTitel}>{c.titel}</Text>
                    {klaar ? <Text style={s.chalKlaar}>✓ behaald</Text> : <Text style={s.chalNu}>{c.nu}/{c.doel}</Text>}
                  </View>
                  <Text style={s.chalDesc}>{c.desc}</Text>
                  <View style={s.balkBg}>
                    <View style={[s.balkVul, { width: `${Math.round((c.nu / c.doel) * 100)}%`, backgroundColor: klaar ? C.green : c.kleur }]} />
                  </View>
                </View>
              </View>
            )
          })}
        </View>

        <Text style={s.sectie}>🎪 Aankomende kermissen</Text>
        {kermissen.length === 0
          ? <View style={s.leeg}><Text style={s.sub}>Nog geen kermissen gepland.</Text></View>
          : <View style={{ gap: 10 }}>
              {kermissen.map((k) => (
                <Pressable key={k.id} style={s.kermKaart} onPress={() => router.push(`/kermis/${k.id}`)}>
                  <View style={s.kermIcon}><Text style={{ fontSize: 22 }}>🎡</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.kermNaam}>{k.naam}</Text>
                    <Text style={s.kermSub}>{k.plaats} · {kort(k.van)} – {kort(k.tot)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.kermKramen}>{k.kramen} kramen</Text>
                    <Text style={s.kermChev}>bekijk ›</Text>
                  </View>
                </Pressable>
              ))}
            </View>}

        <Text style={s.sectie}>🎟️ Mijn punten</Text>
        <View style={s.qrKaart}>
          {code
            ? <View style={s.qrWit}><QRCode value={`FP-B:${code}`} size={196} backgroundColor="#FFFFFF" color="#241B3A" /></View>
            : <Text style={s.kraartSoort}>QR wordt geladen…</Text>}
          <Text style={s.qrTitel}>Jouw punten-QR</Text>
          <Text style={s.qrHint}>
            Toon deze ene QR aan elk kraam. De foorkramer scant hem en je punten worden
            automatisch bij dàt kraam bijgeschreven of ingeruild — nooit door elkaar.
          </Text>
        </View>

        {kramen.some((k) => k.saldo !== 0) ? (
          <>
            <Text style={s.subKop}>Je saldo per kraam</Text>
            <View style={{ gap: 10 }}>
              {kramen.filter((k) => k.saldo !== 0).map((k) => (
                <View key={k.id} style={s.kraart}>
                  <View style={s.kraartRij}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.kraartNaam}>{k.naam}</Text>
                      <Text style={s.kraartSoort}>{k.soort}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.saldoNum}>{k.saldo}</Text>
                      <Text style={s.saldoLbl}>punten</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => router.push(`/kraam/${k.id}`)} style={s.detailLink}>
                    <Text style={s.detailLinkT}>📍 Waar staat dit kraam? ›</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={s.sub}>Je hebt nog geen punten gespaard. Laat je QR scannen bij een kraam om te beginnen.</Text>
        )}

        <Text style={s.voet}>Funpoints · meer belevenis komt eraan 🎠</Text>
      </ScrollView>

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
                  <Text style={s.vGebruiktT}>Al ingewisseld</Text>
                  <Text style={s.vGebruiktSub}>op {new Date(vGebruikt).toLocaleString('nl-BE')}</Text>
                </View>
              ) : (
                <>
                  <View style={s.vQrWit}>
                    <QRCode value={`FP-V:${vCode}`} size={200} backgroundColor="#FFFFFF" color="#241B3A" />
                  </View>
                  <Text style={s.vModalHint}>Toon deze QR aan de foorkramer. Hij kan hem één keer scannen.</Text>
                </>
              )
            ) : (
              <Text style={s.vModalFout}>Voucher ophalen mislukt. Probeer straks opnieuw.</Text>
            )}

            <Pressable style={s.vSluit} onPress={() => setVActie(null)}>
              <Text style={s.vSluitT}>Sluiten</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 22, paddingTop: 56, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
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
    backgroundColor: C.coral, borderRadius: 22, padding: 22, marginTop: 8,
    shadowColor: C.coral, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  heroHi: { color: '#fff', fontSize: 22, fontWeight: '900' },
  streakRij: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 12 },
  streakBig: { color: '#fff', fontSize: 40, fontWeight: '900' },
  streakLbl: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingVertical: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLijn: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroNum: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 },

  sectie: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 26, marginBottom: 12 },
  chalKaart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  chalIcon: { fontSize: 26, marginTop: 2 },
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


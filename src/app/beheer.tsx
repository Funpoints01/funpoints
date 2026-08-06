import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Polyline, Line, Circle, Path, Text as SvgText } from 'react-native-svg'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { DatumVeld } from '../components/DatumVeld'
import { BE_PROVINCIES } from '../lib/belgie'

const C = {
  bg: '#F7F6FB', card: '#FFFFFF', veld: '#F1EEF9', ink: '#241B3A',
  muted: '#7A7290', violet: '#8B5CF6', violetD: '#6D28D9', green: '#10B981',
  coral: '#FB7185', coralD: '#E11D63', amber: '#F59E0B', red: '#E11D48', redbg: 'rgba(225,29,72,0.10)',
  line: 'rgba(36,27,58,0.10)',
}
const PROV: Record<string, string> = {
  ANT: 'Antwerpen', OVL: 'Oost-Vlaanderen', WVL: 'West-Vlaanderen', VBR: 'Vlaams-Brabant',
  LIM: 'Limburg', BRU: 'Brussel', WBR: 'Waals-Brabant', HEN: 'Henegouwen',
  NAM: 'Namen', LIE: 'Luik', LUX: 'Luxemburg', Onbekend: 'Onbekend',
}
function maandLabel(iso: string): string { const [j, m] = iso.split('-'); return `${m}/${j.slice(2)}` }
function toonDatum(iso: string): string { const [j, m, d] = iso.split('-'); return `${d}-${m}-${j}` }

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
  const [email, setEmail] = useState(''); const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false); const [fout, setFout] = useState('')
  async function login() {
    setFout(''); setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: ww })
    setBezig(false); if (error) setFout('Inloggen mislukt — controleer je e-mail en wachtwoord.')
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
          <TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="jij@funpoints.be" placeholderTextColor={C.muted} />
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

function LijnGrafiek({ series, xlabels }: { series: { naam: string; kleur: string; waarden: number[] }[]; xlabels: string[] }) {
  const W = 680, H = 232, padL = 40, padR = 16, padT = 14, padB = 30
  const iW = W - padL - padR, iH = H - padT - padB
  const n = Math.max(1, ...series.map((r) => r.waarden.length))
  const maxRaw = Math.max(0, ...series.flatMap((r) => r.waarden))
  const max = maxRaw <= 0 ? 1 : maxRaw
  const px = (i: number) => padL + (n <= 1 ? iW / 2 : (i / (n - 1)) * iW)
  const py = (v: number) => padT + iH - (v / max) * iH
  const ticks = Array.from(new Set([0, Math.round(max / 2), max])).sort((a, b) => a - b)
  const xIdx = n <= 1 ? [0] : [0, n - 1]
  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((t) => <Line key={'g' + t} x1={padL} y1={py(t)} x2={W - padR} y2={py(t)} stroke="#EDEAF4" strokeWidth={1} />)}
        {ticks.map((t) => <SvgText key={'yl' + t} x={padL - 7} y={py(t) + 3.5} fill="#9a93ad" fontSize={10} fontWeight="700" textAnchor="end">{t}</SvgText>)}
        {series.map((r) => r.waarden.length >= 2 ? (
          <Polyline key={r.naam} points={r.waarden.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}
            fill="none" stroke={r.kleur} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        ) : null)}
        {series.map((r) => r.waarden.map((v, i) => n <= 14 ? (
          <Circle key={r.naam + i} cx={px(i)} cy={py(v)} r={3.4} fill={r.kleur} />
        ) : null))}
        {xIdx.map((i) => <SvgText key={'xl' + i} x={px(i)} y={H - 9} fill="#9a93ad" fontSize={10} fontWeight="700" textAnchor="middle">{xlabels[i] ?? ''}</SvgText>)}
      </Svg>
      <View style={s.legende}>
        {series.map((r) => (
          <View key={r.naam} style={s.legItem}><View style={[s.legDot, { backgroundColor: r.kleur }]} /><Text style={s.legT}>{r.naam}</Text></View>
        ))}
      </View>
    </View>
  )
}

function BelgieHeatmap() {
  const [punten, setPunten] = useState<{ lat: number; lon: number; aantal: number }[]>([])
  const [laden, setLaden] = useState(true)
  useEffect(() => {
    supabase.rpc('mgmt_heatmap').then(({ data }) => { setPunten((data ?? []) as any); setLaden(false) })
  }, [])
  if (laden) return <View style={{ paddingVertical: 30 }}><ActivityIndicator color={C.violet} /></View>
  const LAT0 = 49.45, LAT1 = 51.55, LON0 = 2.5, LON1 = 6.45
  const cosMid = Math.cos((50.5 * Math.PI) / 180)
  const W = 640, pad = 14
  const iW = W - 2 * pad
  const iH = iW * ((LAT1 - LAT0) / ((LON1 - LON0) * cosMid))
  const H = iH + 2 * pad
  const px = (lon: number) => pad + ((lon - LON0) / (LON1 - LON0)) * iW
  const py = (lat: number) => pad + ((LAT1 - lat) / (LAT1 - LAT0)) * iH
  const maxA = Math.max(1, ...punten.map((p) => p.aantal))
  const totaal = punten.reduce((t, p) => t + p.aantal, 0)
  return (
    <View>
      <View style={{ width: '100%', aspectRatio: W / H, backgroundColor: '#FBFAFE', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          {BE_PROVINCIES.map((d, i) => <Path key={'p' + i} d={d} fill="#E7E3F1" stroke="#FFFFFF" strokeWidth={1.2} />)}
          {punten.map((p, i) => {
            const rel = p.aantal / maxA
            const r = 6 + Math.sqrt(rel) * 16
            return (
              <Circle key={'h' + i} cx={px(p.lon)} cy={py(p.lat)} r={r}
                fill="#FB7185" fillOpacity={0.35 + 0.45 * rel} stroke="#E11D63" strokeWidth={1} strokeOpacity={0.55} />
            )
          })}
        </Svg>
      </View>
      <Text style={[s.blokSub, { marginTop: 8 }]}>
        {totaal} gebruiker(s) op {punten.length} postcode(s) · grotere bol = meer gebruikers
      </Text>
    </View>
  )
}

function Dashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<'overzicht' | 'attracties' | 'kermissen'>('overzicht')
  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.top}>
          <View style={s.logo}><View style={s.markSm}><Text style={s.markTSm}>F</Text></View><Text style={s.logoT}>Management</Text></View>
          <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }} hitSlop={8}><Text style={s.uitlog}>Uitloggen</Text></Pressable>
        </View>
        <View style={s.tabs}>
          {(['overzicht', 'attracties', 'kermissen'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabAan]}>
              <Text style={[s.tabT, tab === t && s.tabTAan]}>{t === 'overzicht' ? 'Overzicht' : t === 'attracties' ? 'Attracties' : 'Kermissen'}</Text>
            </Pressable>
          ))}
        </View>
        {tab === 'overzicht' ? <Overzicht /> : tab === 'attracties' ? <Attracties /> : <Kermissen />}
      </ScrollView>
    </View>
  )
}

function Overzicht() {
  const [ov, setOv] = useState<any>(null)
  const [reeks, setReeks] = useState<any[]>([])
  const [leeftijden, setLeeftijden] = useState<any[]>([])
  const [provincies, setProvincies] = useState<any[]>([])
  const [laden, setLaden] = useState(true)
  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: r }, { data: l }, { data: p }] = await Promise.all([
        supabase.rpc('mgmt_overzicht'), supabase.rpc('mgmt_accounts_over_tijd'),
        supabase.rpc('mgmt_leeftijden'), supabase.rpc('mgmt_provincies'),
      ])
      setOv(o); setReeks(r ?? []); setLeeftijden(l ?? []); setProvincies(p ?? []); setLaden(false)
    })()
  }, [])
  if (laden) return <View style={{ paddingVertical: 50 }}><ActivityIndicator color={C.violet} size="large" /></View>
  const maxL = Math.max(1, ...leeftijden.map((r: any) => Number(r.aantal)))
  const maxP = Math.max(1, ...provincies.map((r: any) => Number(r.aantal)))
  const xlabels = reeks.map((r: any) => maandLabel(r.maand))
  return (
    <>
      <View style={s.tegels}>
        <View style={s.tegel}><Text style={s.tegelNum}>{ov?.actieve_accounts ?? 0}</Text><Text style={s.tegelLbl}>Actieve accounts</Text></View>
        <View style={s.tegel}><Text style={[s.tegelNum, { color: C.amber }]}>{ov?.slapende_kaartjes ?? 0}</Text><Text style={s.tegelLbl}>Slapende kaartjes</Text></View>
        <View style={s.tegel}><Text style={[s.tegelNum, { color: C.green }]}>{ov?.geclaimde_kaartjes ?? 0}</Text><Text style={s.tegelLbl}>Geclaimde kaartjes</Text></View>
        <View style={s.tegel}><Text style={s.tegelNum}>{ov?.attracties ?? 0}</Text><Text style={s.tegelLbl}>Attracties</Text></View>
        <View style={s.tegel}><Text style={s.tegelNum}>{ov?.kermissen ?? 0}</Text><Text style={s.tegelLbl}>Kermissen</Text></View>
        <View style={s.tegel}><Text style={s.tegelNum}>{ov?.check_ins ?? 0}</Text><Text style={s.tegelLbl}>Check-ins</Text></View>
      </View>

      <View style={s.blok}>
        <Text style={s.blokTitel}>Gebruikers over tijd</Text>
        <Text style={s.blokSub}>Cumulatief · uitgedeelde kaartjes vs. geactiveerde accounts</Text>
        <View style={{ marginTop: 10 }}>
          {reeks.length === 0 ? <Text style={s.leeg}>Nog geen data.</Text> : (
            <LijnGrafiek xlabels={xlabels} series={[
              { naam: 'Kaartjes uitgedeeld', kleur: C.amber, waarden: reeks.map((r: any) => Number(r.kaartjes_cum)) },
              { naam: 'Accounts geactiveerd', kleur: C.violet, waarden: reeks.map((r: any) => Number(r.accounts_cum)) },
            ]} />
          )}
        </View>
      </View>

      <View style={s.blok}>
        <Text style={s.blokTitel}>Waar zitten je gebruikers?</Text>
        <Text style={s.blokSub}>Heatmap op de kaart van België</Text>
        <View style={{ marginTop: 12 }}><BelgieHeatmap /></View>
      </View>

      <View style={s.tweekolom}>
        <View style={[s.blok, s.kolom]}>
          <Text style={s.blokTitel}>Leeftijdscategorieën</Text>
          <View style={{ marginTop: 12, gap: 9 }}>
            {leeftijden.length === 0 ? <Text style={s.leeg}>Nog geen data.</Text> :
              leeftijden.map((r: any) => <Balk key={r.categorie} label={r.categorie} aantal={Number(r.aantal)} max={maxL} kleur={C.violet} />)}
          </View>
        </View>
        <View style={[s.blok, s.kolom]}>
          <Text style={s.blokTitel}>Per provincie</Text>
          <Text style={s.blokSub}>Aantal geactiveerde accounts</Text>
          <View style={{ marginTop: 12, gap: 9 }}>
            {provincies.length === 0 ? <Text style={s.leeg}>Nog geen data.</Text> :
              provincies.map((r: any) => <Balk key={r.provincie} label={PROV[r.provincie] ?? r.provincie} aantal={Number(r.aantal)} max={maxP} kleur={C.green} />)}
          </View>
        </View>
      </View>
    </>
  )
}

function Attracties() {
  const [lijst, setLijst] = useState<any[]>([])
  const [laden, setLaden] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [reeks, setReeks] = useState<any[]>([])
  useEffect(() => { supabase.rpc('mgmt_attracties').then(({ data }) => { setLijst(data ?? []); setLaden(false) }) }, [])
  async function toon(id: string) {
    if (open === id) { setOpen(null); return }
    setOpen(id); setDetail(null); setReeks([])
    const [{ data: d }, { data: r }] = await Promise.all([
      supabase.rpc('mgmt_attractie_detail', { p_id: id }),
      supabase.rpc('mgmt_attractie_punten_tijd', { p_id: id }),
    ])
    setDetail(d); setReeks(r ?? [])
  }
  if (laden) return <View style={{ paddingVertical: 50 }}><ActivityIndicator color={C.violet} size="large" /></View>
  return (
    <View style={{ marginTop: 4, gap: 10 }}>
      {lijst.length === 0 ? <View style={s.blok}><Text style={s.leeg}>Nog geen attracties.</Text></View> :
        lijst.map((a: any) => (
          <View key={a.id} style={s.blok}>
            <Pressable onPress={() => toon(a.id)} style={s.attrRij}>
              <View style={{ flex: 1 }}>
                <Text style={s.attrNaam}>{a.naam}</Text>
                <Text style={s.attrSub}>{a.soort} · {a.uitgedeeld} kaartje(s) uitgedeeld</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.attrPunten}>{a.openstaand}</Text>
                <Text style={s.attrPuntenL}>openstaand</Text>
              </View>
              <Text style={s.chev}>{open === a.id ? '⌄' : '›'}</Text>
            </Pressable>
            {open === a.id ? (
              !detail ? <View style={{ paddingVertical: 20 }}><ActivityIndicator color={C.violet} /></View> : (
                <View style={s.detail}>
                  <View style={s.detailTegels}>
                    <View style={s.dTegel}><Text style={[s.tegelNum, { color: C.amber }]}>{detail.uitgedeeld_slapend}</Text><Text style={s.tegelLbl}>Slapend uitgedeeld</Text></View>
                    <View style={s.dTegel}><Text style={[s.tegelNum, { color: C.green }]}>{detail.uitgedeeld_actief}</Text><Text style={s.tegelLbl}>Geactiveerd</Text></View>
                    <View style={s.dTegel}><Text style={s.tegelNum}>{detail.openstaand}</Text><Text style={s.tegelLbl}>Openstaande punten</Text></View>
                  </View>
                  <Text style={[s.blokSub, { marginTop: 14 }]}>Openstaande punten over tijd</Text>
                  {reeks.length === 0 ? <Text style={s.leeg}>Nog geen boekingen.</Text> :
                    <LijnGrafiek xlabels={reeks.map((r: any) => maandLabel(r.maand))} series={[{ naam: 'Openstaand', kleur: C.coral, waarden: reeks.map((r: any) => Number(r.openstaand)) }]} />}
                </View>
              )
            ) : null}
          </View>
        ))}
    </View>
  )
}

function Kermissen() {
  const [lijst, setLijst] = useState<any[]>([])
  const [laden, setLaden] = useState(true)
  const [bewerkId, setBewerkId] = useState<string | null>(null)
  const [naam, setNaam] = useState(''); const [plaats, setPlaats] = useState(''); const [postcode, setPostcode] = useState('')
  const [van, setVan] = useState(''); const [tot, setTot] = useState('')
  const [bezig, setBezig] = useState(false); const [fout, setFout] = useState('')

  async function herlaad() { const { data } = await supabase.rpc('mgmt_kermis_lijst'); setLijst(data ?? []); setLaden(false) }
  useEffect(() => { herlaad() }, [])

  function reset() { setBewerkId(null); setNaam(''); setPlaats(''); setPostcode(''); setVan(''); setTot(''); setFout('') }
  function bewerk(k: any) {
    setBewerkId(k.id); setNaam(k.naam); setPlaats(k.plaats ?? ''); setPostcode(k.postcode ?? '')
    setVan(k.van); setTot(k.tot); setFout('')
  }
  async function bewaar() {
    setFout('')
    if (!naam.trim()) return setFout('Geef een naam.')
    if (!van || !tot) return setFout('Kies begin- en einddatum.')
    if (tot < van) return setFout('Einddatum ligt vóór de startdatum.')
    setBezig(true)
    const args = { p_naam: naam.trim(), p_plaats: plaats.trim(), p_postcode: postcode.trim(), p_van: van, p_tot: tot }
    const { error } = bewerkId
      ? await supabase.rpc('mgmt_kermis_wijzig', { p_id: bewerkId, ...args })
      : await supabase.rpc('mgmt_kermis_nieuw', args)
    setBezig(false)
    if (error) return setFout('Opslaan mislukt.')
    reset(); herlaad()
  }
  async function verwijder(id: string) {
    setLijst((l) => l.filter((x) => x.id !== id))
    await supabase.rpc('mgmt_kermis_verwijder', { p_id: id })
  }

  return (
    <View style={{ marginTop: 4 }}>
      <View style={s.blok}>
        <Text style={s.blokTitel}>{bewerkId ? 'Kermis aanpassen' : 'Nieuwe kermis'}</Text>
        <Text style={[s.label, { marginTop: 12 }]}>Naam</Text>
        <TextInput style={s.input} value={naam} onChangeText={setNaam} placeholder="bv. Sinksenfoor Antwerpen" placeholderTextColor={C.muted} />
        <View style={s.rij}>
          <View style={{ flex: 1.5 }}><Text style={s.label}>Plaats</Text><TextInput style={s.input} value={plaats} onChangeText={setPlaats} placeholder="bv. Antwerpen" placeholderTextColor={C.muted} /></View>
          <View style={{ flex: 1 }}><Text style={s.label}>Postcode</Text><TextInput style={s.input} value={postcode} onChangeText={setPostcode} keyboardType="number-pad" maxLength={4} placeholder="optioneel" placeholderTextColor={C.muted} /></View>
        </View>
        <View style={s.rij}>
          <View style={{ flex: 1 }}><Text style={s.label}>Van</Text><DatumVeld value={van} onChange={setVan} /></View>
          <View style={{ flex: 1 }}><Text style={s.label}>Tot</Text><DatumVeld value={tot} onChange={setTot} /></View>
        </View>
        {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
        <View style={s.rij}>
          <Pressable onPress={bewaar} disabled={bezig} style={[s.knop, { flex: 1 }, bezig && { opacity: 0.5 }]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopT}>{bewerkId ? 'Opslaan' : '+ Toevoegen'}</Text>}
          </Pressable>
          {bewerkId ? <Pressable onPress={reset} style={[s.knopWit, { flex: 0.5 }]}><Text style={s.knopWitT}>Annuleren</Text></Pressable> : null}
        </View>
      </View>

      <Text style={[s.blokTitel, { marginTop: 20, marginBottom: 8 }]}>Alle kermissen</Text>
      {laden ? <ActivityIndicator color={C.violet} /> : lijst.length === 0 ? <View style={s.blok}><Text style={s.leeg}>Nog geen kermissen.</Text></View> : (
        <View style={{ gap: 10 }}>
          {lijst.map((k: any) => (
            <View key={k.id} style={[s.blok, s.kermRij]}>
              <View style={{ flex: 1 }}>
                <Text style={s.attrNaam}>{k.naam}</Text>
                <Text style={s.attrSub}>{k.plaats ?? '—'}{k.postcode ? ` · ${k.postcode}` : ''} · {toonDatum(k.van)} → {toonDatum(k.tot)} · {k.kramen} kraam(en)</Text>
              </View>
              <Pressable onPress={() => bewerk(k)} hitSlop={6}><Text style={s.wijzig}>Wijzig</Text></Pressable>
              <Pressable onPress={() => verwijder(k.id)} hitSlop={6}><Text style={s.verwijder}>Wis</Text></Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  wrap: { padding: 24, paddingTop: 34, paddingBottom: 60, maxWidth: 900, width: '100%', alignSelf: 'center' },
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
  knopWit: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopWitT: { color: C.muted, fontWeight: '800', fontSize: 15 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markSm: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center' },
  markTSm: { color: '#fff', fontWeight: '900', fontSize: 18 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  uitlog: { color: C.muted, fontSize: 14, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  tabAan: { backgroundColor: C.violet, borderColor: C.violet },
  tabT: { color: C.muted, fontWeight: '800', fontSize: 13.5 },
  tabTAan: { color: '#fff' },
  tegels: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tegel: { flexGrow: 1, flexBasis: 150, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16 },
  tegelNum: { color: C.violetD, fontSize: 28, fontWeight: '900' },
  tegelLbl: { color: C.muted, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  blok: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 16 },
  blokTitel: { color: C.ink, fontSize: 16, fontWeight: '900' },
  blokSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  leeg: { color: C.muted, fontSize: 13 },
  tweekolom: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  kolom: { flexGrow: 1, flexBasis: 300 },
  balkRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balkLabel: { width: 120, color: C.ink, fontSize: 13, fontWeight: '700' },
  balkBg: { flex: 1, height: 14, backgroundColor: C.veld, borderRadius: 999, overflow: 'hidden' },
  balkVul: { height: 14, borderRadius: 999 },
  balkNum: { width: 44, textAlign: 'right', color: C.ink, fontSize: 13, fontWeight: '800' },
  grafiekVoet: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  grafiekAs: { color: C.muted, fontSize: 11, fontWeight: '700' },
  legende: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legDot: { width: 10, height: 10, borderRadius: 999 },
  legT: { color: C.muted, fontSize: 12, fontWeight: '700' },
  attrRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  attrNaam: { color: C.ink, fontSize: 15.5, fontWeight: '800' },
  attrSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  attrPunten: { color: C.violetD, fontSize: 18, fontWeight: '900' },
  attrPuntenL: { color: C.muted, fontSize: 10.5, fontWeight: '700' },
  chev: { color: C.violet, fontSize: 22, fontWeight: '700', width: 18, textAlign: 'center' },
  detail: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  detailTegels: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  dTegel: { flexGrow: 1, flexBasis: 120, backgroundColor: C.veld, borderRadius: 12, padding: 12 },
  rij: { flexDirection: 'row', gap: 12, marginTop: 14 },
  kermRij: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 0 },
  wijzig: { color: C.violet, fontSize: 13, fontWeight: '800' },
  verwijder: { color: C.red, fontSize: 13, fontWeight: '800' },
})

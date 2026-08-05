import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', coralD: '#E11D63', green: '#10B981',
  amber: '#F59E0B', violet: '#8B5CF6', violetD: '#6D28D9', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}
const MEDAILLE = ['🥇', '🥈', '🥉']
type MetricKey = 'bezoeken' | 'kermissen' | 'bezoeken_maand'
const METRICS: { key: MetricKey; label: string; lbl: string }[] = [
  { key: 'bezoeken', label: 'Bezoeken', lbl: 'check-ins' },
  { key: 'kermissen', label: 'Kermissen', lbl: 'kermissen' },
  { key: 'bezoeken_maand', label: 'Deze maand', lbl: 'deze maand' },
]

type Persoon = { bezoeker_id: string; naam: string; gebruikersnaam?: string | null }
type Verzoek = { verzoek_id: string; van_bezoeker: string; naam: string; gebruikersnaam?: string | null }
type Rang = { bezoeker_id: string; naam: string; gebruikersnaam?: string | null; bezoeken: number; kermissen: number; bezoeken_maand: number; is_ik: boolean }
function letter(p: { gebruikersnaam?: string | null; naam?: string | null }): string {
  return ((p.gebruikersnaam || p.naam || '?').slice(0, 1)).toUpperCase()
}

export function Vrienden() {
  const router = useRouter()
  const [laden, setLaden] = useState(true)
  const [vrienden, setVrienden] = useState<Persoon[]>([])
  const [verzoeken, setVerzoeken] = useState<Verzoek[]>([])
  const [bord, setBord] = useState<Rang[]>([])

  const [email, setEmail] = useState('')
  const [zoekBezig, setZoekBezig] = useState(false)
  const [resultaat, setResultaat] = useState<Persoon | null>(null)
  const [geenResultaat, setGeenResultaat] = useState(false)
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null)
  const [metric, setMetric] = useState<MetricKey>('bezoeken')

  async function herlaad() {
    const [{ data: v }, { data: vz }, { data: lb }] = await Promise.all([
      supabase.rpc('mijn_vrienden'),
      supabase.rpc('openstaande_verzoeken'),
      supabase.rpc('vrienden_leaderboard'),
    ])
    setVrienden((v ?? []) as Persoon[])
    setVerzoeken((vz ?? []) as Verzoek[])
    setBord((lb ?? []) as Rang[])
    setLaden(false)
  }
  useEffect(() => { herlaad() }, [])

  async function zoeken() {
    if (!email.trim()) return
    setZoekBezig(true); setResultaat(null); setGeenResultaat(false); setMelding(null)
    const { data } = await supabase.rpc('zoek_vrienden', { p_term: email.trim() })
    setZoekBezig(false)
    const r = (data ?? []) as any[]
    if (r.length) setResultaat({ bezoeker_id: r[0].id, naam: r[0].naam, gebruikersnaam: r[0].gebruikersnaam })
    else setGeenResultaat(true)
  }

  async function stuurVerzoek(id: string) {
    setMelding(null)
    const { error } = await supabase.rpc('vriend_verzoek', { p_naar: id })
    if (error) {
      setMelding({ ok: false, tekst: error.message.includes('BESTAAT_AL') ? 'Jullie zijn al verbonden of er loopt al een verzoek.' : 'Versturen mislukt.' })
      return
    }
    setResultaat(null); setEmail('')
    setMelding({ ok: true, tekst: 'Verzoek verstuurd! 🎉' })
  }

  async function antwoord(verzoekId: string, aanvaard: boolean) {
    setVerzoeken((prev) => prev.filter((x) => x.verzoek_id !== verzoekId))
    await supabase.rpc('vriend_antwoord', { p_verzoek_id: verzoekId, p_aanvaard: aanvaard })
    herlaad()
  }

  if (laden) return <View style={{ paddingVertical: 40 }}><ActivityIndicator color={C.violet} size="large" /></View>

  return (
    <View>
      <Text style={s.paginaTitel}>👥 Vrienden</Text>

      <View style={s.hero}>
        <Text style={s.heroKick}>VOLG JE VRIENDEN</Text>
        <Text style={s.heroBig}>{vrienden.length} {vrienden.length === 1 ? 'vriend' : 'vrienden'}</Text>
        <Text style={s.heroSub}>Vergelijk jullie streaks en klim in de ranglijst.</Text>
      </View>

      {/* Zoeken op e-mail */}
      <View style={s.kaart}>
        <Text style={s.blokTitel}>Vriend toevoegen</Text>
        <Text style={s.blokSub}>Zoek iemand op zijn gebruikersnaam.</Text>
        <View style={s.zoekRij}>
          <TextInput style={s.input} value={email}
            onChangeText={(t) => { setEmail(t.replace(/[^A-Za-z0-9_]/g, '')); setGeenResultaat(false) }}
            autoCapitalize="none" placeholder="gebruikersnaam" placeholderTextColor={C.muted} />
          <Pressable onPress={zoeken} disabled={zoekBezig} style={[s.zoekKnop, zoekBezig && s.uit]}>
            {zoekBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.zoekKnopT}>Zoek</Text>}
          </Pressable>
        </View>

        {resultaat ? (
          <View style={s.resRij}>
            <View style={s.avatar}><Text style={s.avatarT}>{letter(resultaat)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.resNaam}>@{resultaat.gebruikersnaam}</Text>
              <Text style={s.resSub}>{resultaat.naam || 'Bezoeker'}</Text>
            </View>
            <Pressable onPress={() => stuurVerzoek(resultaat.bezoeker_id)} style={s.volgKnop}>
              <Text style={s.volgKnopT}>+ Verzoek</Text>
            </Pressable>
          </View>
        ) : null}
        {geenResultaat ? <Text style={s.geen}>Geen bezoeker met die gebruikersnaam gevonden.</Text> : null}
        {melding ? (
          <View style={[s.mBox, melding.ok && s.mBoxOk]}><Text style={[s.mT, melding.ok && s.mTOk]}>{melding.tekst}</Text></View>
        ) : null}
      </View>

      {/* Openstaande verzoeken */}
      {verzoeken.length > 0 ? (
        <>
          <Text style={s.sectie}>📨 Verzoeken</Text>
          <View style={{ gap: 10 }}>
            {verzoeken.map((v) => (
              <View key={v.verzoek_id} style={s.vzKaart}>
                <View style={s.avatar}><Text style={s.avatarT}>{letter(v)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.resNaam}>{v.gebruikersnaam ? `@${v.gebruikersnaam}` : (v.naam || 'Bezoeker')}</Text>
                  <Text style={s.resSub}>wil je vriend worden</Text>
                </View>
                <Pressable onPress={() => antwoord(v.verzoek_id, true)} style={s.jaKnop}><Text style={s.jaKnopT}>Aanvaard</Text></Pressable>
                <Pressable onPress={() => antwoord(v.verzoek_id, false)} style={s.neeKnop}><Text style={s.neeKnopT}>✕</Text></Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Ranglijst */}
      <Text style={s.sectie}>🏆 Ranglijst</Text>
      {bord.length <= 1 && vrienden.length === 0 ? (
        <View style={s.leeg}><Text style={s.leegT}>Voeg vrienden toe om samen een ranglijst te vormen.</Text></View>
      ) : (
        <>
          <View style={s.metricRij}>
            {METRICS.map((m) => (
              <Pressable key={m.key} onPress={() => setMetric(m.key)} style={[s.metricTab, metric === m.key && s.metricTabAan]}>
                <Text style={[s.metricTabT, metric === m.key && s.metricTabTAan]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {[...bord].sort((a, b) => Number(b[metric]) - Number(a[metric]) || Number(b.bezoeken) - Number(a.bezoeken)).map((r, i) => (
              <View key={r.bezoeker_id} style={[s.rang, r.is_ik && s.rangIk]}>
                <Text style={s.rangPos}>{MEDAILLE[i] ?? `${i + 1}`}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rangNaam, r.is_ik && s.rangNaamIk]}>{r.is_ik ? 'Jij' : (r.gebruikersnaam ? `@${r.gebruikersnaam}` : (r.naam || 'Bezoeker'))}</Text>
                  <Text style={s.rangSub}>{r.bezoeken} check-ins · {r.kermissen} kermissen</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.rangGetal}>{r[metric]}</Text>
                  <Text style={s.rangLbl}>{METRICS.find((m) => m.key === metric)?.lbl}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Vriendenlijst */}
      {vrienden.length > 0 ? (
        <>
          <Text style={s.sectie}>Je vrienden</Text>
          <View style={{ gap: 10 }}>
            {vrienden.map((v) => (
              <Pressable key={v.bezoeker_id} style={s.vriendRij}
                onPress={() => router.push(`/vriend/${v.bezoeker_id}?naam=${encodeURIComponent(v.gebruikersnaam ? '@' + v.gebruikersnaam : (v.naam || 'Vriend'))}`)}>
                <View style={s.avatar}><Text style={s.avatarT}>{letter(v)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.resNaam}>{v.gebruikersnaam ? `@${v.gebruikersnaam}` : (v.naam || 'Bezoeker')}</Text>
                  {v.naam && v.gebruikersnaam ? <Text style={s.resSub}>{v.naam}</Text> : null}
                </View>
                <Text style={s.chev}>›</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  paginaTitel: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginBottom: 12 },
  hero: {
    backgroundColor: C.violet, borderRadius: 20, padding: 20, overflow: 'hidden',
    shadowColor: C.violet, shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  heroKick: { color: 'rgba(255,255,255,0.9)', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 },
  heroBig: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  kaart: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18, marginTop: 16 },
  blokTitel: { color: C.ink, fontSize: 16, fontWeight: '900' },
  blokSub: { color: C.muted, fontSize: 12.5, marginTop: 3, marginBottom: 12 },
  zoekRij: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  zoekKnop: { backgroundColor: C.violet, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  zoekKnopT: { color: '#fff', fontWeight: '800', fontSize: 14 },
  uit: { opacity: 0.5 },
  resRij: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, backgroundColor: C.veld, borderRadius: 12, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: '#fff', fontWeight: '900', fontSize: 17 },
  resNaam: { color: C.ink, fontSize: 15, fontWeight: '800' },
  resSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  volgKnop: { backgroundColor: C.violet, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  volgKnopT: { color: '#fff', fontWeight: '800', fontSize: 13 },
  geen: { color: C.muted, fontSize: 13, marginTop: 12 },
  mBox: { backgroundColor: C.redbg, borderRadius: 10, padding: 11, marginTop: 12 },
  mBoxOk: { backgroundColor: 'rgba(16,185,129,0.12)' },
  mT: { color: C.red, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  mTOk: { color: '#0E9E70' },
  sectie: { color: C.ink, fontSize: 17, fontWeight: '900', marginTop: 24, marginBottom: 12 },
  vzKaart: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)', padding: 12 },
  jaKnop: { backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  jaKnopT: { color: '#fff', fontWeight: '800', fontSize: 13 },
  neeKnop: { backgroundColor: C.veld, borderRadius: 999, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  neeKnopT: { color: C.muted, fontWeight: '900', fontSize: 15 },
  leeg: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 18 },
  leegT: { color: C.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  metricRij: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  metricTab: { flex: 1, backgroundColor: C.veld, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  metricTabAan: { backgroundColor: C.violet },
  metricTabT: { color: C.muted, fontWeight: '800', fontSize: 12 },
  metricTabTAan: { color: '#fff' },
  rang: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14 },
  rangIk: { borderColor: C.violet, borderWidth: 1.5, backgroundColor: 'rgba(139,92,246,0.06)' },
  rangPos: { fontSize: 18, fontWeight: '900', color: C.ink, width: 28, textAlign: 'center' },
  rangNaam: { color: C.ink, fontSize: 15, fontWeight: '800' },
  rangNaamIk: { color: C.violetD },
  rangSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  rangGetal: { color: C.ink, fontSize: 19, fontWeight: '900' },
  rangLbl: { color: C.muted, fontSize: 10.5, fontWeight: '700' },
  vriendRij: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14 },
  chev: { color: C.violet, fontSize: 24, fontWeight: '700' },
})

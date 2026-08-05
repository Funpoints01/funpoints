import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', coralD: '#E11D63', green: '#10B981',
  amber: '#F59E0B', violet: '#8B5CF6', line: 'rgba(36,27,58,0.10)',
}
const BANDEN = ['#E11D63', '#F59E0B', '#8B5CF6', '#10B981']

type Traditie = {
  key: string; naam: string; plaats: string | null
  jaarOpRij: number; sinds: number; bezoeken: number; laatste: number
}

export default function Tradities() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  const [tradities, setTradities] = useState<Traditie[]>([])
  const [totaalBezoeken, setTotaalBezoeken] = useState(0)
  const [isBez, setIsBez] = useState<boolean | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setIsBez(false); setLaden(false); return }
      const { data: bez } = await supabase.from('bezoeker').select('id').eq('auth_user_id', session.user.id).maybeSingle()
      if (!bez) { setIsBez(false); setLaden(false); return }
      setIsBez(true)

      const { data: inc } = await supabase.from('incheck').select('kermis_id, ingecheckt_op')
      const kermisIds = [...new Set((inc ?? []).map((r: any) => r.kermis_id))]
      setTotaalBezoeken((inc ?? []).length)
      if (!kermisIds.length) { setLaden(false); return }

      const { data: kerm } = await supabase.from('kermis').select('id, naam, plaats, van').in('id', kermisIds)
      const kMap = new Map<string, any>((kerm ?? []).map((k: any) => [k.id, k]))

      // Groepeer per plaats (of naam) — een traditie is "elk jaar naar dezelfde kermis".
      const groepen = new Map<string, { naam: string; plaats: string | null; jaren: Set<number>; bezoeken: number }>()
      ;(inc ?? []).forEach((r: any) => {
        const k = kMap.get(r.kermis_id)
        if (!k) return
        const key = (k.plaats || k.naam || '').trim().toLowerCase()
        if (!key) return
        const jaar = parseInt(String(k.van).slice(0, 4), 10)
        const g = groepen.get(key) ?? { naam: k.naam, plaats: k.plaats, jaren: new Set<number>(), bezoeken: 0 }
        g.jaren.add(jaar)
        g.bezoeken += 1
        // Bewaar de meest recente naam
        g.naam = k.naam
        groepen.set(key, g)
      })

      const lijst: Traditie[] = [...groepen.entries()].map(([key, g]) => {
        const jaren = [...g.jaren].sort((a, b) => b - a)
        const laatste = jaren[0]
        let streak = 0
        for (let i = 0; i < jaren.length; i++) {
          if (jaren[i] === laatste - i) streak++
          else break
        }
        return { key, naam: g.naam, plaats: g.plaats, jaarOpRij: streak, sinds: jaren[jaren.length - 1], bezoeken: g.bezoeken, laatste }
      }).sort((a, b) => b.jaarOpRij - a.jaarOpRij || b.bezoeken - a.bezoeken)

      setTradities(lijst)
      setLaden(false)
    })()
  }, [])

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.amber} size="large" /></View>

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={wrapC}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/bezoeker'))} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>
        <Text style={s.paginaTitel}>🏆 Mijn tradities</Text>

        <View style={s.hero}>
          <Text style={s.heroKick}>JAARLIJKSE KERMIS-TRADITIES</Text>
          <Text style={s.heroBig}>{tradities.length} {tradities.length === 1 ? 'traditie' : 'tradities'}</Text>
          <Text style={s.heroSub}>De kermissen waar je elk jaar terugkeert · {totaalBezoeken} bezoek{totaalBezoeken === 1 ? '' : 'en'} in totaal</Text>
        </View>

        {tradities.length === 0 ? (
          <View style={s.leeg}>
            <Text style={s.leegIcon}>🎪</Text>
            <Text style={s.leegT}>Nog geen tradities</Text>
            <Text style={s.leegSub}>
              Check in op een kermis terwijl ze loopt — via de knop op de kermispagina of automatisch wanneer een foorkramer je QR scant. Kom je volgend jaar terug, dan groeit je streak.
            </Text>
            <Pressable onPress={() => router.push('/bezoeker')} style={s.leegKnop}>
              <Text style={s.leegKnopT}>Naar de kalender</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {tradities.map((t, i) => (
              <View key={t.key} style={s.tKaart}>
                <View style={[s.tBand, { backgroundColor: BANDEN[i % BANDEN.length] }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tNaam}>{t.naam}</Text>
                    <Text style={s.tSinds}>Sinds {t.sinds}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.tGetal}>{t.jaarOpRij}</Text>
                    <Text style={s.tGetalLbl}>{t.jaarOpRij === 1 ? 'JAAR' : 'JAAR OP RIJ'}</Text>
                  </View>
                </View>
                <View style={s.tVoet}>
                  <Text style={s.tVoetT}>📍 {t.plaats ?? t.naam}</Text>
                  <Text style={s.tVoetT}>🎟️ {t.bezoeken} bezoek{t.bezoeken === 1 ? '' : 'en'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 22, paddingTop: 56, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 18 },
  paginaTitel: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginBottom: 12 },
  hero: {
    backgroundColor: C.amber, borderRadius: 20, padding: 20, overflow: 'hidden',
    shadowColor: C.amber, shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  heroKick: { color: 'rgba(255,255,255,0.92)', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 },
  heroBig: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 6, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  leeg: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 24, alignItems: 'center', marginTop: 18 },
  leegIcon: { fontSize: 40 },
  leegT: { color: C.ink, fontSize: 17, fontWeight: '900', marginTop: 10 },
  leegSub: { color: C.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  leegKnop: { marginTop: 18, backgroundColor: C.coral, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13 },
  leegKnopT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  tKaart: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  tBand: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  tNaam: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  tSinds: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  tGetal: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 32 },
  tGetalLbl: { color: 'rgba(255,255,255,0.92)', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  tVoet: { flexDirection: 'row', gap: 16, paddingHorizontal: 18, paddingVertical: 14 },
  tVoetT: { color: C.muted, fontSize: 13, fontWeight: '700' },
})

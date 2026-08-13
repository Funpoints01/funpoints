import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { BottomNav } from '../../components/BottomNav'
import { niveau } from '../../lib/levels'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', ink: '#241B3A', muted: '#7A7290',
  coral: '#FB7185', coralD: '#E11D63', green: '#10B981', amber: '#F59E0B',
  violet: '#8B5CF6', line: 'rgba(36,27,58,0.10)',
}
const BANDEN = ['#6D28D9', '#E11D63', '#F59E0B', '#10B981']
const NIVEAUS = [
  { icon: '🎯', titel: 'Ontdekker', k: 'bezocht', basis: [3, 5, 8, 12, 20], kleur: C.coral, eenheid: 'kramen' },
  { icon: '🎪', titel: 'Kermisganger', k: 'checkins', basis: [1, 3, 6, 10, 20], kleur: C.violet, eenheid: 'check-ins' },
  { icon: '⭐', titel: 'Puntenjager', k: 'punten', basis: [50, 150, 350, 700, 1500], kleur: C.amber, eenheid: 'punten' },
  { icon: '❤️', titel: 'Kraamfan', k: 'gevolgd', basis: [1, 3, 5, 10, 20], kleur: C.green, eenheid: 'gevolgde kramen' },
  { icon: '🔥', titel: 'Streakmeester', k: 'streak', basis: [2, 3, 5, 7, 14], kleur: C.coralD, eenheid: 'dagen op rij' },
] as const

type Traditie = { key: string; naam: string; plaats: string | null; jaarOpRij: number; sinds: number; bezoeken: number }

export default function VriendProfiel() {
  const router = useRouter()
  const { id, naam } = useLocalSearchParams<{ id: string; naam?: string }>()
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  const [tradities, setTradities] = useState<Traditie[]>([])
  const [bezoeken, setBezoeken] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [fout, setFout] = useState(false)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('bezoeker_tradities', { p_bezoeker_id: id })
      if (error) { setFout(true); setLaden(false); return }
      const rijen = (data ?? []) as any[]
      setBezoeken(rijen.length)
      const groepen = new Map<string, { naam: string; plaats: string | null; jaren: Set<number>; bezoeken: number }>()
      rijen.forEach((r) => {
        const key = r.reeks_id
        const g = groepen.get(key) ?? { naam: r.naam, plaats: r.plaats, jaren: new Set<number>(), bezoeken: 0 }
        g.jaren.add(r.jaar); g.bezoeken += 1; g.naam = r.naam; g.plaats = r.plaats
        groepen.set(key, g)
      })
      const lijst: Traditie[] = [...groepen.entries()].map(([key, g]) => {
        const jaren = [...g.jaren].sort((a, b) => b - a)
        const laatste = jaren[0]
        let streak = 0
        for (let i = 0; i < jaren.length; i++) { if (jaren[i] === laatste - i) streak++; else break }
        return { key, naam: g.naam, plaats: g.plaats, jaarOpRij: streak, sinds: jaren[jaren.length - 1], bezoeken: g.bezoeken }
      }).sort((a, b) => b.jaarOpRij - a.jaarOpRij || b.bezoeken - a.bezoeken)
      setTradities(lijst)
      const { data: st } = await supabase.rpc('bezoeker_stats', { p_bezoeker_id: id })
      setStats(Array.isArray(st) ? st[0] : st)
      setLaden(false)
    })()
  }, [id])

  const naamStr = typeof naam === 'string' ? naam : 'Vriend'

  const niveaus = stats ? NIVEAUS.map((d) => { const w = Number((stats as any)[d.k] ?? 0); return { ...d, waarde: w, ...niveau(w, [...d.basis]) } }) : []

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>

  return (
    <View style={s.scherm}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={wrapC}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/bezoeker'))} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>

        <View style={s.hero}>
          <View style={s.avatar}><Text style={s.avatarT}>{naamStr.slice(0, 1).toUpperCase()}</Text></View>
          <Text style={s.heroNaam}>{naamStr}</Text>
          <View style={s.heroStats}>
            <View style={s.heroStat}><Text style={s.heroNum}>{tradities.length}</Text><Text style={s.heroLbl}>tradities</Text></View>
            <View style={s.heroLijn} />
            <View style={s.heroStat}><Text style={s.heroNum}>{bezoeken}</Text><Text style={s.heroLbl}>bezoeken</Text></View>
          </View>
        </View>

        {stats ? (
          <>
            <Text style={s.sectie}>🏅 Levels</Text>
            <View style={{ gap: 10 }}>
              {niveaus.map((nv, i) => {
                const pct = Math.max(0, Math.min(1, (nv.waarde - nv.start) / (nv.volgende - nv.start)))
                const resterend = Math.max(0, nv.volgende - nv.waarde)
                return (
                  <View key={i} style={s.chalKaart}>
                    <View style={[s.lvlIcon, { backgroundColor: nv.kleur + '22' }]}><Text style={{ fontSize: 22 }}>{nv.icon}</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={s.chalTop}>
                        <Text style={s.chalTitel}>{nv.titel}</Text>
                        <View style={[s.lvlBadge, { backgroundColor: nv.kleur }]}><Text style={s.lvlBadgeT}>Level {nv.level}</Text></View>
                      </View>
                      <Text style={s.chalDesc}>Nog {resterend} {nv.eenheid} tot level {nv.level + 1}</Text>
                      <View style={s.balkBg}><View style={[s.balkVul, { width: `${Math.round(pct * 100)}%`, backgroundColor: nv.kleur }]} /></View>
                      <Text style={s.lvlSub}>{nv.waarde} / {nv.volgende} {nv.eenheid}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        ) : null}

        {fout ? (
          <View style={s.leeg}><Text style={s.leegT}>Je kan de tradities van deze bezoeker niet bekijken.</Text></View>
        ) : tradities.length === 0 ? (
          <View style={s.leeg}><Text style={s.leegT}>{naamStr} heeft nog geen tradities opgebouwd.</Text></View>
        ) : (
          <>
            <Text style={s.sectie}>🏆 Tradities</Text>
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
          </>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 22, paddingTop: 56, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 18 },
  hero: { backgroundColor: C.violet, borderRadius: 22, padding: 24, alignItems: 'center', shadowColor: C.violet, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  avatar: { width: 62, height: 62, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: '#fff', fontWeight: '900', fontSize: 26 },
  heroNaam: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 10 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingVertical: 12, alignSelf: 'stretch' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLijn: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroNum: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroLbl: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  sectie: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 12 },
  leeg: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 22, marginTop: 16 },
  leegT: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tKaart: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  tBand: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  tNaam: { color: '#fff', fontSize: 18, fontWeight: '900' },
  tSinds: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  tGetal: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 32 },
  tGetalLbl: { color: 'rgba(255,255,255,0.92)', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  tVoet: { flexDirection: 'row', gap: 16, paddingHorizontal: 18, paddingVertical: 14 },
  tVoetT: { color: C.muted, fontSize: 13, fontWeight: '700' },
  chalKaart: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14 },
  lvlIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chalTitel: { color: C.ink, fontSize: 15, fontWeight: '900' },
  lvlBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  lvlBadgeT: { color: '#fff', fontSize: 10.5, fontWeight: '900' },
  chalDesc: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  balkBg: { height: 7, borderRadius: 999, backgroundColor: C.line, marginTop: 8, overflow: 'hidden' },
  balkVul: { height: 7, borderRadius: 999 },
  lvlSub: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 5 },
})

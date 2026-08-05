import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', ink: '#241B3A', muted: '#7A7290',
  coral: '#FB7185', coralD: '#E11D63', line: 'rgba(36,27,58,0.10)',
}
const EMOJI: Record<string, string> = { lunapark: '🎡', schietkraam: '🎯', eendjes: '🦆', ander: '🎪' }
function kort(iso: string): string { const [, m, d] = iso.split('-'); return `${d}/${m}` }

type Attr = { id: string; naam: string; soort: string }

export default function KermisDetail() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  const [kermis, setKermis] = useState<any>(null)
  const [kramen, setKramen] = useState<Attr[]>([])
  const [volgSet, setVolgSet] = useState<Set<string>>(new Set())
  const [isBez, setIsBez] = useState(false)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: k } = await supabase.from('kermis').select('*').eq('id', id).maybeSingle()
      setKermis(k)
      const { data: ka } = await supabase.from('kermis_attractie').select('attractie_id').eq('kermis_id', id)
      const ids = new Set((ka ?? []).map((r: any) => r.attractie_id))
      const { data: att } = await supabase.from('attractie_publiek').select('id, naam, soort')
      setKramen((att ?? []).filter((a: any) => ids.has(a.id)) as Attr[])

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: bez } = await supabase.from('bezoeker').select('id').eq('auth_user_id', session.user.id).maybeSingle()
        if (bez) {
          setIsBez(true)
          const { data: v } = await supabase.from('kraam_volger').select('attractie_id')
          setVolgSet(new Set((v ?? []).map((r: any) => r.attractie_id)))
        }
      }
      setLaden(false)
    })()
  }, [id])

  async function wisselVolg(attractieId: string) {
    const isVolg = volgSet.has(attractieId)
    const next = !isVolg
    setVolgSet((prev) => {
      const n = new Set(prev)
      if (next) n.add(attractieId); else n.delete(attractieId)
      return n
    })
    await supabase.rpc('zet_kraam_volg', { p_attractie_id: attractieId, p_volg: next })
  }

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.coral} size="large" /></View>
  if (!kermis) return (
    <View style={[s.scherm, s.center, { padding: 28 }]}>
      <Text style={s.sub}>Deze kermis bestaat niet meer.</Text>
      <Pressable onPress={() => router.push('/bezoeker')} style={{ marginTop: 14 }}><Text style={s.terug}>Terug</Text></Pressable>
    </View>
  )

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={wrapC}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/bezoeker'))} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>

        <View style={s.hero}>
          <Text style={s.heroEmoji}>🎪</Text>
          <Text style={s.heroTitel}>{kermis.naam}</Text>
          <Text style={s.heroSub}>{kermis.plaats}{kermis.postcode ? ` · ${kermis.postcode}` : ''}</Text>
          <View style={s.datumPil}><Text style={s.datumPilT}>{kort(kermis.van)} – {kort(kermis.tot)}</Text></View>
        </View>

        <Text style={s.sectie}>Kramen op deze kermis ({kramen.length})</Text>
        {kramen.length === 0
          ? <View style={s.leeg}><Text style={s.sub}>Nog geen kramen aangekondigd.</Text></View>
          : <View style={{ gap: 10 }}>
              {kramen.map((a) => {
                const volgt = volgSet.has(a.id)
                return (
                  <Pressable key={a.id} style={s.rij} onPress={() => router.push(`/kraam/${a.id}`)}>
                    <View style={s.rijIcon}><Text style={{ fontSize: 22 }}>{EMOJI[a.soort] ?? '🎪'}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rijNaam}>{a.naam}</Text>
                      <Text style={s.rijSub}>{a.soort}</Text>
                    </View>
                    {isBez ? (
                      <Pressable onPress={() => wisselVolg(a.id)} hitSlop={10} style={[s.hart, volgt && s.hartAan]}>
                        <Text style={s.hartT}>{volgt ? '❤️' : '🤍'}</Text>
                      </Pressable>
                    ) : null}
                    <Text style={s.chevron}>›</Text>
                  </Pressable>
                )
              })}
            </View>}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 22, paddingTop: 56, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 20 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6 },
  hero: {
    backgroundColor: C.coral, borderRadius: 22, padding: 24, alignItems: 'center',
    shadowColor: C.coral, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  heroEmoji: { fontSize: 40 },
  heroTitel: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 14.5, fontWeight: '600', marginTop: 4 },
  datumPil: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  datumPilT: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sectie: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 26, marginBottom: 12 },
  leeg: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 18 },
  rij: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  rijIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(251,113,133,0.14)', alignItems: 'center', justifyContent: 'center' },
  rijNaam: { color: C.ink, fontSize: 16, fontWeight: '800' },
  rijSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  hart: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  hartAan: { backgroundColor: 'rgba(251,113,133,0.14)' },
  hartT: { fontSize: 18 },
  chevron: { color: C.coral, fontSize: 26, fontWeight: '700' },
})

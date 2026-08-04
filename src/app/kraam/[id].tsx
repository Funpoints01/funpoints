import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import { supabase } from '../../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', ink: '#241B3A', muted: '#7A7290',
  coral: '#FB7185', coralD: '#E11D63', green: '#10B981', line: 'rgba(36,27,58,0.10)',
}
const EMOJI: Record<string, string> = { lunapark: '🎡', schietkraam: '🎯', eendjes: '🦆', ander: '🎪' }
function kort(iso: string): string { const [, m, d] = iso.split('-'); return `${d}/${m}` }

type Kermis = { id: string; naam: string; plaats: string; van: string; tot: string }

export default function KraamDetail() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  const [attr, setAttr] = useState<any>(null)
  const [kermissen, setKermissen] = useState<Kermis[]>([])
  const [code, setCode] = useState<string | null>(null)
  const [saldo, setSaldo] = useState<number | null>(null)
  const [toonQr, setToonQr] = useState(false)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.from('attractie_publiek').select('id, naam, soort').eq('id', id).maybeSingle()
      setAttr(a)

      const { data: ka } = await supabase.from('kermis_attractie').select('kermis_id').eq('attractie_id', id)
      const ids = (ka ?? []).map((r: any) => r.kermis_id)
      if (ids.length) {
        const todayISO = new Date().toISOString().slice(0, 10)
        const { data: kerm } = await supabase.from('kermis').select('id, naam, plaats, van, tot')
          .in('id', ids).gte('tot', todayISO).order('van')
        setKermissen((kerm ?? []) as Kermis[])
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: bez } = await supabase.from('bezoeker').select('code')
          .eq('auth_user_id', session.user.id).maybeSingle()
        if (bez?.code) {
          setCode(bez.code)
          const { data: sal } = await supabase.from('saldo').select('saldo').eq('attractie_id', id)
          setSaldo((sal ?? []).reduce((t: number, r: any) => t + (r.saldo ?? 0), 0))
        }
      }
      setLaden(false)
    })()
  }, [id])

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.coral} size="large" /></View>
  if (!attr) return (
    <View style={[s.scherm, s.center, { padding: 28 }]}>
      <Text style={s.sub}>Dit kraam bestaat niet meer.</Text>
      <Pressable onPress={() => router.push('/bezoeker')} style={{ marginTop: 14 }}><Text style={s.terug}>Terug</Text></Pressable>
    </View>
  )

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={wrapC}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>

        <View style={s.hero}>
          <Text style={s.heroEmoji}>{EMOJI[attr.soort] ?? '🎪'}</Text>
          <Text style={s.heroTitel}>{attr.naam}</Text>
          <Text style={s.heroSub}>{attr.soort}</Text>
        </View>

        {code !== null ? (
          <View style={s.saldoKaart}>
            <View style={{ flex: 1 }}>
              <Text style={s.saldoLbl}>Jouw saldo hier</Text>
              <Text style={s.saldoNum}>{saldo ?? 0} <Text style={s.saldoPt}>punten</Text></Text>
            </View>
            <Pressable style={s.qrKnop} onPress={() => setToonQr((v) => !v)}>
              <Text style={s.qrKnopT}>{toonQr ? 'Verberg QR' : 'Toon QR'}</Text>
            </Pressable>
          </View>
        ) : null}

        {toonQr && code ? (
          <View style={s.qrVak}>
            <View style={s.qrWit}><QRCode value={`FP-B:${code}`} size={180} backgroundColor="#FFFFFF" color="#241B3A" /></View>
            <Text style={s.qrHint}>Dit is je persoonlijke punten-QR. Toon hem aan elk kraam — je punten gaan altijd naar het juiste kraam.</Text>
          </View>
        ) : null}

        <Text style={s.sectie}>Binnenkort te vinden op</Text>
        {kermissen.length === 0
          ? <View style={s.leeg}><Text style={s.sub}>Nog geen aankomende locaties bekend.</Text></View>
          : <View style={{ gap: 10 }}>
              {kermissen.map((k) => (
                <Pressable key={k.id} style={s.rij} onPress={() => router.push(`/kermis/${k.id}`)}>
                  <View style={s.rijIcon}><Text style={{ fontSize: 22 }}>🎪</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rijNaam}>{k.naam}</Text>
                    <Text style={s.rijSub}>{k.plaats} · {kort(k.van)} – {kort(k.tot)}</Text>
                  </View>
                  <Text style={s.chevron}>›</Text>
                </Pressable>
              ))}
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
  heroEmoji: { fontSize: 44 },
  heroTitel: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 14.5, fontWeight: '600', marginTop: 4 },
  saldoKaart: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18,
    marginTop: 16, flexDirection: 'row', alignItems: 'center',
  },
  saldoLbl: { color: C.muted, fontSize: 13, fontWeight: '700' },
  saldoNum: { color: C.green, fontSize: 30, fontWeight: '900', marginTop: 2 },
  saldoPt: { color: C.muted, fontSize: 14, fontWeight: '700' },
  qrKnop: { backgroundColor: C.coral, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  qrKnopT: { color: '#fff', fontWeight: '800', fontSize: 14 },
  qrVak: { alignItems: 'center', backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 12 },
  qrWit: { backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line },
  qrHint: { color: C.muted, fontSize: 12.5, marginTop: 12, textAlign: 'center' },
  sectie: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 26, marginBottom: 12 },
  leeg: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 18 },
  rij: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  rijIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(251,113,133,0.14)', alignItems: 'center', justifyContent: 'center' },
  rijNaam: { color: C.ink, fontSize: 16, fontWeight: '800' },
  rijSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  chevron: { color: C.coral, fontSize: 26, fontWeight: '700' },
})

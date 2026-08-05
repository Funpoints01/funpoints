import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', ink: '#241B3A', muted: '#7A7290',
  coral: '#FB7185', violet: '#8B5CF6', green: '#10B981', line: 'rgba(36,27,58,0.10)',
}
const ICOON: Record<string, string> = {
  vriend_verzoek: '👋', vriend_aanvaard: '🤝', actie: '🎟️', kermis: '🎡',
}
function geleden(iso: string): string {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'net'
  if (sec < 3600) return `${Math.floor(sec / 60)} min`
  if (sec < 86400) return `${Math.floor(sec / 3600)} u`
  return `${Math.floor(sec / 86400)} d`
}

export default function Inbox() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  const [meldingen, setMeldingen] = useState<any[]>([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('melding')
        .select('id, type, tekst, gelezen, created_at')
        .order('created_at', { ascending: false }).limit(60)
      setMeldingen(data ?? [])
      setLaden(false)
      await supabase.rpc('markeer_meldingen_gelezen')
    })()
  }, [])

  async function wis(id: string) {
    setMeldingen((prev) => prev.filter((m) => m.id !== id))
    await supabase.from('melding').delete().eq('id', id)
  }
  async function wisAlles() {
    setMeldingen([])
    await supabase.from('melding').delete().not('id', 'is', null)
  }

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={wrapC}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/bezoeker'))} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>
        <View style={s.kop}>
          <Text style={s.paginaTitel}>🔔 Meldingen</Text>
          {meldingen.length > 0 ? <Pressable onPress={wisAlles} hitSlop={8}><Text style={s.wisAlles}>Alles wissen</Text></Pressable> : null}
        </View>

        {laden ? (
          <View style={{ paddingVertical: 40 }}><ActivityIndicator color={C.coral} size="large" /></View>
        ) : meldingen.length === 0 ? (
          <View style={s.leeg}>
            <Text style={s.leegIcon}>🔔</Text>
            <Text style={s.leegT}>Nog geen meldingen</Text>
            <Text style={s.leegSub}>Vriendschapsverzoeken en nieuwtjes verschijnen hier.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {meldingen.map((m) => (
              <View key={m.id} style={[s.rij, !m.gelezen && s.rijNieuw]}>
                <View style={s.icoon}><Text style={{ fontSize: 20 }}>{ICOON[m.type] ?? '🔔'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.tekst}>{m.tekst}</Text>
                  <Text style={s.tijd}>{geleden(m.created_at)} geleden</Text>
                </View>
                {!m.gelezen ? <View style={s.stip} /> : null}
                <Pressable onPress={() => wis(m.id)} hitSlop={8} style={s.wisKnop}><Text style={s.wisKnopT}>✕</Text></Pressable>
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
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 18 },
  kop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  paginaTitel: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  wisAlles: { color: C.violet, fontSize: 13.5, fontWeight: '800' },
  wisKnop: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  wisKnopT: { color: C.muted, fontSize: 15, fontWeight: '900' },
  leeg: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 26, alignItems: 'center', marginTop: 8 },
  leegIcon: { fontSize: 40 },
  leegT: { color: C.ink, fontSize: 17, fontWeight: '900', marginTop: 10 },
  leegSub: { color: C.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  rij: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14 },
  rijNieuw: { backgroundColor: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.25)' },
  icoon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  tekst: { color: C.ink, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  tijd: { color: C.muted, fontSize: 12, marginTop: 3 },
  stip: { width: 9, height: 9, borderRadius: 999, backgroundColor: C.violet },
})

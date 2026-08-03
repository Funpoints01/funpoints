import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

const C = {
  bg: '#FFF8F0', ink: '#241B3A', muted: '#7A7290',
  violet: '#8B5CF6', card: '#FFFFFF', line: 'rgba(36,27,58,0.10)',
}

export default function Uitbater() {
  const router = useRouter()
  return (
    <View style={s.scherm}>
      <View style={[s.blob, { backgroundColor: C.violet, top: -60, right: -50 }]} />
      <Text style={[s.deco, { top: 60, left: 20 }]}>🎡</Text>
      <Text style={[s.deco, { bottom: 60, right: 24 }]}>🎠</Text>

      <View style={s.wrap}>
        <Pressable onPress={() => router.push('/')} hitSlop={12}>
          <Text style={s.terug}>‹ Terug</Text>
        </Pressable>

        <View style={s.kaart}>
          <View style={[s.badge, { backgroundColor: C.violet }]}><Text style={s.badgeE}>📊</Text></View>
          <Text style={s.titel}>Uitbater</Text>
          <Text style={s.sub}>Hier beheer je straks je attracties, je logins en je cijfers.</Text>
          <View style={s.pill}><Text style={s.pillT}>Binnenkort beschikbaar</Text></View>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { flex: 1, padding: 24, paddingTop: 60, maxWidth: 460, width: '100%', alignSelf: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 30 },
  kaart: {
    backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  badge: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  badgeE: { fontSize: 34 },
  titel: { color: C.ink, fontSize: 26, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 10 },
  pill: { marginTop: 20, backgroundColor: 'rgba(139,92,246,0.12)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  pillT: { color: C.violet, fontWeight: '700', fontSize: 13.5 },
  blob: { position: 'absolute', width: 240, height: 240, borderRadius: 120, opacity: 0.16 },
  deco: { position: 'absolute', fontSize: 52, opacity: 0.10 },
})

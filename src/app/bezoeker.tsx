import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

const C = {
  bg: '#FFF8F0', ink: '#241B3A', muted: '#7A7290',
  coral: '#FB7185', card: '#FFFFFF', line: 'rgba(36,27,58,0.10)',
}

export default function Bezoeker() {
  const router = useRouter()
  return (
    <View style={s.scherm}>
      <View style={[s.blob, { backgroundColor: C.coral, top: -60, right: -50 }]} />
      <Text style={[s.deco, { top: 60, left: 20 }]}>🎟️</Text>
      <Text style={[s.deco, { bottom: 60, right: 24 }]}>🎢</Text>

      <View style={s.wrap}>
        <Pressable onPress={() => router.push('/')} hitSlop={12}>
          <Text style={s.terug}>‹ Terug</Text>
        </Pressable>

        <View style={s.kaart}>
          <View style={[s.badge, { backgroundColor: C.coral }]}><Text style={s.badgeE}>🎟️</Text></View>
          <Text style={s.titel}>Bezoeker</Text>
          <Text style={s.sub}>Straks spaar je hier je punten en bekijk je je saldo per attractie.</Text>
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
  pill: { marginTop: 20, backgroundColor: 'rgba(251,113,133,0.14)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  pillT: { color: C.coral, fontWeight: '700', fontSize: 13.5 },
  blob: { position: 'absolute', width: 240, height: 240, borderRadius: 120, opacity: 0.16 },
  deco: { position: 'absolute', fontSize: 52, opacity: 0.10 },
})

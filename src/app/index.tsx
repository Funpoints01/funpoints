import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

const C = {
  bg: '#FFF8F0', ink: '#241B3A', muted: '#7A7290',
  green: '#10B981', violet: '#8B5CF6', coral: '#FB7185', amber: '#F59E0B', sky: '#38BDF8',
  card: '#FFFFFF', line: 'rgba(36,27,58,0.08)',
}

const ROLLEN = [
  { key: 'foorkramer', href: '/foorkramer', emoji: '🎯', kleur: C.green,
    titel: 'Foorkramer', sub: 'Scan kaartjes en boek punten aan de kraam.', klaar: true },
  { key: 'uitbater', href: '/uitbater', emoji: '📊', kleur: C.violet,
    titel: 'Uitbater', sub: 'Beheer je attracties en bekijk je cijfers.', klaar: false },
  { key: 'bezoeker', href: '/bezoeker', emoji: '🎟️', kleur: C.coral,
    titel: 'Bezoeker', sub: 'Spaar punten en bekijk je saldo.', klaar: true },
] as const

export default function Landing() {
  const router = useRouter()
  return (
    <View style={s.scherm}>
      <View style={[s.blob, { backgroundColor: C.amber, top: -70, right: -50 }]} />
      <View style={[s.blob, { backgroundColor: C.sky, top: 140, left: -80 }]} />
      <View style={[s.blob, { backgroundColor: C.coral, bottom: -60, right: -40 }]} />
      <Text style={[s.deco, { top: 44, left: 22, fontSize: 58 }]}>🎡</Text>
      <Text style={[s.deco, { top: 150, right: 16, fontSize: 46 }]}>🎠</Text>
      <Text style={[s.deco, { bottom: 120, left: 8, fontSize: 54 }]}>🎪</Text>
      <Text style={[s.deco, { bottom: 36, right: 30, fontSize: 44 }]}>🎢</Text>

      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.logo}>
          <View style={s.mark}><Text style={s.markT}>F</Text></View>
          <Text style={s.logoT}>Funpoints</Text>
        </View>

        <Text style={s.titel}>Welkom op de kermis! 🎉</Text>
        <Text style={s.sub}>Digitale spaarpunten voor foor en attractie. Kies hieronder wie je bent.</Text>

        <View style={s.kaarten}>
          {ROLLEN.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => router.push(r.href)}
              style={({ pressed }) => [s.kaart, pressed && s.kaartActief]}
            >
              <View style={[s.badge, { backgroundColor: r.kleur }]}>
                <Text style={s.badgeE}>{r.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.kaartTop}>
                  <Text style={s.kaartTitel}>{r.titel}</Text>
                  {!r.klaar ? <Text style={s.binnenkort}>binnenkort</Text> : null}
                </View>
                <Text style={s.kaartSub}>{r.sub}</Text>
              </View>
              <Text style={[s.chevron, { color: r.kleur }]}>›</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.voet}>Funpoints · fase 1 · concept</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  wrap: { padding: 24, paddingTop: 70, paddingBottom: 40, maxWidth: 480, width: '100%', alignSelf: 'center', flexGrow: 1 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 30 },
  mark: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  markT: { color: '#fff', fontWeight: '900', fontSize: 22 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 21 },
  titel: { color: C.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  sub: { color: C.muted, fontSize: 15.5, lineHeight: 23, marginTop: 10, maxWidth: 380 },
  kaarten: { marginTop: 30, gap: 14 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 15,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  kaartActief: { transform: [{ scale: 0.98 }], borderColor: 'rgba(36,27,58,0.16)' },
  badge: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeE: { fontSize: 28 },
  kaartTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  kaartTitel: { color: C.ink, fontSize: 18.5, fontWeight: '800' },
  binnenkort: {
    color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
    backgroundColor: 'rgba(36,27,58,0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  kaartSub: { color: C.muted, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  chevron: { fontSize: 30, fontWeight: '700', marginRight: 4 },
  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 34, opacity: 0.7 },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.15 },
  deco: { position: 'absolute', opacity: 0.10 },
})
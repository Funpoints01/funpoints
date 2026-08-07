import { Redirect, useRouter } from 'expo-router'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

const C = {
  bg: '#FFF8F0', ink: '#241B3A', muted: '#7A7290',
  green: '#10B981', greenD: '#059669', violet: '#8B5CF6', coral: '#FB7185', coralD: '#E11D63',
  amber: '#F59E0B', sky: '#38BDF8', card: '#FFFFFF', line: 'rgba(36,27,58,0.10)',
  veld: '#F4F1FA',
}

function Prop({ icon, tekst }: { icon: string; tekst: string }) {
  return (
    <View style={s.propRij}>
      <Text style={s.propIcon}>{icon}</Text>
      <Text style={s.propT}>{tekst}</Text>
    </View>
  )
}

export default function Landing() {
  const router = useRouter()

  // In de native app (App Store / Play) tonen we enkel de bezoekerskant.
  if (Platform.OS !== 'web') {
    return <Redirect href="/bezoeker" />
  }

  return (
    <View style={s.scherm}>
      <View style={[s.blob, { backgroundColor: C.amber, top: -70, right: -50 }]} />
      <View style={[s.blob, { backgroundColor: C.sky, top: 200, left: -90 }]} />
      <View style={[s.blob, { backgroundColor: C.coral, bottom: -70, right: -40 }]} />

      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.logo}>
          <View style={s.mark}><Text style={s.markT}>F</Text></View>
          <Text style={s.logoT}>Funpoints</Text>
        </View>

        <Text style={s.titel}>Spaar punten{'\n'}op de kermis 🎡</Text>
        <Text style={s.sub}>
          Verzamel punten bij elk kraam, volg de kermissen in je buurt en spaar naar prijzen. Helemaal gratis.
        </Text>

        <View style={s.props}>
          <Prop icon="🎟️" tekst="Spaar punten bij elk kraam dat je bezoekt" />
          <Prop icon="🎡" tekst="Volg de kermissen bij jou in de buurt" />
          <Prop icon="🎁" tekst="Spaar naar de hoofdprijs van je favoriete kraam" />
        </View>

        <Pressable onPress={() => router.push('/registreer')} style={({ pressed }) => [s.knopPrimair, pressed && s.pressed]}>
          <Text style={s.knopPrimairT}>Maak een gratis account</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/bezoeker')} style={({ pressed }) => [s.knopSecundair, pressed && s.pressed]}>
          <Text style={s.knopSecundairT}>Ik heb al een account · Aanmelden</Text>
        </Pressable>

        <View style={s.divider} />

        <Text style={s.teamKop}>Werk je op de foor?</Text>
        <View style={s.teamRij}>
          <Pressable onPress={() => router.push('/uitbater')} style={({ pressed }) => [s.teamLink, pressed && s.teamLinkAan]}>
            <Text style={s.teamLinkT}>📊 Uitbater</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/foorkramer')} style={({ pressed }) => [s.teamLink, pressed && s.teamLinkAan]}>
            <Text style={s.teamLinkT}>🎯 Foorkramer</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/beheer')} style={({ pressed }) => [s.teamLink, pressed && s.teamLinkAan]}>
            <Text style={s.teamLinkT}>⚙️ Management</Text>
          </Pressable>
        </View>

        <Text style={s.voet}>Funpoints · voor de foor</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  wrap: { padding: 24, paddingTop: 64, paddingBottom: 48, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 30 },
  mark: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  markT: { color: '#fff', fontWeight: '900', fontSize: 22 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 21 },

  titel: { color: C.ink, fontSize: 34, fontWeight: '900', letterSpacing: -0.6, lineHeight: 38 },
  sub: { color: C.muted, fontSize: 16, lineHeight: 24, marginTop: 12, maxWidth: 400 },

  props: { marginTop: 22, marginBottom: 26, gap: 12 },
  propRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  propIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  propT: { color: C.ink, fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 20 },

  knopPrimair: {
    backgroundColor: C.green, borderRadius: 15, paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  knopPrimairT: { color: '#fff', fontWeight: '800', fontSize: 17 },
  knopSecundair: {
    backgroundColor: C.card, borderRadius: 15, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.line, marginTop: 12,
  },
  knopSecundairT: { color: C.ink, fontWeight: '700', fontSize: 15 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },

  divider: { height: 1, backgroundColor: C.line, marginTop: 34, marginBottom: 18 },
  teamKop: { color: C.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  teamRij: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9 },
  teamLink: {
    backgroundColor: C.veld, borderRadius: 999, borderWidth: 1, borderColor: C.line,
    paddingVertical: 9, paddingHorizontal: 15,
  },
  teamLinkAan: { backgroundColor: '#EDE9F7' },
  teamLinkT: { color: C.muted, fontSize: 13, fontWeight: '700' },

  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 30, opacity: 0.7 },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.14 },
})

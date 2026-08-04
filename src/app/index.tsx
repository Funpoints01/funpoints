import { Redirect, useRouter } from 'expo-router'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'

const C = {
  bg: '#FFF8F0', ink: '#241B3A', muted: '#7A7290',
  green: '#10B981', violet: '#8B5CF6', coral: '#FB7185', coralD: '#E11D63',
  amber: '#F59E0B', sky: '#38BDF8', card: '#FFFFFF', line: 'rgba(36,27,58,0.10)',
  veld: '#F4F1FA',
}

const isWeb = Platform.OS === 'web'
const isMobielWeb =
  isWeb && typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const foorkramerUrl =
  isWeb && typeof window !== 'undefined' ? `${window.location.origin}/foorkramer` : 'https://app.funpoints.be/foorkramer'

export default function Landing() {
  const router = useRouter()

  // In de native app (App Store / Play) tonen we enkel de bezoekerskant.
  if (Platform.OS !== 'web') {
    return <Redirect href="/bezoeker" />
  }

  return (
    <View style={s.scherm}>
      <View style={[s.blob, { backgroundColor: C.amber, top: -70, right: -50 }]} />
      <View style={[s.blob, { backgroundColor: C.sky, top: 160, left: -80 }]} />
      <View style={[s.blob, { backgroundColor: C.coral, bottom: -60, right: -40 }]} />

      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.logo}>
          <View style={s.mark}><Text style={s.markT}>F</Text></View>
          <Text style={s.logoT}>Funpoints</Text>
        </View>

        <Text style={s.titel}>Welkom bij Funpoints 🎉</Text>
        <Text style={s.sub}>Log in op je dashboard, of open de scanner op je telefoon.</Text>

        {/* Uitbater — hoofdactie */}
        <Pressable onPress={() => router.push('/uitbater')} style={({ pressed }) => [s.kaart, pressed && s.kaartActief]}>
          <View style={[s.badge, { backgroundColor: C.violet }]}><Text style={s.badgeE}>📊</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.kaartTitel}>Inloggen als uitbater</Text>
            <Text style={s.kaartSub}>Beheer je kramen, acties en cijfers.</Text>
          </View>
          <Text style={[s.chevron, { color: C.violet }]}>›</Text>
        </Pressable>

        {/* Foorkramer — via telefoon (PWA) */}
        <View style={s.foorVak}>
          <View style={s.foorKop}>
            <View style={[s.badge, s.badgeSm, { backgroundColor: C.green }]}><Text style={s.badgeESm}>🎯</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.foorTitel}>Ben je foorkramer?</Text>
              <Text style={s.foorSub}>Scannen doe je op je telefoon. Zet Funpoints op je beginscherm.</Text>
            </View>
          </View>

          {isMobielWeb ? (
            <>
              <View style={s.tips}>
                <Text style={s.tipsT}>📱 <Text style={{ fontWeight: '800' }}>iPhone:</Text> deelknop → “Zet op beginscherm”.</Text>
                <Text style={s.tipsT}>🤖 <Text style={{ fontWeight: '800' }}>Android:</Text> menu (⋮) → “App installeren”.</Text>
              </View>
              <Pressable onPress={() => router.push('/foorkramer')} style={[s.knop, s.knopGroen]}>
                <Text style={s.knopGroenT}>Open de scanner</Text>
              </Pressable>
            </>
          ) : (
            <View style={s.qrRij}>
              <View style={s.qrWit}>
                <QRCode value={foorkramerUrl} size={132} backgroundColor="#FFFFFF" color="#241B3A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.qrUitleg}>Scan deze code met je telefoon om de scanner te openen. Zet 'm daarna op je beginscherm om snel te scannen aan de kraam.</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bezoeker — via app of registratie */}
        <Pressable onPress={() => router.push('/registreer')} style={s.bezLink}>
          <Text style={s.bezLinkT}>🎟️ Bezoeker? Maak hier een account →</Text>
        </Pressable>

        <Text style={s.voet}>Funpoints · voor de foor</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  wrap: { padding: 24, paddingTop: 64, paddingBottom: 40, maxWidth: 480, width: '100%', alignSelf: 'center', flexGrow: 1 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 28 },
  mark: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  markT: { color: '#fff', fontWeight: '900', fontSize: 22 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 21 },
  titel: { color: C.ink, fontSize: 29, fontWeight: '900', letterSpacing: -0.5 },
  sub: { color: C.muted, fontSize: 15.5, lineHeight: 23, marginTop: 10, marginBottom: 8, maxWidth: 380 },

  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  kaartActief: { transform: [{ scale: 0.98 }], borderColor: 'rgba(36,27,58,0.16)' },
  badge: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeE: { fontSize: 28 },
  badgeSm: { width: 44, height: 44, borderRadius: 13 },
  badgeESm: { fontSize: 22 },
  kaartTitel: { color: C.ink, fontSize: 18.5, fontWeight: '800' },
  kaartSub: { color: C.muted, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  chevron: { fontSize: 30, fontWeight: '700', marginRight: 4 },

  foorVak: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line,
    padding: 18, marginTop: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  foorKop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  foorTitel: { color: C.ink, fontSize: 16.5, fontWeight: '800' },
  foorSub: { color: C.muted, fontSize: 13.5, marginTop: 3, lineHeight: 19 },
  qrRij: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  qrWit: { backgroundColor: '#fff', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: C.line },
  qrUitleg: { color: C.muted, fontSize: 13.5, lineHeight: 20 },
  tips: { backgroundColor: C.veld, borderRadius: 12, padding: 14, marginTop: 14, gap: 6 },
  tipsT: { color: C.ink, fontSize: 13.5, lineHeight: 20 },
  knop: { borderRadius: 13, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  knopGroen: { backgroundColor: C.green },
  knopGroenT: { color: '#fff', fontWeight: '800', fontSize: 15.5 },

  bezLink: { marginTop: 20, alignItems: 'center', paddingVertical: 10 },
  bezLinkT: { color: C.coralD, fontSize: 14.5, fontWeight: '700' },

  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 26, opacity: 0.7 },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.14 },
})

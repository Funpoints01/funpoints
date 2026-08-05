import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const C = { card: '#FFFFFF', muted: '#7A7290', coral: '#FB7185', coralD: '#E11D63', line: 'rgba(36,27,58,0.10)' }

const TABS = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'kermissen', icon: '📅', label: 'Kermissen' },
  { key: 'qr', icon: '🎟️', label: 'QR' },
  { key: 'saldo', icon: '⭐', label: 'Saldo' },
  { key: 'social', icon: '👥', label: 'Vrienden' },
] as const

export function BottomNav({ active, onSelect }: { active?: string; onSelect?: (key: string) => void }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const kies = (key: string) => {
    if (onSelect) onSelect(key)
    else router.navigate({ pathname: '/bezoeker', params: { tab: key } })
  }
  return (
    <View style={[s.tabBar, { paddingBottom: Platform.OS === 'web' ? 24 : Math.max(insets.bottom, 12) }]}>
      {TABS.map((t) => t.key === 'qr' ? (
        <Pressable key={t.key} style={s.tabMidWrap} onPress={() => kies('qr')}>
          <View style={[s.tabMid, active === 'qr' && s.tabMidAan]}>
            <Text style={s.tabMidIcon}>🎟️</Text>
          </View>
          <Text style={[s.tabLabel, active === 'qr' && s.tabLabelAan]}>QR</Text>
        </Pressable>
      ) : (
        <Pressable key={t.key} style={s.tabItem} onPress={() => kies(t.key)}>
          <Text style={[s.tabIcon, active === t.key && s.tabIconAan]}>{t.icon}</Text>
          <Text numberOfLines={1} style={[s.tabLabel, active === t.key && s.tabLabelAan]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line,
    paddingTop: 9, paddingBottom: 24, paddingHorizontal: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 3 },
  tabIcon: { fontSize: 22, opacity: 0.45 },
  tabIconAan: { opacity: 1 },
  tabLabel: { color: C.muted, fontSize: 11, fontWeight: '700' },
  tabLabelAan: { color: C.coralD },
  tabMidWrap: { flex: 1, alignItems: 'center', gap: 3 },
  tabMid: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.coral,
    alignItems: 'center', justifyContent: 'center', marginTop: -26,
    borderWidth: 4, borderColor: C.card,
    shadowColor: C.coral, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  tabMidAan: { backgroundColor: C.coralD },
  tabMidIcon: { fontSize: 26 },
})

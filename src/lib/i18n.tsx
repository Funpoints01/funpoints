import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FR, EN } from './vertalingen'

export type Taal = 'nl' | 'fr' | 'en'
const DICTS: Record<Taal, Record<string, string>> = { nl: {}, fr: FR, en: EN }
const OPSLAG = 'fp_taal'

function detecteer(): Taal {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const l = (navigator.language || (navigator as any).userLanguage || '').toLowerCase()
      if (l.startsWith('fr')) return 'fr'
      if (l.startsWith('en')) return 'en'
      if (l.startsWith('nl')) return 'nl'
    }
  } catch {}
  return 'nl'
}

type Vars = Record<string, string | number>
type Ctx = { taal: Taal; setTaal: (t: Taal) => void; t: (nl: string, vars?: Vars) => string }
const TaalContext = createContext<Ctx>({ taal: 'nl', setTaal: () => {}, t: (s) => s })

export function TaalProvider({ children }: { children: ReactNode }) {
  const [taal, setTaalState] = useState<Taal>('nl')

  useEffect(() => {
    (async () => {
      try {
        const opgeslagen = await AsyncStorage.getItem(OPSLAG)
        if (opgeslagen === 'nl' || opgeslagen === 'fr' || opgeslagen === 'en') setTaalState(opgeslagen)
        else setTaalState(detecteer())
      } catch { setTaalState(detecteer()) }
    })()
  }, [])

  const setTaal = (l: Taal) => { setTaalState(l); AsyncStorage.setItem(OPSLAG, l).catch(() => {}) }

  const t = (nl: string, vars?: Vars) => {
    let s = taal === 'nl' ? nl : (DICTS[taal][nl] ?? nl)
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]))
    return s
  }

  return <TaalContext.Provider value={{ taal, setTaal, t }}>{children}</TaalContext.Provider>
}

export function useT() { return useContext(TaalContext) }

export function TaalKiezer({ style }: { style?: any }) {
  const { taal, setTaal } = useT()
  const talen: Taal[] = ['nl', 'fr', 'en']
  return (
    <View style={[s.rij, style]}>
      {talen.map((l) => (
        <Pressable key={l} onPress={() => setTaal(l)} style={[s.knop, taal === l && s.knopAan]} hitSlop={6}>
          <Text style={[s.knopT, taal === l && s.knopTAan]}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  rij: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
  knop: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(36,27,58,0.05)', borderWidth: 1, borderColor: 'rgba(36,27,58,0.10)',
  },
  knopAan: { backgroundColor: '#241B3A', borderColor: '#241B3A' },
  knopT: { color: '#7A7290', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 },
  knopTAan: { color: '#fff' },
})

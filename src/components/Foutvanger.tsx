import { Component, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { supabase } from '../lib/supabase'

type Props = { children: ReactNode }
type State = { fout: boolean }

// Vangt onverwachte fouten op zodat de app nooit vastloopt in een
// crash-lus. De herstelknop wist de sessie (lokaal opgeslagen), zodat
// een volgende keer opnieuw inloggen sowieso werkt.
export class Foutvanger extends Component<Props, State> {
  state: State = { fout: false }
  static getDerivedStateFromError(): State { return { fout: true } }
  componentDidCatch(err: unknown) { try { console.error('Funpoints fout:', err) } catch {} }

  async herstel() {
    try { await supabase.auth.signOut() } catch {}
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      window.location.href = '/'
    } else {
      this.setState({ fout: false })
    }
  }

  render() {
    if (!this.state.fout) return this.props.children
    return (
      <View style={s.wrap}>
        <Text style={s.emoji}>🎡</Text>
        <Text style={s.titel}>Er ging even iets mis</Text>
        <Text style={s.tekst}>
          Geen zorgen — je punten zijn veilig. Begin opnieuw en log terug in. Blijft het gebeuren, laat het ons weten via accounts@funpoints.be.
        </Text>
        <Pressable style={s.knop} onPress={() => this.herstel()}>
          <Text style={s.knopT}>Opnieuw beginnen</Text>
        </Pressable>
      </View>
    )
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFF8F0', alignItems: 'center', justifyContent: 'center', padding: 30 },
  emoji: { fontSize: 46, marginBottom: 12 },
  titel: { fontSize: 21, fontWeight: '900', color: '#241B3A', marginBottom: 8 },
  tekst: { fontSize: 14, color: '#6D6484', textAlign: 'center', lineHeight: 21, marginBottom: 22, maxWidth: 320 },
  knop: { backgroundColor: '#FB7185', borderRadius: 13, paddingVertical: 14, paddingHorizontal: 28 },
  knopT: { color: '#fff', fontWeight: '800', fontSize: 15 },
})

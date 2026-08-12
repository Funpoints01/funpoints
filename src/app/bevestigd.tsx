import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', line: 'rgba(36,27,58,0.10)',
}

// Landingspagina van de e-mailbevestiging (emailRedirectTo).
// Op het moment dat de bezoeker hier is, heeft Supabase de mail al
// geverifieerd. Op web staat de sessie in de URL-fragment; die lezen
// we één keer uit zodat de bezoeker meteen ingelogd is.
export default function Bevestigd() {
  const router = useRouter()
  const { t } = useT()
  const [ingelogd, setIngelogd] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const hash = window.location.hash && window.location.hash.startsWith('#')
      ? window.location.hash.slice(1) : ''
    if (!hash) return
    const p = new URLSearchParams(hash)
    const access_token = p.get('access_token')
    const refresh_token = p.get('refresh_token')
    if (!access_token || !refresh_token) return
    supabase.auth.setSession({ access_token, refresh_token })
      .then(({ error }) => { if (!error) setIngelogd(true) })
      .finally(() => {
        try { window.history.replaceState(null, '', window.location.pathname) } catch {}
      })
  }, [])

  return (
    <View style={s.scherm}>
      <View style={s.kaart}>
        <Text style={{ fontSize: 52, marginBottom: 8 }}>✅</Text>
        <Text style={s.titel}>{t('Je e-mail is bevestigd!')}</Text>
        <Text style={s.sub}>
          {ingelogd
            ? t('Je account is actief. Welkom bij Funpoints!')
            : t('Je account is actief. Open de Funpoints-app en log in met je e-mail en wachtwoord.')}
        </Text>
        <Pressable onPress={() => router.replace('/bezoeker')} style={[s.knop, s.knopCoral]}>
          <Text style={s.knopCoralT}>{ingelogd ? t('Naar Funpoints') : t('Naar inloggen')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line,
    padding: 24, maxWidth: 420, width: '100%', alignItems: 'center',
  },
  titel: { color: C.ink, fontSize: 25, fontWeight: '900', marginTop: 8, textAlign: 'center', letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 15, marginTop: 10, lineHeight: 22, textAlign: 'center' },
  knop: { borderRadius: 13, paddingVertical: 15, paddingHorizontal: 28, alignItems: 'center', marginTop: 22, alignSelf: 'stretch' },
  knopCoral: { backgroundColor: C.coral },
  knopCoralT: { color: '#fff', fontWeight: '800', fontSize: 16 },
})

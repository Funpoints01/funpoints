import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}

// Landingspagina van de "wachtwoord vergeten"-mail (redirectTo).
// Supabase zet de hersteltoken in de URL-fragment; die lezen we uit
// en zetten we als sessie, waarna de bezoeker een nieuw wachtwoord kiest.
export default function Herstel() {
  const router = useRouter()
  const { t } = useT()
  const [klaar, setKlaar] = useState(Platform.OS !== 'web')
  const [ww, setWw] = useState('')
  const [ww2, setWw2] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [gelukt, setGelukt] = useState(false)
  const [bestemming, setBestemming] = useState<'/bezoeker' | '/foorkramer' | '/uitbater'>('/bezoeker')

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const hash = window.location.hash && window.location.hash.startsWith('#')
      ? window.location.hash.slice(1) : ''
    const p = new URLSearchParams(hash)
    const access_token = p.get('access_token')
    const refresh_token = p.get('refresh_token')
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token })
        .then(({ error }) => { if (error) setFout(t('Deze herstellink is verlopen. Vraag een nieuwe aan.')) })
        .finally(() => {
          setKlaar(true)
          try { window.history.replaceState(null, '', window.location.pathname) } catch {}
        })
    } else {
      setKlaar(true)
    }
  }, [])

  async function bewaar() {
    setFout('')
    if (ww.length < 6) return setFout(t('Kies een wachtwoord van minstens 6 tekens.'))
    if (ww !== ww2) return setFout(t('De twee wachtwoorden komen niet overeen.'))
    setBezig(true)
    const { error } = await supabase.auth.updateUser({ password: ww })
    if (error) { setBezig(false); return setFout(t('Kon je wachtwoord niet opslaan. Vraag een nieuwe herstelmail aan.')) }
    // Rol bepalen om naar het juiste scherm te sturen.
    try {
      const { data: rol } = await supabase.rpc('mijn_rol')
      if (rol === 'foorkramer') { await supabase.rpc('foorkramer_activeer'); setBestemming('/foorkramer') }
      else if (rol === 'uitbater') setBestemming('/uitbater')
    } catch { /* val terug op bezoeker */ }
    setBezig(false)
    setGelukt(true)
  }

  if (gelukt) {
    return (
      <View style={[s.scherm, s.midden]}>
        <View style={s.kaart}>
          <Text style={{ fontSize: 52, marginBottom: 8 }}>✅</Text>
          <Text style={s.titel}>{t('Je wachtwoord is aangepast')}</Text>
          <Text style={s.sub}>{
            bestemming === '/foorkramer' ? t('Je foorkramer-account is klaar. Log in om punten te scannen.')
            : bestemming === '/uitbater' ? t('Je uitbater-account is klaar. Log in om je kramen te beheren.')
            : t('Je kan nu inloggen met je nieuwe wachtwoord.')}</Text>
          <Pressable onPress={() => router.replace(bestemming)} style={[s.knop, s.knopCoral]}>
            <Text style={s.knopCoralT}>{t('Naar inloggen')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.kaart}>
          <Text style={{ fontSize: 44, marginBottom: 4 }}>🔒</Text>
          <Text style={s.titel}>{t('Nieuw wachtwoord')}</Text>
          <Text style={s.sub}>{t('Kies een nieuw wachtwoord voor je Funpoints-account.')}</Text>
          {!klaar ? (
            <ActivityIndicator color={C.coral} style={{ marginTop: 22 }} />
          ) : (
            <>
              <Text style={[s.label, { marginTop: 16 }]}>{t('Nieuw wachtwoord')}</Text>
              <TextInput style={s.input} value={ww} onChangeText={setWw} secureTextEntry
                placeholder={t('minstens 6 tekens')} placeholderTextColor={C.muted} />
              <Text style={[s.label, { marginTop: 14 }]}>{t('Herhaal wachtwoord')}</Text>
              <TextInput style={s.input} value={ww2} onChangeText={setWw2} secureTextEntry
                placeholder="••••••••" placeholderTextColor={C.muted} />
              {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
              <Pressable onPress={bewaar} disabled={bezig} style={[s.knop, s.knopCoral, bezig && s.knopUit]}>
                {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopCoralT}>{t('Wachtwoord opslaan')}</Text>}
              </Pressable>
              <Pressable onPress={() => router.replace('/bezoeker')} hitSlop={8} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={s.link}>{t('Terug naar inloggen')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  midden: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  wrap: { padding: 24, paddingTop: 80, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line,
    padding: 22, alignItems: 'center', maxWidth: 440, width: '100%', alignSelf: 'center',
  },
  titel: { color: C.ink, fontSize: 25, fontWeight: '900', marginTop: 6, textAlign: 'center', letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 8, lineHeight: 21, textAlign: 'center' },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7, alignSelf: 'stretch' },
  input: {
    backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignSelf: 'stretch',
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20, alignSelf: 'stretch' },
  knopCoral: { backgroundColor: C.coral },
  knopCoralT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16, alignSelf: 'stretch' },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  link: { color: C.muted, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
})

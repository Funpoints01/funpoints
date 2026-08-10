import { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { DatumVeld } from '../components/DatumVeld'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', line: 'rgba(36,27,58,0.10)',
}

function naarISO(s: string): string | null {
  const d = s.match(/\d+/g)
  if (!d || d.length < 3) return null
  const [dag, maand, jaar] = d
  if (jaar.length !== 4) return null
  const di = parseInt(dag, 10), mi = parseInt(maand, 10), ji = parseInt(jaar, 10)
  if (di < 1 || di > 31 || mi < 1 || mi > 12 || ji < 1900) return null
  return `${jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`
}

function leeftijdVan(iso: string): number {
  const [j, m, d] = iso.split('-').map(Number)
  const nu = new Date()
  let leeftijd = nu.getFullYear() - j
  const maandVerschil = (nu.getMonth() + 1) - m
  if (maandVerschil < 0 || (maandVerschil === 0 && nu.getDate() < d)) leeftijd--
  return leeftijd
}

export default function Registreer() {
  const router = useRouter()
  const { t } = useT()
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [voornaam, setVoornaam] = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [gebruikersnaam, setGebruikersnaam] = useState('')
  const [email, setEmail] = useState('')
  const [gbISO, setGbISO] = useState('')
  const [postcode, setPostcode] = useState('')
  const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 60 : insets.top + 14 }]

  async function registreer() {
    setFout('')
    if (!voornaam.trim()) return setFout(t('Vul je voornaam in.'))
    if (!achternaam.trim()) return setFout(t('Vul je achternaam in.'))
    const gnaam = gebruikersnaam.trim()
    if (!/^[A-Za-z0-9_]{3,20}$/.test(gnaam)) return setFout(t('Kies een gebruikersnaam van 3–20 tekens (letters, cijfers of _).'))
    if (!gbISO) return setFout(t('Kies je geboortedatum.'))
    const iso = gbISO
    const leeftijd = leeftijdVan(iso)
    if (leeftijd < 0 || leeftijd > 120) return setFout(t('Controleer je geboortedatum.'))
    if (leeftijd < 13) return setFout(t('Je moet minstens 13 jaar zijn om zelf een account te maken. Vraag een ouder om je te helpen.'))
    if (!/^\d{4}$/.test(postcode.trim())) return setFout(t('Geef een geldige postcode (4 cijfers).'))
    if (!email.trim()) return setFout(t('Vul je e-mailadres in.'))
    if (ww.length < 6) return setFout(t('Kies een wachtwoord van minstens 6 tekens.'))

    setBezig(true)
    // Gebruikersnaam vrij? (vóór het account bestaat)
    const { data: vrij } = await supabase.rpc('gebruikersnaam_vrij', { p_naam: gnaam })
    if (vrij === false) { setBezig(false); return setFout(t('Die gebruikersnaam is al bezet, kies een andere.')) }

    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: ww })
    if (error) {
      setBezig(false)
      return setFout(
        error.message.toLowerCase().includes('registered') || error.message.toLowerCase().includes('already')
          ? 'Dit e-mailadres heeft al een account.'
          : 'Registreren mislukt. Controleer je e-mailadres.'
      )
    }
    if (!data.session || !data.user) {
      setBezig(false)
      return setFout(t('Account aangemaakt, maar e-mailbevestiging staat nog aan in Supabase.'))
    }
    // Profiel opslaan
    const { error: e2 } = await supabase.from('bezoeker').insert({
      auth_user_id: data.user.id, naam: `${voornaam.trim()} ${achternaam.trim()}`, email: email.trim(),
      gebruikersnaam: gnaam, geboortedatum: iso, postcode: postcode.trim(),
    })
    if (e2) {
      setBezig(false)
      return setFout(
        (e2 as any).code === '23505' || e2.message.toLowerCase().includes('gebruikersnaam')
          ? 'Die gebruikersnaam is net bezet geraakt, kies een andere.'
          : 'Account gemaakt, maar je profiel opslaan mislukte. Probeer opnieuw.'
      )
    }
    // Kaartje koppelen (punten verhuizen mee) — niet-blokkerend
    if (code) {
      await supabase.rpc('claim_via_code', { p_claim_code: String(code).trim() })
    }
    setBezig(false)
    router.replace('/bezoeker')
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={wrapC} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/')} hitSlop={12}>
          <Text style={s.terug}>{t('‹ Terug')}</Text>
        </Pressable>

        <View style={s.logo}>
          <View style={s.mark}><Text style={s.markT}>F</Text></View>
          <Text style={s.logoT}>Funpoints</Text>
        </View>

        <Text style={s.titel}>{t('Account aanmaken')}</Text>
        <Text style={s.sub}>
          {code
            ? t('Je spaarkaart wordt meteen aan je account gekoppeld — je punten gaan mee.')
            : t('Maak je gratis Funpoints-account aan en spaar punten bij elke aangesloten kraam.')}
        </Text>

        <View style={s.kaart}>
          <View style={s.naamRij}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('Voornaam')}</Text>
              <TextInput style={s.input} value={voornaam} onChangeText={setVoornaam}
                placeholder={t('Voornaam')} placeholderTextColor={C.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t('Achternaam')}</Text>
              <TextInput style={s.input} value={achternaam} onChangeText={setAchternaam}
                placeholder={t('Achternaam')} placeholderTextColor={C.muted} />
            </View>
          </View>

          <Text style={[s.label, { marginTop: 14 }]}>{t('Gebruikersnaam')}</Text>
          <TextInput style={s.input} value={gebruikersnaam}
            onChangeText={(t) => setGebruikersnaam(t.replace(/[^A-Za-z0-9_]/g, ''))}
            autoCapitalize="none" maxLength={20}
            placeholder={t('bv. kermiskoning')} placeholderTextColor={C.muted} />
          <Text style={s.veldHint}>{t('Hiermee vinden vrienden je. 3–20 tekens: letters, cijfers of _.')}</Text>

          <Text style={[s.label, { marginTop: 14 }]}>{t('E-mail')}</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="jij@voorbeeld.be" placeholderTextColor={C.muted} />

          <Text style={[s.label, { marginTop: 14 }]}>{t('Geboortedatum')}</Text>
          <DatumVeld value={gbISO} onChange={setGbISO} />

          <Text style={[s.label, { marginTop: 14 }]}>{t('Postcode')}</Text>
          <TextInput style={s.input} value={postcode} onChangeText={setPostcode}
            keyboardType="number-pad" maxLength={4}
            placeholder="bv. 9300" placeholderTextColor={C.muted} />

          <Text style={[s.label, { marginTop: 14 }]}>{t('Wachtwoord')}</Text>
          <TextInput style={s.input} value={ww} onChangeText={setWw}
            secureTextEntry placeholder={t('minstens 6 tekens')} placeholderTextColor={C.muted} />

          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}

          <Pressable onPress={registreer} disabled={bezig} style={[s.knop, s.knopCoral, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopCoralT}>{t('Account aanmaken')}</Text>}
          </Pressable>

          <Pressable onPress={() => router.push('/bezoeker')} hitSlop={8} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={s.link}>{t('Heb je al een account? Inloggen')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1 },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  markT: { color: '#fff', fontWeight: '900', fontSize: 19 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', marginTop: 22, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6, lineHeight: 21 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  naamRij: { flexDirection: 'row', gap: 12 },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  veldHint: { color: C.muted, fontSize: 12, marginTop: 6, lineHeight: 16 },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  knopCoral: { backgroundColor: C.coral },
  knopCoralT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  link: { color: C.muted, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
})

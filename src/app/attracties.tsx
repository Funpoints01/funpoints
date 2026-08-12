import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase, maakLogin } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', violet: '#8B5CF6', green: '#10B981', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', okbg: 'rgba(16,185,129,0.12)', line: 'rgba(36,27,58,0.10)',
}
const SOORTEN = ['lunapark', 'schietkraam', 'eendjes', 'ander'] as const

type Attr = { id: string; naam: string; soort: string; auth_user_id: string | null; hoofdprijs_naam: string | null; hoofdprijs_punten: number | null; snelknoppen: number[] | null; max_punten_dag: number | null }
type FkRow = { id: string; email: string; naam: string | null; status: string; geverifieerd: boolean }

export default function Attracties() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [uitbaterId, setUitbaterId] = useState<string | null>(null)
  const [pakket, setPakket] = useState<string>('volledig')
  const [attracties, setAttracties] = useState<Attr[]>([])
  const [laden, setLaden] = useState(true)

  const [naam, setNaam] = useState('')
  const [soort, setSoort] = useState<string>('ander')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  const [loginVoor, setLoginVoor] = useState<string | null>(null)
  const [lEmail, setLEmail] = useState('')
  const [lWw, setLWw] = useState('')
  const [lBezig, setLBezig] = useState(false)
  const [lFout, setLFout] = useState('')
  const [bevestigDel, setBevestigDel] = useState<string | null>(null)
  const [fkLijst, setFkLijst] = useState<Record<string, FkRow[]>>({})
  const [fkVoor, setFkVoor] = useState<string | null>(null)
  const [fkEmail, setFkEmail] = useState('')
  const [fkBezig, setFkBezig] = useState(false)
  const [fkMelding, setFkMelding] = useState('')
  const [limVoor, setLimVoor] = useState<string | null>(null)
  const [limText, setLimText] = useState('')

  const [prijsVoor, setPrijsVoor] = useState<string | null>(null)
  const [pNaam, setPNaam] = useState('')
  const [pPunten, setPPunten] = useState('')
  const [pBezig, setPBezig] = useState(false)
  const [snelVoor, setSnelVoor] = useState<string | null>(null)
  const [snelText, setSnelText] = useState('')
  const [snelBezig, setSnelBezig] = useState(false)

  const [emails, setEmails] = useState<Record<string, string>>({})
  const [resetVoor, setResetVoor] = useState<string | null>(null)
  const [rWw, setRWw] = useState('')
  const [rBezig, setRBezig] = useState(false)
  const [rFout, setRFout] = useState('')
  const [gelukt, setGelukt] = useState<string | null>(null)

  async function bewaarPrijs(attractieId: string) {
    setPBezig(true)
    const n = pPunten.trim() ? parseInt(pPunten, 10) : null
    const { error } = await supabase.from('attractie')
      .update({ hoofdprijs_naam: pNaam.trim() || null, hoofdprijs_punten: n && n > 0 ? n : null })
      .eq('id', attractieId)
    setPBezig(false)
    if (!error) { setPrijsVoor(null); herlaad() }
  }

  async function bewaarSnel(attractieId: string) {
    setSnelBezig(true)
    const nums = Array.from(new Set(
      snelText.split(/[^0-9]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n > 0)
    )).sort((x, y) => x - y).slice(0, 8)
    const { error } = await supabase.from('attractie').update({ snelknoppen: nums }).eq('id', attractieId)
    setSnelBezig(false)
    if (!error) { setSnelVoor(null); herlaad() }
  }

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)) }, [])

  async function herlaad() {
    const { data: u } = await supabase.from('uitbater').select('id, pakket').eq('auth_user_id', session!.user.id).maybeSingle()
    setUitbaterId(u?.id ?? null)
    setPakket(((u as any)?.pakket as string) ?? 'volledig')
    const { data: att } = await supabase.from('attractie').select('id, naam, soort, auth_user_id, hoofdprijs_naam, hoofdprijs_punten, snelknoppen, max_punten_dag').order('naam')
    const lijst = (att ?? []) as Attr[]
    setAttracties(lijst)
    lijst.forEach((x) => laadFoorkramers(x.id))
    const paren = await Promise.all(
      lijst.filter((x) => x.auth_user_id).map(async (x) => {
        const { data: em } = await supabase.rpc('attractie_login_email', { p_attractie_id: x.id })
        return [x.id, (em as string) ?? ''] as const
      }),
    )
    setEmails(Object.fromEntries(paren))
    setLaden(false)
  }
  useEffect(() => { if (session) herlaad() }, [session])

  async function voegToe() {
    setFout('')
    if (!naam.trim()) return setFout('Geef een naam.')
    if (!uitbaterId) return setFout('Geen uitbater gevonden voor deze login.')
    setBezig(true)
    const { error } = await supabase.from('attractie').insert({ uitbater_id: uitbaterId, naam: naam.trim(), soort })
    setBezig(false)
    if (error) return setFout((error as any).message?.includes('ATTRACTIE_LIMIET')
      ? ((error as any).hint || 'Je hebt het maximum aantal attracties voor je pakket bereikt. Contacteer ons voor een extra attractie.')
      : 'Toevoegen mislukt. Probeer opnieuw.')
    setNaam(''); setSoort('ander'); herlaad()
  }

  async function verwijder(id: string) {
    await supabase.from('attractie').delete().eq('id', id)
    setBevestigDel(null); setAttracties((a) => a.filter((x) => x.id !== id))
  }

  async function laadFoorkramers(attractieId: string) {
    const { data } = await supabase.rpc('foorkramer_lijst', { p_attractie_id: attractieId })
    setFkLijst((m) => ({ ...m, [attractieId]: ((data as FkRow[]) ?? []) }))
  }
  async function nodigUit(attractieId: string) {
    setFkMelding('')
    if (!fkEmail.trim()) { setFkMelding('Geef een e-mailadres.'); return }
    setFkBezig(true)
    const { data, error } = await supabase.functions.invoke('foorkramer-uitnodigen', {
      body: { attractie_id: attractieId, email: fkEmail.trim() },
    })
    setFkBezig(false)
    const m = String((data as { error?: string } | null)?.error || error?.message || '')
    if (m) {
      setFkMelding(
        m.includes('MAIL_BESTAAT_AL') ? 'Dit e-mailadres heeft al een account.'
        : m.includes('EIGEN_ADRES') ? 'Dit is je eigen adres — gebruik "Ik sta zelf in dit kraam".'
        : 'Uitnodigen mislukt. Controleer het adres.')
      return
    }
    setFkVoor(null); setFkEmail(''); laadFoorkramers(attractieId)
  }
  async function trekIn(fkId: string, attractieId: string) {
    await supabase.rpc('foorkramer_intrekken', { p_id: fkId })
    laadFoorkramers(attractieId)
  }
  async function ikZelf(attractieId: string) {
    const { error } = await supabase.rpc('foorkramer_ikzelf', { p_attractie_id: attractieId })
    if (!error) laadFoorkramers(attractieId)
  }
  async function zetLimiet(attractieId: string) {
    const n = limText.trim() ? parseInt(limText, 10) : null
    await supabase.rpc('attractie_zet_daglimiet', { p_attractie_id: attractieId, p_limiet: (n && n > 0) ? n : null })
    setLimVoor(null); herlaad()
  }

  async function resetWw(attractieId: string) {
    setRFout('')
    if (rWw.length < 6) return setRFout('Wachtwoord minstens 6 tekens.')
    setRBezig(true)
    const { error } = await supabase.rpc('attractie_login_reset_ww', { p_attractie_id: attractieId, p_nieuw_ww: rWw })
    setRBezig(false)
    if (error) return setRFout('Resetten mislukt. Probeer opnieuw.')
    setResetVoor(null); setRWw(''); setGelukt(attractieId)
  }

  async function loginAanmaken(attractieId: string) {
    setLFout('')
    if (!lEmail.trim()) return setLFout('Geef een e-mailadres.')
    if (lWw.length < 6) return setLFout('Wachtwoord minstens 6 tekens.')
    setLBezig(true)
    try {
      const newId = await maakLogin(lEmail, lWw)
      const { error } = await supabase.from('attractie').update({ auth_user_id: newId }).eq('id', attractieId)
      if (error) throw error
      setLBezig(false); setLoginVoor(null); setLEmail(''); setLWw(''); herlaad()
    } catch (e: any) {
      setLBezig(false)
      const m = String(e?.message ?? '').toLowerCase()
      setLFout(m.includes('registered') || m.includes('already') ? 'Dit e-mailadres bestaat al.' : 'Login aanmaken mislukt.')
    }
  }

  if (session === undefined || laden) {
    return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>
  }
  if (session === null) {
    return (
      <View style={[s.scherm, s.center, { padding: 28 }]}>
        <Text style={s.sub}>Log eerst in als uitbater.</Text>
        <Pressable onPress={() => router.push('/uitbater')} style={{ marginTop: 16 }}>
          <Text style={s.terug}>Naar inloggen</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/uitbater')} hitSlop={12}><Text style={s.terug}>‹ Dashboard</Text></Pressable>
        <Text style={s.titel}>Attracties & logins</Text>
        <Text style={s.sub}>Beheer je kramen en maak per kraam een foorkramer-login aan.</Text>

        <View style={s.kaart}>
          <Text style={s.blokTitel}>Nieuwe attractie</Text>
          <Text style={[s.label, { marginTop: 14 }]}>Naam</Text>
          <TextInput style={s.input} value={naam} onChangeText={setNaam}
            placeholder="bv. Schietkraam Bavikhove" placeholderTextColor={C.muted} />
          <Text style={[s.label, { marginTop: 14 }]}>Soort</Text>
          <View style={s.chips}>
            {SOORTEN.map((so) => (
              <Pressable key={so} onPress={() => setSoort(so)} style={[s.chip, soort === so && s.chipActief]}>
                <Text style={[s.chipT, soort === so && s.chipTActief]}>{so}</Text>
              </Pressable>
            ))}
          </View>
          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
          <Pressable onPress={voegToe} disabled={bezig} style={[s.knop, s.knopViolet, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>+ Attractie toevoegen</Text>}
          </Pressable>
        </View>

        <Text style={[s.blokTitel, { marginTop: 24, marginBottom: 4 }]}>Je attracties</Text>
        {attracties.length === 0
          ? <Text style={s.sub}>Nog geen attracties.</Text>
          : attracties.map((a) => (
            <View key={a.id} style={s.attrKaart}>
              <View style={s.attrTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.attrNaam}>{a.naam}</Text>
                  <Text style={s.attrSoort}>{a.soort}</Text>
                </View>
                {(fkLijst[a.id]?.length ?? 0) > 0
                  ? <Text style={s.badgeOk}>👤 {fkLijst[a.id]!.length} scanner(s)</Text>
                  : <Text style={s.badgeGeen}>geen scanner</Text>}
              </View>

              {pakket === 'volledig' ? (prijsVoor === a.id ? (
                <View style={s.loginVak}>
                  <Text style={s.blokTitel}>🎁 Hoofdprijs</Text>
                  <Text style={[s.label, { marginTop: 12 }]}>Naam van de prijs</Text>
                  <TextInput style={s.input} value={pNaam} onChangeText={setPNaam}
                    placeholder="bv. Grote knuffelbeer" placeholderTextColor={C.muted} />
                  <Text style={[s.label, { marginTop: 12 }]}>Punten voor de hoofdprijs</Text>
                  <TextInput style={s.input} value={pPunten} onChangeText={setPPunten}
                    keyboardType="number-pad" placeholder="bv. 500" placeholderTextColor={C.muted} />
                  <View style={s.rij}>
                    <Pressable onPress={() => bewaarPrijs(a.id)} disabled={pBezig} style={[s.knop, s.knopViolet, s.knopHalf, pBezig && s.knopUit]}>
                      {pBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>Opslaan</Text>}
                    </Pressable>
                    <Pressable onPress={() => setPrijsVoor(null)} style={[s.knop, s.knopWit, s.knopHalf]}>
                      <Text style={s.knopWitT}>Annuleren</Text>
                    </Pressable>
                  </View>
                  <Text style={s.tip}>Bezoekers zien hun voortgang naar deze prijs op de kraampagina.</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => { setPrijsVoor(a.id); setPNaam(a.hoofdprijs_naam ?? ''); setPPunten(a.hoofdprijs_punten ? String(a.hoofdprijs_punten) : '') }}
                  style={s.prijsKnop}>
                  <Text style={s.prijsKnopT}>
                    🎁 {a.hoofdprijs_naam && a.hoofdprijs_punten
                      ? `${a.hoofdprijs_naam} · ${a.hoofdprijs_punten} ptn — wijzigen`
                      : 'Hoofdprijs instellen'}
                  </Text>
                </Pressable>
              )) : null}

              {pakket === 'volledig' ? (snelVoor === a.id ? (
                <View style={s.loginVak}>
                  <Text style={s.blokTitel}>⚡ Snelknoppen</Text>
                  <Text style={s.tip}>Bedragen die de kraamhouder met één tik boekt. Komma-gescheiden.</Text>
                  <TextInput style={[s.input, { marginTop: 10 }]} value={snelText} onChangeText={setSnelText}
                    keyboardType="numbers-and-punctuation" placeholder="bv. 5, 25, 100, 500" placeholderTextColor={C.muted} />
                  <View style={s.rij}>
                    <Pressable onPress={() => bewaarSnel(a.id)} disabled={snelBezig} style={[s.knop, s.knopViolet, s.knopHalf, snelBezig && s.knopUit]}>
                      {snelBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>Opslaan</Text>}
                    </Pressable>
                    <Pressable onPress={() => setSnelVoor(null)} style={[s.knop, s.knopWit, s.knopHalf]}>
                      <Text style={s.knopWitT}>Annuleren</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => { setSnelVoor(a.id); setSnelText((a.snelknoppen ?? []).join(', ')) }}
                  style={s.prijsKnop}>
                  <Text style={s.prijsKnopT}>
                    ⚡ {a.snelknoppen && a.snelknoppen.length
                      ? `Snelknoppen: ${a.snelknoppen.join(' · ')} — wijzigen`
                      : 'Snelknoppen instellen'}
                  </Text>
                </Pressable>
              )) : null}

              <View style={s.loginVak}>
                <Text style={s.blokTitel}>👤 Foorkramers</Text>
                <Text style={s.tip}>Wie mag punten scannen voor dit kraam. Elke foorkramer krijgt een uitnodiging per e-mail en kiest zelf zijn wachtwoord.</Text>

                {(fkLijst[a.id] ?? []).map((f) => (
                  <View key={f.id} style={s.loginInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.loginInfoEmail} selectable>{f.email}</Text>
                      <Text style={s.tip}>
                        {f.status === 'uitgenodigd' ? '✉️ uitgenodigd — wacht op wachtwoord'
                          : f.geverifieerd ? '🟢 actief (ingelogd)' : '✓ actief'}
                      </Text>
                    </View>
                    <Pressable onPress={() => trekIn(f.id, a.id)} style={[s.knopKlein, { borderColor: C.red }]}>
                      <Text style={[s.knopKleinT, { color: C.red }]}>Intrekken</Text>
                    </Pressable>
                  </View>
                ))}

                {fkVoor === a.id ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.label}>E-mail van de foorkramer</Text>
                    <TextInput style={s.input} value={fkEmail} onChangeText={setFkEmail}
                      autoCapitalize="none" keyboardType="email-address"
                      placeholder="medewerker@voorbeeld.be" placeholderTextColor={C.muted} />
                    {fkMelding ? <Text style={s.tip}>{fkMelding}</Text> : null}
                    <View style={s.rij}>
                      <Pressable onPress={() => nodigUit(a.id)} disabled={fkBezig} style={[s.knop, s.knopViolet, s.knopHalf, fkBezig && s.knopUit]}>
                        {fkBezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopVioletT}>Uitnodiging sturen</Text>}
                      </Pressable>
                      <Pressable onPress={() => { setFkVoor(null); setFkMelding('') }} style={[s.knop, s.knopWit, s.knopHalf]}>
                        <Text style={s.knopWitT}>Annuleren</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => { setFkVoor(a.id); setFkEmail(''); setFkMelding('') }} style={[s.knopKlein, { borderColor: C.violet, marginTop: 12 }]}>
                    <Text style={[s.knopKleinT, { color: C.violet }]}>+ Foorkramer uitnodigen</Text>
                  </Pressable>
                )}

                <Pressable onPress={() => ikZelf(a.id)} style={[s.knopKlein, { marginTop: 8 }]}>
                  <Text style={s.knopKleinT}>Ik sta zelf in dit kraam</Text>
                </Pressable>
              </View>

              {limVoor === a.id ? (
                <View style={s.loginVak}>
                  <Text style={s.blokTitel}>🛡️ Dagelijkse puntenlimiet</Text>
                  <Text style={s.tip}>Max. punten dat dit kraam per dag mag uitdelen (beveiliging tegen misbruik). Leeg = geen limiet.</Text>
                  <TextInput style={[s.input, { marginTop: 10 }]} value={limText} onChangeText={setLimText}
                    keyboardType="number-pad" placeholder="bv. 5000" placeholderTextColor={C.muted} />
                  <View style={s.rij}>
                    <Pressable onPress={() => zetLimiet(a.id)} style={[s.knop, s.knopViolet, s.knopHalf]}>
                      <Text style={s.knopVioletT}>Opslaan</Text>
                    </Pressable>
                    <Pressable onPress={() => setLimVoor(null)} style={[s.knop, s.knopWit, s.knopHalf]}>
                      <Text style={s.knopWitT}>Annuleren</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => { setLimVoor(a.id); setLimText(a.max_punten_dag ? String(a.max_punten_dag) : '') }} style={s.prijsKnop}>
                  <Text style={s.prijsKnopT}>🛡️ {a.max_punten_dag ? `Daglimiet: ${a.max_punten_dag} ptn — wijzigen` : 'Daglimiet instellen'}</Text>
                </Pressable>
              )}

              <View style={s.rij}>
                {bevestigDel === a.id ? (
                  <Pressable onPress={() => verwijder(a.id)} style={[s.knopKlein, { borderColor: C.red }]}>
                    <Text style={[s.knopKleinT, { color: C.red }]}>Zeker verwijderen?</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setBevestigDel(a.id)} style={s.knopKlein}>
                    <Text style={s.knopKleinT}>Verwijderen</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        <Text style={s.voet}>Een attractie verwijderen wist ook zijn puntengeschiedenis.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  blokTitel: { color: C.ink, fontSize: 16, fontWeight: '800' },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: C.veld, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.line },
  chipActief: { backgroundColor: C.violet, borderColor: C.violet },
  chipT: { color: C.ink, fontWeight: '700', fontSize: 13.5 },
  chipTActief: { color: '#fff' },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopHalf: { flex: 1, marginTop: 0 },
  rij: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  knopViolet: { backgroundColor: C.violet },
  knopVioletT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  knopWit: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line },
  knopWitT: { color: C.ink, fontWeight: '800', fontSize: 15 },
  knopUit: { opacity: 0.5 },
  knopKlein: { borderRadius: 10, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 9 },
  knopKleinT: { color: C.muted, fontWeight: '700', fontSize: 13 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  attrKaart: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 10,
  },
  attrTop: { flexDirection: 'row', alignItems: 'center' },
  attrNaam: { color: C.ink, fontSize: 16, fontWeight: '800' },
  attrSoort: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  badgeOk: { color: C.green, fontSize: 12.5, fontWeight: '700' },
  badgeGeen: { color: C.muted, fontSize: 12.5, fontWeight: '700' },
  loginVak: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  prijsKnop: { marginTop: 12, backgroundColor: 'rgba(139,92,246,0.10)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  prijsKnopT: { color: C.violet, fontWeight: '800', fontSize: 13.5 },
  tip: { color: C.muted, fontSize: 12, marginTop: 10 },
  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 20, opacity: 0.8 },
  loginEmail: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 6 },
  loginInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    backgroundColor: C.veld, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  loginInfoLabel: { color: C.muted, fontSize: 11.5, fontWeight: '700' },
  loginInfoEmail: { color: C.ink, fontSize: 14.5, fontWeight: '700', marginTop: 2 },
  okT: { color: C.green, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
})

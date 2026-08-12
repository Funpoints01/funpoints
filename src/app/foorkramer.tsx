import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as wachtrij from '../lib/boekingWachtrij'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', green: '#10B981', greend: '#0E9E70', red: '#E11D48',
  redbg: 'rgba(225,29,72,0.10)', okbg: 'rgba(16,185,129,0.12)',
  line: 'rgba(36,27,58,0.10)', violet: '#8B5CF6',
}

const PRESETS = [10, 25, 50, 100, 250, 500]

const isWeb = Platform.OS === 'web'
const isStandalonePWA =
  isWeb && typeof window !== 'undefined' &&
  ((typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as any)?.standalone === true)
const isMobielWeb =
  isWeb && typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
// Op de gsm in de browser (nog niet geïnstalleerd) → toon de PWA-gids na het inloggen.
const toonPwaGids = isMobielWeb && !isStandalonePWA

export default function FoorkramerScherm() {
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)
  const [gidsKlaar, setGidsKlaar] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLaden(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (laden) {
    return (
      <View style={[s.scherm, s.center]}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    )
  }
  if (!session) return <Login />
  if (toonPwaGids && !gidsKlaar) return <PwaGids onVerder={() => setGidsKlaar(true)} />
  return <Toegang session={session} />
}

function Stap({ n, t }: { n: string; t: string }) {
  return (
    <View style={s.stapRij}>
      <View style={s.stapN}><Text style={s.stapNT}>{n}</Text></View>
      <Text style={s.stapT}>{t}</Text>
    </View>
  )
}

function PwaGids({ onVerder }: { onVerder: () => void }) {
  const [tel, setTel] = useState<'ios' | 'android' | null>(null)
  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Logo />
        <Text style={s.titel}>Zet Funpoints op je beginscherm</Text>
        <Text style={s.sub}>Zo open je de scanner voortaan met één tik, zonder browser. Welke telefoon heb je?</Text>

        <View style={s.telRij}>
          <Pressable onPress={() => setTel('ios')} style={[s.telKnop, tel === 'ios' && s.telKnopAan]}>
            <Text style={s.telE}>🍎</Text><Text style={[s.telT, tel === 'ios' && s.telTAan]}>iPhone</Text>
          </Pressable>
          <Pressable onPress={() => setTel('android')} style={[s.telKnop, tel === 'android' && s.telKnopAan]}>
            <Text style={s.telE}>🤖</Text><Text style={[s.telT, tel === 'android' && s.telTAan]}>Android</Text>
          </Pressable>
        </View>

        {tel === 'ios' ? (
          <View style={s.kaart}>
            <Text style={s.stapKop}>Op je iPhone — in Safari:</Text>
            <Stap n="1" t="Tik onderaan op de deelknop (het vierkantje met een pijltje omhoog)." />
            <Stap n="2" t="Scroll en kies “Zet op beginscherm”." />
            <Stap n="3" t="Tik op “Voeg toe” rechtsboven." />
            <Stap n="4" t="Open Funpoints voortaan vanaf je beginscherm en log in." />
          </View>
        ) : tel === 'android' ? (
          <View style={s.kaart}>
            <Text style={s.stapKop}>Op je Android — in Chrome:</Text>
            <Stap n="1" t="Tik rechtsboven op het menu (drie puntjes)." />
            <Stap n="2" t="Kies “App installeren” of “Toevoegen aan startscherm”." />
            <Stap n="3" t="Bevestig met “Installeren”." />
            <Stap n="4" t="Open Funpoints voortaan vanaf je beginscherm en log in." />
          </View>
        ) : null}

        {tel ? (
          <Pressable onPress={onVerder} style={[s.knop, s.knopGroen]}>
            <Text style={s.knopGroenT}>Naar de scanner</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onVerder} style={s.gidsLinkWrap}>
          <Text style={s.gidsLink}>Nu even verder in de browser →</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

function Logo() {
  return (
    <View style={s.logo}>
      <View style={s.mark}><Text style={s.markT}>F</Text></View>
      <Text style={s.logoT}>Funpoints</Text>
    </View>
  )
}

function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  async function login() {
    setFout('')
    setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password: ww,
    })
    setBezig(false)
    if (error) setFout('Inloggen mislukt — controleer je e-mail en wachtwoord.')
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/')} hitSlop={12}>
          <Text style={s.terug}>‹ Terug</Text>
        </Pressable>

        <Logo />
        <Text style={s.titel}>Foorkramer</Text>
        <Text style={s.sub}>Log in met de account van deze attractie.</Text>

        <View style={s.kaart}>
          <Text style={s.label}>E-mail</Text>
          <TextInput
            style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="attractie@funpoints.be" placeholderTextColor={C.muted}
          />
          <Text style={[s.label, { marginTop: 14 }]}>Wachtwoord</Text>
          <TextInput
            style={s.input} value={ww} onChangeText={setWw}
            secureTextEntry placeholder="••••••••" placeholderTextColor={C.muted}
          />

          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}

          <Pressable onPress={login} disabled={bezig} style={[s.knop, s.knopGroen, bezig && s.knopUit]}>
            {bezig
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.knopGroenT}>Inloggen</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function vertaalFout(m: string): string {
  if (m.includes('ONVOLDOENDE_SALDO')) return 'Onvoldoende saldo op dit kaartje.'
  if (m.includes('KAARTJE_ONBEKEND')) return 'Deze kaartje-code bestaat niet.'
  if (m.includes('BEZOEKER_ONBEKEND')) return 'Deze klant-QR is niet gekend.'
  if (m.includes('NIET_GEMACHTIGD')) return 'Deze login is geen attractie — boeken mag niet.'
  if (m.includes('PUNTEN_MOET_POSITIEF')) return 'Geef een positief aantal punten.'
  if (m.includes('GEEF_BEZOEKER_OF_KAARTJE')) return 'Geen geldige drager (kaartje).'
  return 'Er ging iets mis. Probeer opnieuw.'
}

function Scanner({ onScan, onSluit }: { onScan: (code: string) => void; onSluit: () => void }) {
  const [perm, requestPerm] = useCameraPermissions()
  const [klaar, setKlaar] = useState(false)

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm()
  }, [perm])

  if (!perm) {
    return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.green} /></View>
  }
  if (!perm.granted) {
    return (
      <View style={[s.scherm, s.center, { padding: 28 }]}>
        <Text style={s.scanUitleg}>Funpoints heeft toegang tot je camera nodig om kaartjes te scannen.</Text>
        <Pressable style={[s.knop, s.knopGroen, { alignSelf: 'stretch' }]} onPress={requestPerm}>
          <Text style={s.knopGroenT}>Camera toestaan</Text>
        </Pressable>
        <Pressable style={{ marginTop: 16 }} onPress={onSluit}>
          <Text style={s.terug}>Annuleren</Text>
        </Pressable>
      </View>
    )
  }
  return (
    <View style={[s.scherm, { backgroundColor: '#000' }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={klaar ? undefined : ({ data }) => { setKlaar(true); onScan(data) }}
      />
      <View style={s.scanOverlay}>
        <View style={s.scanKader} />
        <Text style={s.scanHint}>Richt op de QR-code van het kaartje</Text>
        <Pressable style={[s.knop, s.knopWit, { alignSelf: 'stretch' }]} onPress={onSluit}>
          <Text style={s.knopWitT}>Sluiten</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Toegang({ session }: { session: Session }) {
  const [status, setStatus] = useState<'laden' | 'ok' | 'tfa'>('laden')
  const [code, setCode] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [melding, setMelding] = useState('')

  async function stuurCode() {
    setMelding(''); setFout('')
    const { error } = await supabase.functions.invoke('foorkramer-2fa-start', { body: {} })
    setMelding(error ? 'Code sturen mislukt — probeer opnieuw.' : 'We stuurden een code naar je e-mail. Kijk ook in je spam.')
  }

  const gestuurd = useRef(false)
  useEffect(() => {
    supabase.rpc('foorkramer_login_status').then(({ data }) => {
      const d = data as { foorkramer?: boolean; sessie_ok?: boolean } | null
      if (!d?.foorkramer || d?.sessie_ok) { setStatus('ok'); return }
      setStatus('tfa')
      if (!gestuurd.current) { gestuurd.current = true; stuurCode() }
    })
  }, [])

  async function verifieer() {
    setFout('')
    if (code.trim().length < 6) { setFout('Geef de 6-cijfercode.'); return }
    setBezig(true)
    const { data, error } = await supabase.rpc('foorkramer_2fa_verifieer', { p_code: code.trim() })
    setBezig(false)
    const res = data as { ok?: boolean; reden?: string } | null
    if (error || !res?.ok) {
      const r = res?.reden
      setFout(
        r === 'VERLOPEN' ? 'Code verlopen — vraag een nieuwe aan.'
        : r === 'TE_VEEL_POGINGEN' ? 'Te veel pogingen — vraag een nieuwe code aan.'
        : 'Verkeerde code — gebruik de code uit de laatste mail.')
      return
    }
    setStatus('ok')
  }

  if (status === 'laden') return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.green} size="large" /></View>
  if (status === 'ok') return <Boeken session={session} />

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Logo />
        <Text style={s.titel}>Verificatie</Text>
        <Text style={s.sub}>Voer de 6-cijfercode in die we naar je e-mail stuurden.</Text>
        <View style={s.kaart}>
          <Text style={s.label}>Code</Text>
          <TextInput style={s.input} value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad" placeholder="123456" placeholderTextColor={C.muted} />
          {melding ? <Text style={[s.sub, { marginTop: 10 }]}>{melding}</Text> : null}
          {fout ? <View style={s.foutBox}><Text style={s.foutT}>{fout}</Text></View> : null}
          <Pressable onPress={verifieer} disabled={bezig} style={[s.knop, s.knopGroen, bezig && s.knopUit]}>
            {bezig ? <ActivityIndicator color="#fff" /> : <Text style={s.knopGroenT}>Bevestigen</Text>}
          </Pressable>
          <Pressable onPress={stuurCode} hitSlop={8} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={s.terug}>Geen code? Opnieuw sturen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Boeken({ session }: { session: Session }) {
  const router = useRouter()
  const [naam, setNaam] = useState<string | null>(null)
  const [naamLaden, setNaamLaden] = useState(true)
  const [code, setCode] = useState('')
  const [isBezoeker, setIsBezoeker] = useState(false)
  const [punten, setPunten] = useState('')
  const [bezig, setBezig] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [klantSaldo, setKlantSaldo] = useState<number | null>(null)
  const [wachtN, setWachtN] = useState(0)
  const [online, setOnline] = useState(true)
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null)
  const [voucher, setVoucher] = useState<{ status: string; titel?: string; gebruikt_op?: string } | null>(null)
  const [voucherBezig, setVoucherBezig] = useState(false)
  const [presets, setPresets] = useState<number[]>(PRESETS)

  async function wisselVoucher(vcode: string) {
    setVoucherBezig(true)
    const { data, error } = await supabase.rpc('wissel_actie_in', { p_code: vcode })
    setVoucherBezig(false)
    setVoucher(error ? { status: 'fout' } : (data as any))
  }

  async function haalSaldo(rawCode: string, bez: boolean) {
    const c = rawCode.trim()
    if (!c) { setKlantSaldo(null); return }
    const { data, error } = bez
      ? await supabase.rpc('huidig_saldo', { p_bezoeker_code: c })
      : await supabase.rpc('huidig_saldo', { p_kaartje_code: c })
    setKlantSaldo(error ? null : (data as number))
  }

  useEffect(() => {
    supabase.rpc('mijn_scan_kraam').then(({ data }) => {
      const d = data as { naam?: string; snelknoppen?: number[] } | null
      setNaam(d?.naam ?? null)
      if (d?.snelknoppen && d.snelknoppen.length) setPresets(d.snelknoppen)
      setNaamLaden(false)
    })
  }, [])

  useEffect(() => {
    let actief = true
    const sync = async () => { const r = await wachtrij.flush(); if (actief) setWachtN(r.resterend) }
    wachtrij.aantal().then((a) => { if (actief) setWachtN(a) })
    sync()
    const naarOnline = () => { setOnline(true); sync() }
    const naarOffline = () => setOnline(false)
    if (isWeb && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      setOnline((navigator as any).onLine !== false)
      window.addEventListener('online', naarOnline)
      window.addEventListener('offline', naarOffline)
    }
    const iv = setInterval(sync, 20000)
    return () => {
      actief = false; clearInterval(iv)
      if (isWeb && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('online', naarOnline)
        window.removeEventListener('offline', naarOffline)
      }
    }
  }, [])

  async function boek(soort: 'toevoegen' | 'aftrekken', bedrag?: number) {
    const n = bedrag ?? parseInt(punten, 10)
    if (!code.trim()) { setMelding({ ok: false, tekst: 'Scan of typ eerst een kaartje-code.' }); return }
    if (!n || n <= 0) { setMelding({ ok: false, tekst: 'Geef een positief aantal punten.' }); return }
    setBezig(true)
    setMelding(null)

    // Inwisselen (aftrekken) vereist internet: het saldo moet geverifieerd
    // worden. Sparen (toevoegen) werkt offline via de wachtrij.
    if (soort === 'aftrekken') {
      const { data, error } = isBezoeker
        ? await supabase.rpc('boek_bezoeker', { p_bezoeker_code: code.trim(), p_punten: n, p_soort: soort })
        : await supabase.rpc('boek_punten', { p_punten: n, p_soort: soort, p_kaartje_code: code.trim() })
      setBezig(false)
      if (error) {
        setMelding({ ok: false, tekst: wachtrij.isOffline() ? 'Inwisselen kan enkel met internet.' : vertaalFout(error.message) })
      } else {
        setMelding({ ok: true, tekst: `−${n} geboekt. Nieuw saldo: ${data} punten.` })
        setPunten(''); setKlantSaldo(data as number)
      }
      return
    }

    // Sparen: offline-first. Zet in de wachtrij, probeer meteen te syncen.
    const item: wachtrij.Boeking = {
      client_id: wachtrij.nieuwId(),
      drager: isBezoeker ? 'bezoeker' : 'kaartje',
      code: code.trim(),
      punten: n,
      soort: 'toevoegen',
      geboekt_op: new Date().toISOString(),
    }
    await wachtrij.voegToe(item)
    const res = await wachtrij.flush()
    setBezig(false)
    setWachtN(res.resterend)
    const saldo = res.saldo[item.client_id]
    const gw = res.geweigerd.find((g) => g.client_id === item.client_id)
    if (typeof saldo === 'number') {
      setMelding({ ok: true, tekst: `+${n} geboekt. Nieuw saldo: ${saldo} punten.` })
      setKlantSaldo(saldo)
    } else if (gw) {
      // Server weigerde deze boeking (bv. onbekende code of serverfout).
      setMelding({ ok: false, tekst: gw.opgegeven
        ? `Boeking mislukt en opgegeven na meerdere pogingen: ${gw.fout}`
        : `Nog niet geboekt — ${gw.fout}. Wordt opnieuw geprobeerd.` })
    } else if (res.fout) {
      setMelding({ ok: false, tekst: `Nog niet geboekt — server gaf een fout: ${res.fout}` })
    } else {
      setMelding({ ok: true, tekst: `+${n} genoteerd — geen internet, wordt automatisch gesynchroniseerd.` })
    }
    setPunten('')
  }

  if (voucherBezig) {
    return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.green} size="large" /></View>
  }

  if (voucher) {
    const ok = voucher.status === 'ok'
    const T: Record<string, { kop: string; tekst: string }> = {
      ok: { kop: '✓ Geldig', tekst: 'Voucher ingewisseld. Geef de klant zijn actie.' },
      reeds_gebruikt: { kop: '✗ Al gebruikt', tekst: voucher.gebruikt_op ? `Deze voucher werd al ingewisseld op ${new Date(voucher.gebruikt_op).toLocaleString('nl-BE')}.` : 'Deze voucher werd al ingewisseld.' },
      verkeerd_kraam: { kop: '✗ Ander kraam', tekst: 'Deze voucher hoort bij een andere attractie.' },
      verlopen: { kop: '✗ Verlopen', tekst: 'Deze actie is niet meer geldig.' },
      onbekend: { kop: '✗ Onbekend', tekst: 'Deze QR is geen geldige Funpoints-voucher.' },
      fout: { kop: '✗ Mislukt', tekst: 'Er ging iets mis. Probeer opnieuw.' },
    }
    const info = T[voucher.status] ?? T.fout
    return (
      <View style={[s.scherm, s.center, { backgroundColor: ok ? C.green : C.red, padding: 30 }]}>
        <Text style={s.vIcoon}>{ok ? '✓' : '✗'}</Text>
        {voucher.titel ? <Text style={s.vTitel}>{voucher.titel}</Text> : null}
        <Text style={s.vKop}>{info.kop.replace(/[✓✗]\s*/, '')}</Text>
        <Text style={s.vTekst}>{info.tekst}</Text>
        <Pressable style={s.vKnop} onPress={() => { setVoucher(null); setScannerOpen(true) }}>
          <Text style={s.vKnopT}>Volgende klant scannen</Text>
        </Pressable>
        <Pressable style={{ marginTop: 14 }} onPress={() => setVoucher(null)}>
          <Text style={s.vKlaar}>Klaar</Text>
        </Pressable>
      </View>
    )
  }

  if (scannerOpen) {
    return (
      <Scanner
        onScan={(d) => {
          const raw = d.trim()
          setScannerOpen(false)
          if (raw.startsWith('FP-V:')) {
            wisselVoucher(raw.slice(5).trim())
            return
          }
          let c = ''; let bez = false
          if (raw.startsWith('FP-B:')) {
            c = (raw.split(':')[1] ?? '').trim(); bez = true
          } else {
            c = raw.toUpperCase(); bez = false
          }
          setCode(c); setIsBezoeker(bez)
          setMelding(null)
          haalSaldo(c, bez)
        }}
        onSluit={() => setScannerOpen(false)}
      />
    )
  }

  return (
    <KeyboardAvoidingView style={s.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.topbar}>
          <Logo />
          <Pressable onPress={async () => { await supabase.auth.signOut(); router.push('/') }}>
            <Text style={s.uitlog}>Uitloggen</Text>
          </Pressable>
        </View>

        <Text style={s.titel}>Punten boeken</Text>
        <Text style={s.sub}>
          {naamLaden ? 'Ingelogd…'
            : naam ? `Attractie: ${naam}`
            : 'Let op: deze login is aan geen attractie gekoppeld.'}
        </Text>

        {(!online || wachtN > 0) ? (
          <View style={s.syncBalk}>
            <Text style={s.syncT}>
              {online
                ? `🔄 ${wachtN} boeking(en) worden gesynchroniseerd…`
                : wachtN > 0
                  ? `📴 Geen internet · ${wachtN} boeking(en) in wachtrij — sparen werkt gewoon door`
                  : '📴 Geen internet — sparen werkt gewoon door, inwisselen niet'}
            </Text>
          </View>
        ) : null}

        <View style={s.kaart}>
          <Pressable style={[s.knop, s.knopGroen, { marginTop: 0 }]} onPress={() => setScannerOpen(true)}>
            <Text style={s.knopGroenT}>📷 Scan kaartje</Text>
          </Pressable>

          <Text style={[s.label, { marginTop: 18 }]}>Kaartje-code</Text>
          <TextInput
            style={s.input} value={code}
            onChangeText={(t) => { setCode(t); setIsBezoeker(false); setKlantSaldo(null) }}
            onBlur={() => haalSaldo(code, isBezoeker)}
            autoCapitalize="characters" autoCorrect={false}
            placeholder="of typ bv. TEST123" placeholderTextColor={C.muted}
          />
          {isBezoeker ? <Text style={s.klantNote}>👤 Klant-QR herkend</Text> : null}

          {klantSaldo !== null ? (
            <View style={s.saldoInfo}>
              <Text style={s.saldoInfoLabel}>Huidig saldo van deze klant</Text>
              <Text style={s.saldoInfoT}>{klantSaldo} punten</Text>
            </View>
          ) : null}

          {presets.length > 0 ? (
            <>
              <Text style={[s.label, { marginTop: 18 }]}>Snel toevoegen</Text>
              <View style={s.presetGrid}>
                {presets.map((p, i) => (
                  <Pressable key={`${p}-${i}`} onPress={() => boek('toevoegen', p)} disabled={bezig}
                    style={[s.presetKnop, bezig && s.knopUit]}>
                    <Text style={s.presetT}>+{p}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[s.label, { marginTop: 18 }]}>{presets.length > 0 ? 'Of een ander aantal' : 'Aantal punten'}</Text>
          <TextInput
            style={s.input} value={punten} onChangeText={setPunten}
            keyboardType="number-pad" placeholder="bv. 50" placeholderTextColor={C.muted}
          />

          {melding
            ? <View style={[s.foutBox, melding.ok && s.okBox]}>
                <Text style={[s.foutT, melding.ok && s.okT]}>{melding.tekst}</Text>
              </View>
            : null}

          <View style={s.knoppenRij}>
            <Pressable onPress={() => boek('toevoegen')} disabled={bezig}
              style={[s.knop, s.knopGroen, s.knopHalf, bezig && s.knopUit]}>
              <Text style={s.knopGroenT}>+ Toevoegen</Text>
            </Pressable>
            <Pressable onPress={() => boek('aftrekken')} disabled={bezig}
              style={[s.knop, s.knopWit, s.knopHalf, bezig && s.knopUit]}>
              <Text style={s.knopWitT}>− Aftrekken</Text>
            </Pressable>
          </View>
          {bezig ? <ActivityIndicator color={C.green} style={{ marginTop: 14 }} /> : null}
        </View>

        <Text style={s.voet}>Fase 1 · scan of typ de kaartje-code</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 24, paddingTop: 60, maxWidth: 460, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 22 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  markT: { color: '#fff', fontWeight: '900', fontSize: 19 },
  logoT: { color: C.ink, fontWeight: '800', fontSize: 19 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  uitlog: { color: C.muted, fontSize: 14, fontWeight: '600' },
  titel: { color: C.ink, fontSize: 27, fontWeight: '900', marginTop: 22, letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 6, marginBottom: 4 },
  kaart: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  label: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: C.veld, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    color: C.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  knop: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  knopHalf: { flex: 1, marginTop: 0 },
  knoppenRij: { flexDirection: 'row', gap: 12, marginTop: 18 },
  knopGroen: { backgroundColor: C.green },
  knopGroenT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  knopWit: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line },
  knopWitT: { color: C.ink, fontWeight: '800', fontSize: 16 },
  knopUit: { opacity: 0.5 },
  foutBox: { backgroundColor: C.redbg, borderRadius: 11, padding: 12, marginTop: 16 },
  foutT: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  okBox: { backgroundColor: C.okbg },
  okT: { color: C.greend },
  voet: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 26, opacity: 0.7 },
  telRij: { flexDirection: 'row', gap: 12, marginTop: 20 },
  telKnop: {
    flex: 1, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center', gap: 6,
  },
  telKnopAan: { borderColor: C.green, backgroundColor: 'rgba(16,185,129,0.08)' },
  telE: { fontSize: 30 },
  telT: { color: C.ink, fontSize: 15, fontWeight: '800' },
  telTAan: { color: C.greend },
  stapKop: { color: C.ink, fontSize: 14.5, fontWeight: '800', marginBottom: 12 },
  stapRij: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  stapN: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  stapNT: { color: '#fff', fontWeight: '900', fontSize: 13 },
  stapT: { flex: 1, color: C.ink, fontSize: 14.5, lineHeight: 21 },
  gidsLinkWrap: { marginTop: 16, alignItems: 'center', paddingVertical: 6 },
  gidsLink: { color: C.muted, fontSize: 14, fontWeight: '700' },
  klantNote: { color: C.green, fontSize: 13, fontWeight: '700', marginTop: 8 },
  saldoInfo: {
    backgroundColor: C.okbg, borderRadius: 12, padding: 14, marginTop: 14,
    alignItems: 'center',
  },
  saldoInfoLabel: { color: C.greend, fontSize: 13, fontWeight: '700' },
  saldoInfoT: { color: C.greend, fontSize: 26, fontWeight: '900', marginTop: 2 },
  scanOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 0,
    justifyContent: 'center', alignItems: 'center', padding: 28, gap: 20,
  },
  scanKader: {
    width: 240, height: 240, borderRadius: 24,
    borderWidth: 3, borderColor: C.green, backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  scanUitleg: { color: C.ink, fontSize: 15.5, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
  vIcoon: { color: '#fff', fontSize: 96, fontWeight: '900', lineHeight: 104 },
  vTitel: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  vKop: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  vTekst: { color: 'rgba(255,255,255,0.92)', fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 23 },
  vKnop: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 24, marginTop: 32, alignSelf: 'stretch', alignItems: 'center' },
  vKnopT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  vKlaar: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 15 },
  syncBalk: { backgroundColor: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.30)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  syncT: { color: '#0f766e', fontSize: 13, fontWeight: '700' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  presetKnop: {
    flexGrow: 1, flexBasis: '30%', minWidth: 92, backgroundColor: 'rgba(16,185,129,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.35)', borderRadius: 14,
    paddingVertical: 20, alignItems: 'center', justifyContent: 'center',
  },
  presetT: { color: C.greend, fontSize: 22, fontWeight: '900' },
})

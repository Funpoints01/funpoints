import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', coralD: '#E11D63', green: '#10B981',
  amber: '#F59E0B', violet: '#8B5CF6', violetD: '#6D28D9', line: 'rgba(36,27,58,0.10)',
}
const EMOJI: Record<string, string> = { lunapark: '🎡', schietkraam: '🎯', eendjes: '🦆', ander: '🎪' }
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
function dagMaand(iso: string): string { const [, m, d] = iso.split('-'); return `${parseInt(d, 10)} ${MAAND[parseInt(m, 10) - 1]}` }
function provVan(pc?: string | null): string | null {
  const n = parseInt(((pc || '').match(/\d+/g) || []).join(''), 10)
  if (!n) return null
  if (n <= 1299) return 'BRU'
  if (n <= 1499) return 'WBR'
  if (n <= 1999) return 'VBR'
  if (n <= 2999) return 'ANT'
  if (n <= 3499) return 'VBR'
  if (n <= 3999) return 'LIM'
  if (n <= 4999) return 'LIE'
  if (n <= 5999) return 'NAM'
  if (n <= 6599) return 'HEN'
  if (n <= 6999) return 'LUX'
  if (n <= 7999) return 'HEN'
  if (n <= 8999) return 'WVL'
  if (n <= 9999) return 'OVL'
  return null
}

type Kraam = {
  id: string; naam: string; soort: string; volgt: boolean
  huidig: { naam: string; plaats: string | null } | null
  volgend: { naam: string; plaats: string | null; van: string } | null
  inBuurt: boolean
}

export default function Kramen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  const [kramen, setKramen] = useState<Kraam[]>([])
  const [volgSet, setVolgSet] = useState<Set<string>>(new Set())
  const [isBez, setIsBez] = useState(false)
  const [laden, setLaden] = useState(true)
  const [filter, setFilter] = useState<'alle' | 'volgend'>('alle')

  useEffect(() => { herlaad() }, [])

  async function herlaad() {
    const vandaag = new Date().toISOString().slice(0, 10)
    const { data: { session } } = await supabase.auth.getSession()
    let bezProv: string | null = null
    let volg = new Set<string>()
    if (session) {
      const { data: bez } = await supabase.from('bezoeker').select('id, postcode').eq('auth_user_id', session.user.id).maybeSingle()
      if (bez) {
        setIsBez(true)
        bezProv = provVan(bez.postcode)
        const { data: v } = await supabase.from('kraam_volger').select('attractie_id')
        volg = new Set((v ?? []).map((r: any) => r.attractie_id))
      }
    }
    setVolgSet(volg)

    const [{ data: att }, { data: ka }, { data: kerm }] = await Promise.all([
      supabase.from('attractie_publiek').select('id, naam, soort').order('naam'),
      supabase.from('kermis_attractie').select('kermis_id, attractie_id'),
      supabase.from('kermis').select('id, naam, plaats, postcode, van, tot'),
    ])
    const kMap = new Map<string, any>((kerm ?? []).map((k: any) => [k.id, k]))
    const perAttr = new Map<string, any[]>()
    ;(ka ?? []).forEach((r: any) => {
      const k = kMap.get(r.kermis_id)
      if (!k) return
      const arr = perAttr.get(r.attractie_id) ?? []
      arr.push(k)
      perAttr.set(r.attractie_id, arr)
    })

    const lijst: Kraam[] = (att ?? []).map((a: any) => {
      const ks = (perAttr.get(a.id) ?? []).slice().sort((x, y) => String(x.van).localeCompare(String(y.van)))
      const huidig = ks.find((k) => k.van <= vandaag && k.tot >= vandaag) ?? null
      const volgend = ks.find((k) => k.van > vandaag) ?? null
      const ref = huidig ?? volgend
      const inBuurt = !!bezProv && !!ref && provVan(ref.postcode) === bezProv
      return {
        id: a.id, naam: a.naam, soort: a.soort, volgt: volg.has(a.id),
        huidig: huidig ? { naam: huidig.naam, plaats: huidig.plaats } : null,
        volgend: volgend ? { naam: volgend.naam, plaats: volgend.plaats, van: volgend.van } : null,
        inBuurt,
      }
    })
    setKramen(lijst)
    setLaden(false)
  }

  async function wisselVolg(attractieId: string) {
    const next = !volgSet.has(attractieId)
    setVolgSet((prev) => { const n = new Set(prev); if (next) n.add(attractieId); else n.delete(attractieId); return n })
    setKramen((prev) => prev.map((k) => k.id === attractieId ? { ...k, volgt: next } : k))
    await supabase.rpc('zet_kraam_volg', { p_attractie_id: attractieId, p_volg: next })
  }

  if (laden) return <View style={[s.scherm, s.center]}><ActivityIndicator color={C.violet} size="large" /></View>

  const gevolgd = kramen.filter((k) => volgSet.has(k.id))
  const favBuurt = gevolgd.filter((k) => k.inBuurt && (k.huidig || k.volgend))
  const zichtbaar = filter === 'volgend' ? kramen.filter((k) => volgSet.has(k.id)) : kramen

  function StatusLijn({ k }: { k: Kraam }) {
    if (k.huidig) return <Text style={[s.status, s.statusNu]}>🟢 Nu op {k.huidig.naam}</Text>
    if (k.volgend) return <Text style={s.status}>📅 {dagMaand(k.volgend.van)} · {k.volgend.plaats ?? k.volgend.naam}</Text>
    return <Text style={s.statusLeeg}>Nog niets gepland</Text>
  }

  function Rij({ k }: { k: Kraam }) {
    return (
      <Pressable style={s.rij} onPress={() => router.push(`/kraam/${k.id}`)}>
        <View style={s.rijIcon}><Text style={{ fontSize: 22 }}>{EMOJI[k.soort] ?? '🎪'}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.rijNaam}>{k.naam}</Text>
          <StatusLijn k={k} />
        </View>
        {isBez ? (
          <Pressable onPress={() => wisselVolg(k.id)} hitSlop={10} style={[s.hart, k.volgt && s.hartAan]}>
            <Text style={s.hartT}>{k.volgt ? '❤️' : '🤍'}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    )
  }

  return (
    <View style={s.scherm}>
      <ScrollView contentContainerStyle={wrapC}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/bezoeker'))} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>
        <Text style={s.paginaTitel}>🎪 Kramen</Text>

        <View style={s.hero}>
          <Text style={s.heroKick}>VOLG JE FAVORIETE KRAMEN</Text>
          <Text style={s.heroBig}>{gevolgd.length} {gevolgd.length === 1 ? 'kraam' : 'kramen'} die je volgt</Text>
          <Text style={s.heroSub}>{favBuurt.length} nu of binnenkort in de buurt</Text>
        </View>

        {favBuurt.length > 0 ? (
          <>
            <Text style={s.sectie}>❤️ Jouw favorieten in de buurt</Text>
            <View style={{ gap: 10 }}>
              {favBuurt.map((k) => (
                <Pressable key={k.id} style={s.favKaart} onPress={() => router.push(`/kraam/${k.id}`)}>
                  <View style={s.rijIcon}><Text style={{ fontSize: 22 }}>{EMOJI[k.soort] ?? '🎪'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rijNaam}>{k.naam}</Text>
                    {k.huidig
                      ? <Text style={[s.status, s.statusNu]}>🟢 Nu op {k.huidig.naam}</Text>
                      : <Text style={[s.status, s.statusBuurt]}>📍 Binnenkort: {k.volgend?.plaats ?? k.volgend?.naam} · {k.volgend ? dagMaand(k.volgend.van) : ''}</Text>}
                  </View>
                  <Text style={s.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={s.tabsRij}>
          <Pressable onPress={() => setFilter('alle')} style={[s.fTab, filter === 'alle' && s.fTabAan]}>
            <Text style={[s.fTabT, filter === 'alle' && s.fTabTAan]}>Alle kramen ({kramen.length})</Text>
          </Pressable>
          <Pressable onPress={() => setFilter('volgend')} style={[s.fTab, filter === 'volgend' && s.fTabAan]}>
            <Text style={[s.fTabT, filter === 'volgend' && s.fTabTAan]}>Ik volg ({gevolgd.length})</Text>
          </Pressable>
        </View>

        {zichtbaar.length === 0 ? (
          <View style={s.leeg}><Text style={s.leegT}>{filter === 'volgend' ? 'Je volgt nog geen kramen. Tik op het hartje bij een kraam.' : 'Nog geen kramen aangesloten.'}</Text></View>
        ) : (
          <View style={{ gap: 10 }}>
            {zichtbaar.map((k) => <Rij key={k.id} k={k} />)}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 22, paddingTop: 56, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 18 },
  paginaTitel: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginBottom: 12 },
  hero: {
    backgroundColor: C.violet, borderRadius: 20, padding: 20, overflow: 'hidden',
    shadowColor: C.violet, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  heroKick: { color: 'rgba(255,255,255,0.9)', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 },
  heroBig: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 6, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, fontWeight: '600', marginTop: 4 },
  sectie: { color: C.ink, fontSize: 17, fontWeight: '900', marginTop: 22, marginBottom: 12 },
  favKaart: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(251,113,133,0.4)',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13,
  },
  tabsRij: { flexDirection: 'row', gap: 8, marginTop: 22, marginBottom: 14 },
  fTab: { flex: 1, backgroundColor: C.veld, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  fTabAan: { backgroundColor: C.violet },
  fTabT: { color: C.muted, fontWeight: '800', fontSize: 13 },
  fTabTAan: { color: '#fff' },
  leeg: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 20 },
  leegT: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  rij: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  rijIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center' },
  rijNaam: { color: C.ink, fontSize: 16, fontWeight: '800' },
  status: { color: C.muted, fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  statusNu: { color: C.green },
  statusBuurt: { color: C.coralD },
  statusLeeg: { color: C.muted, fontSize: 12.5, marginTop: 3, opacity: 0.7 },
  hart: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  hartAan: { backgroundColor: 'rgba(251,113,133,0.14)' },
  hartT: { fontSize: 18 },
  chevron: { color: C.violet, fontSize: 26, fontWeight: '700' },
})

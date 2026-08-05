import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', coralD: '#E11D63', green: '#10B981',
  amber: '#F59E0B', violet: '#8B5CF6', line: 'rgba(36,27,58,0.10)',
}
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
function dagMaand(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MAAND[parseInt(m, 10) - 1]}`
}
function dagenTot(vanISO: string, vandaagISO: string): number {
  return Math.round((new Date(vanISO).getTime() - new Date(vandaagISO).getTime()) / 86400000)
}
// Provincie op basis van postcode (interim, zelfde mapping als de uitbaterkant).
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

type Status = 'actief' | 'binnenkort' | 'later' | 'voorbij'
type Item = {
  id: string; naam: string; plaats: string | null; van: string; tot: string
  kramen: number; gevolgd: number; status: Status; inBuurt: boolean
}
const FILTERS: { key: Status; label: string }[] = [
  { key: 'actief', label: '🟢 Nu actief' },
  { key: 'binnenkort', label: 'Binnenkort' },
  { key: 'later', label: 'Later' },
  { key: 'voorbij', label: 'Voorbij' },
]

export function KermisKalender({ postcode }: { postcode?: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [laden, setLaden] = useState(true)
  const [filter, setFilter] = useState<Status>('binnenkort')
  const [enkelBuurt, setEnkelBuurt] = useState(false)

  const bezProv = provVan(postcode)

  useEffect(() => {
    (async () => {
      const vandaag = new Date().toISOString().slice(0, 10)
      const [{ data: kerm }, { data: ka }, { data: volg }] = await Promise.all([
        supabase.from('kermis').select('id, naam, plaats, postcode, van, tot').order('van'),
        supabase.from('kermis_attractie').select('kermis_id, attractie_id'),
        supabase.from('kraam_volger').select('attractie_id'),
      ])
      const gevolgd = new Set((volg ?? []).map((r: any) => r.attractie_id))
      const perKermis = new Map<string, { totaal: number; gevolgd: number }>()
      ;(ka ?? []).forEach((r: any) => {
        const cur = perKermis.get(r.kermis_id) ?? { totaal: 0, gevolgd: 0 }
        cur.totaal += 1
        if (gevolgd.has(r.attractie_id)) cur.gevolgd += 1
        perKermis.set(r.kermis_id, cur)
      })

      const lijst: Item[] = (kerm ?? []).map((k: any) => {
        let status: Status
        if (k.tot < vandaag) status = 'voorbij'
        else if (k.van <= vandaag) status = 'actief'
        else status = dagenTot(k.van, vandaag) <= 45 ? 'binnenkort' : 'later'
        const kProv = provVan(k.postcode)
        const cnt = perKermis.get(k.id) ?? { totaal: 0, gevolgd: 0 }
        return {
          id: k.id, naam: k.naam, plaats: k.plaats, van: k.van, tot: k.tot,
          kramen: cnt.totaal, gevolgd: cnt.gevolgd, status,
          inBuurt: !!bezProv && !!kProv && bezProv === kProv,
        }
      })
      setItems(lijst)
      // Kies automatisch de eerste niet-lege tab.
      const heeft = (st: Status) => lijst.some((i) => i.status === st)
      setFilter(heeft('actief') ? 'actief' : heeft('binnenkort') ? 'binnenkort' : heeft('later') ? 'later' : 'voorbij')
      setLaden(false)
    })()
  }, [postcode])

  if (laden) return <View style={{ paddingVertical: 40 }}><ActivityIndicator color={C.coral} size="large" /></View>

  const jaar = new Date().getFullYear()
  const vandaag = new Date().toISOString().slice(0, 10)
  const basis = enkelBuurt ? items.filter((i) => i.inBuurt) : items
  const ditJaar = basis.filter((i) => i.van.slice(0, 4) === String(jaar) && i.status !== 'voorbij').length
  const komende30 = basis.filter((i) => i.status !== 'voorbij' && i.van > vandaag && dagenTot(i.van, vandaag) <= 30).length
  const zichtbaar = basis.filter((i) => i.status === filter)
    .sort((a, b) => filter === 'voorbij' ? b.van.localeCompare(a.van) : a.van.localeCompare(b.van))

  return (
    <View>
      <Text style={s.paginaTitel}>🎡 Kermis-kalender</Text>

      <View style={s.hero}>
        <Text style={s.heroKick}>{enkelBuurt && bezProv ? 'BIJ JOU IN DE BUURT' : 'ALLE KERMISSEN'}</Text>
        <Text style={s.heroBig}>{ditJaar} kermissen in {jaar}</Text>
        <Text style={s.heroSub}>{komende30} de komende 30 dagen</Text>
      </View>

      {bezProv ? (
        <View style={s.buurtRij}>
          <Pressable onPress={() => setEnkelBuurt(false)} style={[s.buurtChip, !enkelBuurt && s.buurtChipAan]}>
            <Text style={[s.buurtChipT, !enkelBuurt && s.buurtChipTAan]}>Heel België</Text>
          </Pressable>
          <Pressable onPress={() => setEnkelBuurt(true)} style={[s.buurtChip, enkelBuurt && s.buurtChipAan]}>
            <Text style={[s.buurtChipT, enkelBuurt && s.buurtChipTAan]}>📍 In mijn regio</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={s.tabsRij}>
        {FILTERS.map((f) => {
          const n = basis.filter((i) => i.status === f.key).length
          return (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[s.fTab, filter === f.key && s.fTabAan]}>
              <Text style={[s.fTabT, filter === f.key && s.fTabTAan]}>{f.label}</Text>
              <Text style={[s.fTabN, filter === f.key && s.fTabNAan]}>{n}</Text>
            </Pressable>
          )
        })}
      </View>

      {zichtbaar.length === 0 ? (
        <View style={s.leeg}><Text style={s.leegT}>Geen kermissen in deze categorie{enkelBuurt ? ' in jouw regio' : ''}.</Text></View>
      ) : (
        <View style={{ gap: 10 }}>
          {zichtbaar.map((k) => (
            <Pressable key={k.id} style={[s.kaart, k.status === 'actief' && s.kaartActief]} onPress={() => router.push(`/kermis/${k.id}`)}>
              <View style={s.kaartTop}>
                <View style={{ flex: 1 }}>
                  <View style={s.badgeRij}>
                    {k.status === 'actief' ? <Text style={[s.badge, s.badgeGroen]}>🟢 Nu actief</Text> : null}
                    {k.status === 'binnenkort' ? <Text style={[s.badge, s.badgeAmber]}>Binnenkort</Text> : null}
                    {k.inBuurt ? <Text style={[s.badge, s.badgeCoral]}>📍 In jouw regio</Text> : null}
                  </View>
                  <Text style={s.kaartNaam}>{k.naam}</Text>
                  <Text style={s.kaartSub}>
                    📅 {dagMaand(k.van)} – {dagMaand(k.tot)}{k.plaats ? ` · ${k.plaats}` : ''}
                  </Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </View>
              <View style={s.metaRij}>
                <Text style={s.meta}>🎪 {k.kramen} {k.kramen === 1 ? 'kraam' : 'kramen'}</Text>
                {k.gevolgd > 0 ? <Text style={[s.meta, s.metaVolg]}>❤️ {k.gevolgd} die je volgt</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  paginaTitel: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginBottom: 12 },
  hero: {
    backgroundColor: C.coral, borderRadius: 20, padding: 20, overflow: 'hidden',
    shadowColor: C.coral, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  heroKick: { color: 'rgba(255,255,255,0.9)', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 },
  heroBig: { color: '#fff', fontSize: 27, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, fontWeight: '600', marginTop: 4 },
  buurtRij: { flexDirection: 'row', gap: 8, marginTop: 14 },
  buurtChip: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  buurtChipAan: { backgroundColor: C.ink, borderColor: C.ink },
  buurtChipT: { color: C.muted, fontWeight: '800', fontSize: 13 },
  buurtChipTAan: { color: '#fff' },
  tabsRij: { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 14 },
  fTab: { flex: 1, backgroundColor: C.veld, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  fTabAan: { backgroundColor: C.coral },
  fTabT: { color: C.muted, fontWeight: '800', fontSize: 11.5, textAlign: 'center' },
  fTabTAan: { color: '#fff' },
  fTabN: { color: C.muted, fontWeight: '900', fontSize: 13, marginTop: 2 },
  fTabNAan: { color: '#fff' },
  leeg: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 20 },
  leegT: { color: C.muted, fontSize: 14, textAlign: 'center' },
  kaart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16 },
  kaartActief: { borderColor: C.green, borderWidth: 1.5, backgroundColor: 'rgba(16,185,129,0.04)' },
  kaartTop: { flexDirection: 'row', alignItems: 'center' },
  badgeRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  badge: { fontSize: 10.5, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  badgeGroen: { color: '#0E7C5A', backgroundColor: 'rgba(16,185,129,0.14)' },
  badgeAmber: { color: '#B45309', backgroundColor: 'rgba(245,158,11,0.16)' },
  badgeCoral: { color: C.coralD, backgroundColor: 'rgba(251,113,133,0.14)' },
  kaartNaam: { color: C.ink, fontSize: 16.5, fontWeight: '900' },
  kaartSub: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 3 },
  chevron: { color: C.coral, fontSize: 26, fontWeight: '700', marginLeft: 8 },
  metaRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  meta: { color: C.muted, fontSize: 12.5, fontWeight: '700' },
  metaVolg: { color: C.coralD },
})

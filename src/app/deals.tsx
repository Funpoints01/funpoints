import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { BottomNav } from '../components/BottomNav'
import { useT } from '../lib/i18n'

const C = {
  bg: '#FFF8F0', card: '#FFFFFF', veld: '#F4F1FA', ink: '#241B3A',
  muted: '#7A7290', coral: '#FB7185', coralD: '#E11D63', green: '#10B981',
  amber: '#F59E0B', violet: '#8B5CF6', line: 'rgba(36,27,58,0.10)',
}

type Actie = {
  id: string; attractie_id: string; titel: string; beschrijving: string | null; soort: string
  bonus_pct: number | null; bonus_modus: string | null; bonus_vast: number | null
  van: string; tot: string; boost_tot: string | null; eenmalig: boolean
  kraam: string; geboost: boolean; kermisIds: string[]
}
type Kermis = { id: string; naam: string }

const TYPES = [
  { key: 'alle', label: 'Alle' },
  { key: 'promo', label: 'Korting' },
  { key: 'bonus_punten', label: 'Extra punten' },
  { key: 'voucher', label: 'Vouchers' },
]

export default function Deals() {
  const router = useRouter()
  const { t } = useT()
  const insets = useSafeAreaInsets()
  const wrapC = [s.wrap, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]
  const [acties, setActies] = useState<Actie[]>([])
  const [kermissen, setKermissen] = useState<Kermis[]>([])
  const [laden, setLaden] = useState(true)
  const [kermisFilter, setKermisFilter] = useState<string>('alle')
  const [typeFilter, setTypeFilter] = useState<string>('alle')

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: act }, { data: att }, { data: kerm }, { data: ka }] = await Promise.all([
        supabase.rpc('zichtbare_acties'),
        supabase.from('attractie_publiek').select('id, naam'),
        supabase.from('kermis').select('id, naam, van, tot').gte('tot', today).order('van'),
        supabase.from('kermis_attractie').select('kermis_id, attractie_id'),
      ])
      const naamMap = new Map<string, string>((att ?? []).map((a: any) => [a.id, a.naam]))
      const geldig = new Set<string>((kerm ?? []).map((k: any) => k.id))
      const attrKermis = new Map<string, Set<string>>()
      ;(ka ?? []).forEach((r: any) => {
        if (!geldig.has(r.kermis_id)) return
        const set = attrKermis.get(r.attractie_id) ?? new Set<string>()
        set.add(r.kermis_id); attrKermis.set(r.attractie_id, set)
      })
      const nu = Date.now()
      const lijst: Actie[] = (act ?? []).map((x: any) => ({
        ...x,
        kraam: naamMap.get(x.attractie_id) ?? '',
        geboost: !!x.boost_tot && new Date(x.boost_tot).getTime() > nu,
        kermisIds: [...(attrKermis.get(x.attractie_id) ?? [])],
      })).sort((p: any, q: any) => (q.geboost ? 1 : 0) - (p.geboost ? 1 : 0) || String(p.van).localeCompare(String(q.van)))
      setActies(lijst)
      const metActie = new Set<string>()
      lijst.forEach((a) => a.kermisIds.forEach((k) => metActie.add(k)))
      setKermissen((kerm ?? []).filter((k: any) => metActie.has(k.id)).map((k: any) => ({ id: k.id, naam: k.naam })))
      setLaden(false)
    })()
  }, [])

  const zichtbaar = acties.filter((a) => {
    if (kermisFilter !== 'alle' && !a.kermisIds.includes(kermisFilter)) return false
    if (typeFilter === 'voucher' && !a.eenmalig) return false
    if ((typeFilter === 'promo' || typeFilter === 'bonus_punten') && a.soort !== typeFilter) return false
    return true
  })

  return (
    <View style={s.scherm}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={wrapC}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/bezoeker'))} hitSlop={12}><Text style={s.terug}>‹ Terug</Text></Pressable>
        <Text style={s.paginaTitel}>🔥 {t('Acties & deals')}</Text>

        <View style={s.hero}>
          <Text style={s.heroKick}>{t('ALLE ACTIES IN JE BUURT')}</Text>
          <Text style={s.heroBig}>{acties.length} {acties.length === 1 ? t('actie') : t('acties')}</Text>
          <Text style={s.heroSub}>{t('Filter op kermis of soort en mis niks.')}</Text>
        </View>

        {/* Type-filter */}
        <View style={s.typeRij}>
          {TYPES.map((ty) => (
            <Pressable key={ty.key} onPress={() => setTypeFilter(ty.key)} style={[s.typeTab, typeFilter === ty.key && s.typeTabAan]}>
              <Text style={[s.typeTabT, typeFilter === ty.key && s.typeTabTAan]}>{t(ty.label)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Kermis-filter */}
        {kermissen.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kermisRij}>
            <Pressable onPress={() => setKermisFilter('alle')} style={[s.kChip, kermisFilter === 'alle' && s.kChipAan]}>
              <Text style={[s.kChipT, kermisFilter === 'alle' && s.kChipTAan]}>{t('Alle kermissen')}</Text>
            </Pressable>
            {kermissen.map((k) => (
              <Pressable key={k.id} onPress={() => setKermisFilter(k.id)} style={[s.kChip, kermisFilter === k.id && s.kChipAan]}>
                <Text style={[s.kChipT, kermisFilter === k.id && s.kChipTAan]}>🎡 {k.naam}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {laden ? (
          <View style={{ paddingVertical: 40 }}><ActivityIndicator color={C.coral} size="large" /></View>
        ) : zichtbaar.length === 0 ? (
          <View style={s.leeg}><Text style={s.leegT}>{t('Geen acties gevonden voor deze filter.')}</Text></View>
        ) : (
          <View style={{ gap: 10, marginTop: 4 }}>
            {zichtbaar.map((a) => (
              <Pressable key={a.id} style={[s.actieKaart, a.geboost && s.actieBoost]} onPress={() => router.push(('/kraam/' + a.attractie_id) as any)}>
                {a.geboost ? <Text style={s.uitgelicht}>{t('⭐ UITGELICHT')}</Text> : null}
                <View style={s.actieBinnen}>
                  <View style={{ flex: 1 }}>
                    <View style={s.kraamChip}><Text style={s.kraamChipT}>🎪 {a.kraam}</Text></View>
                    <Text style={s.actieTitel}>{a.titel}</Text>
                    {a.beschrijving ? <Text style={s.actieDesc}>{a.beschrijving}</Text> : null}
                    {a.eenmalig ? <Text style={s.voucherTag}>{t('🎟️ Voucher — tik voor het kraam')}</Text> : null}
                  </View>
                  {a.eenmalig ? (
                    <View style={s.voucherChip}><Text style={s.voucherChipT}>{t('voucher')}</Text></View>
                  ) : a.soort === 'bonus_punten' && (a.bonus_modus === 'vast' ? a.bonus_vast : a.bonus_pct) ? (
                    <View style={s.bonusChip}><Text style={s.bonusChipT}>{a.bonus_modus === 'vast' ? `+${a.bonus_vast}` : `+${a.bonus_pct}%`}</Text></View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  )
}

const s = StyleSheet.create({
  scherm: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 22, paddingTop: 56, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center', flexGrow: 1 },
  terug: { color: C.muted, fontSize: 16, fontWeight: '600', marginBottom: 18 },
  paginaTitel: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginBottom: 12 },
  hero: {
    backgroundColor: C.coral, borderRadius: 20, padding: 20, overflow: 'hidden',
    shadowColor: C.coral, shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  heroKick: { color: 'rgba(255,255,255,0.9)', fontSize: 11.5, fontWeight: '900', letterSpacing: 1 },
  heroBig: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  typeRij: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 12 },
  typeTab: { flex: 1, backgroundColor: C.veld, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  typeTabAan: { backgroundColor: C.coral },
  typeTabT: { color: C.muted, fontWeight: '800', fontSize: 12 },
  typeTabTAan: { color: '#fff' },
  kermisRij: { gap: 8, paddingBottom: 14, paddingRight: 8 },
  kChip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  kChipAan: { backgroundColor: C.ink, borderColor: C.ink },
  kChipT: { color: C.muted, fontWeight: '800', fontSize: 13 },
  kChipTAan: { color: '#fff' },
  leeg: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 22, marginTop: 4 },
  leegT: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actieKaart: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16 },
  actieBoost: { borderColor: 'rgba(245,158,11,0.5)', borderWidth: 1.5 },
  uitgelicht: { color: C.amber, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  actieBinnen: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kraamChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(251,113,133,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
  kraamChipT: { color: C.coralD, fontSize: 11.5, fontWeight: '800' },
  actieTitel: { color: C.ink, fontSize: 16, fontWeight: '900' },
  actieDesc: { color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  voucherTag: { color: C.green, fontSize: 12, fontWeight: '800', marginTop: 6 },
  voucherChip: { backgroundColor: 'rgba(16,185,129,0.14)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  voucherChipT: { color: '#0E9E70', fontWeight: '900', fontSize: 12 },
  bonusChip: { backgroundColor: 'rgba(245,158,11,0.16)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bonusChipT: { color: '#B45309', fontWeight: '900', fontSize: 15 },
})

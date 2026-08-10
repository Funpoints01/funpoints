import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg'
import { BE_PROVINCIES, BE_GEWESTEN, BE_LAND } from '../lib/belgie'

// Zelfde projectie als de heatmap in beheer.tsx.
const LAT0 = 49.45, LAT1 = 51.55, LON0 = 2.5, LON1 = 6.45
const cosMid = Math.cos((50.5 * Math.PI) / 180)
const W = 640, pad = 14
const iW = W - 2 * pad
const iH = iW * ((LAT1 - LAT0) / ((LON1 - LON0) * cosMid))
const H = iH + 2 * pad
const px = (lon: number) => pad + ((lon - LON0) / (LON1 - LON0)) * iW
const py = (lat: number) => pad + ((LAT1 - lat) / (LAT1 - LAT0)) * iH

// Middelpunten (lat/lon) per provincie.
const CENTROID: Record<string, { lat: number; lon: number; naam: string }> = {
  ANT: { lat: 51.15, lon: 4.75, naam: 'Antwerpen' },
  OVL: { lat: 51.00, lon: 3.75, naam: 'Oost-Vlaanderen' },
  WVL: { lat: 51.05, lon: 3.05, naam: 'West-Vlaanderen' },
  VBR: { lat: 50.88, lon: 4.60, naam: 'Vlaams-Brabant' },
  LIM: { lat: 50.95, lon: 5.35, naam: 'Limburg' },
  BRU: { lat: 50.85, lon: 4.35, naam: 'Brussel' },
  WBR: { lat: 50.72, lon: 4.55, naam: 'Waals-Brabant' },
  HEN: { lat: 50.45, lon: 3.95, naam: 'Henegouwen' },
  NAM: { lat: 50.30, lon: 4.90, naam: 'Namen' },
  LIE: { lat: 50.55, lon: 5.75, naam: 'Luik' },
  LUX: { lat: 49.95, lon: 5.35, naam: 'Luxemburg' },
}

export type ProvAantal = { provincie: string; aantal: number }

export function SparersHeatmap({ data }: { data: ProvAantal[] }) {
  const { punten, totaal, top } = useMemo(() => {
    const rijen = (data ?? [])
      .filter((d) => CENTROID[d.provincie])
      .map((d) => ({ ...CENTROID[d.provincie], aantal: Number(d.aantal) || 0, code: d.provincie }))
    const tot = rijen.reduce((t, r) => t + r.aantal, 0)
    const gesorteerd = [...rijen].sort((a, b) => b.aantal - a.aantal)
    return { punten: rijen, totaal: tot, top: gesorteerd.slice(0, 3) }
  }, [data])

  const maxA = Math.max(1, ...punten.map((p) => p.aantal))

  return (
    <View>
      <View style={s.kaartVak}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          {BE_PROVINCIES.map((d, i) => <Path key={'p' + i} d={d} fill="#E7E3F1" stroke="#FFFFFF" strokeWidth={1} />)}
          {BE_GEWESTEN.map((d, i) => <Path key={'g' + i} d={d} fill="none" stroke="#D6CEEC" strokeWidth={1.4} strokeLinejoin="round" />)}
          <Path d={BE_LAND} fill="none" stroke="#B4A7DC" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {punten.map((p, i) => {
            if (!p.aantal) return null
            const rel = p.aantal / maxA
            const r = 7 + Math.sqrt(rel) * 20
            const x = px(p.lon), y = py(p.lat)
            return (
              <Circle key={'h' + i} cx={x} cy={y} r={r}
                fill="#FB7185" fillOpacity={0.35 + 0.45 * rel} stroke="#E11D63" strokeWidth={1} strokeOpacity={0.6} />
            )
          })}
          {punten.map((p, i) => {
            if (!p.aantal || p.aantal / maxA < 0.25) return null
            return (
              <SvgText key={'t' + i} x={px(p.lon)} y={py(p.lat) + 5} fontSize={20} fontWeight="900"
                fill="#7A1235" textAnchor="middle">{p.aantal}</SvgText>
            )
          })}
        </Svg>
      </View>
      {totaal === 0 ? (
        <Text style={s.leeg}>Nog geen sparers om te tonen. Zodra bezoekers punten sparen, verschijnen ze hier.</Text>
      ) : (
        <Text style={s.caption}>
          {totaal} sparer(s) uit {punten.filter((p) => p.aantal).length} provincie(s)
          {top.length ? ` · top: ${top.map((t) => `${t.naam} (${t.aantal})`).join(', ')}` : ''}
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  kaartVak: {
    width: '100%', aspectRatio: W / H, backgroundColor: '#FBFAFE', borderRadius: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(36,27,58,0.10)',
  },
  caption: { color: '#7A7290', fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  leeg: { color: '#7A7290', fontSize: 13, marginTop: 10 },
})

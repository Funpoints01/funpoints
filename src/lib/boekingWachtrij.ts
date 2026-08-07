// Offline-wachtrij voor puntenboekingen (fase 1 · sparen).
// Bewaart boekingen lokaal wanneer er geen netwerk is en synchroniseert
// ze dubbelvrij via de boek_batch-functie zodra er terug internet is.
//
// We gebruiken AsyncStorage: die werkt zowel in de web-PWA (localStorage,
// blijft bewaard na herstart) als in de native app, zonder extra dependency.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

const KEY = 'fp_boeking_wachtrij_v1'

export type Boeking = {
  client_id: string
  drager: 'kaartje' | 'bezoeker'
  code: string
  punten: number
  soort: 'toevoegen'
  geboekt_op: string
}

async function lees(): Promise<Boeking[]> {
  try {
    const s = await AsyncStorage.getItem(KEY)
    return s ? (JSON.parse(s) as Boeking[]) : []
  } catch {
    return []
  }
}

async function schrijf(lijst: Boeking[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(lijst))
}

// Uniek id per boeking = idempotentiesleutel. Voorkomt dubbele boekingen
// bij een hapering of dubbele sync.
export function nieuwId(): string {
  try {
    const c: any = (globalThis as any).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function voegToe(b: Boeking): Promise<void> {
  const lijst = await lees()
  lijst.push(b)
  await schrijf(lijst)
}

export async function aantal(): Promise<number> {
  return (await lees()).length
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && (navigator as any).onLine === false
}

// Stuurt de hele wachtrij naar de server. Geeft per gesynct client_id het
// nieuwe saldo terug. Boekingen die de server verwerkte (ok/dubbel/geweigerd)
// worden uit de wachtrij verwijderd; enkel wat de server nooit zag (netwerk-
// fout) blijft staan voor een volgende poging.
export async function flush(): Promise<{ gesynct: number; resterend: number; saldo: Record<string, number>; fout?: string }> {
  const lijst = await lees()
  if (lijst.length === 0) return { gesynct: 0, resterend: 0, saldo: {} }
  if (isOffline()) return { gesynct: 0, resterend: lijst.length, saldo: {} }

  const { data, error } = await supabase.rpc('boek_batch', { p_boekingen: lijst })
  // Online, maar de server gaf een fout: dit is géén offline-situatie maar een
  // echt probleem (bv. functie ontbreekt). Meld dat i.p.v. "geen internet".
  if (error) return { gesynct: 0, resterend: lijst.length, saldo: {}, fout: error.message }
  if (!data) return { gesynct: 0, resterend: lijst.length, saldo: {}, fout: 'Lege respons van de server.' }

  const details = ((data as any).details ?? []) as { client_id: string; status: string; saldo?: number }[]
  const afgehandeld = new Set(details.map((d) => d.client_id))
  const saldo: Record<string, number> = {}
  for (const d of details) {
    if (d.status === 'ok' && typeof d.saldo === 'number') saldo[d.client_id] = d.saldo
  }
  const rest = lijst.filter((b) => !afgehandeld.has(b.client_id))
  await schrijf(rest)
  return { gesynct: lijst.length - rest.length, resterend: rest.length, saldo }
}

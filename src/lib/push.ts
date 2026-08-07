// Funpoints · push-notificaties aan bezoekerskant (enkel web/PWA)
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Publieke VAPID-sleutel — veilig om in de client te zetten.
export const VAPID_PUBLIC =
  'BL0by1TRw9t9UGeBdUNS3tbyG72gp-0A36YKctxszH01HiKld5lTrTo7PvBKwy56sFiCumC8YwTy8DaPnm0ux3o'

export type PushStatus = 'aan' | 'uit' | 'geblokkeerd' | 'niet'

function base64ToUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushOndersteund(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

export async function pushStatus(): Promise<PushStatus> {
  if (!pushOndersteund()) return 'niet'
  if (Notification.permission === 'denied') return 'geblokkeerd'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub ? 'aan' : 'uit'
  } catch {
    return 'uit'
  }
}

export async function zetPushAan(): Promise<PushStatus> {
  if (!pushOndersteund()) return 'niet'
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'geblokkeerd'
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8(VAPID_PUBLIC),
    })
    const j: any = sub.toJSON()
    await supabase.rpc('save_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: j.keys?.p256dh,
      p_auth: j.keys?.auth,
    })
    return 'aan'
  } catch {
    return 'geblokkeerd'
  }
}

export async function zetPushUit(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      await supabase.rpc('verwijder_push_subscription', { p_endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
  } catch {
    /* stil */
  }
}

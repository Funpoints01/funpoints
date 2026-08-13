// Funpoints · native pushmeldingen (iOS/Android) via de Expo Push Service.
// Web gebruikt lib/push.ts (VAPID); dit bestand draait enkel op toestellen.
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

export type NativePushStatus = 'granted' | 'denied' | 'undetermined' | 'niet'

let handlersGezet = false

function projectId(): string | null {
  return (
    (Constants.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    null
  )
}

// Toon meldingen ook terwijl de app open is, en navigeer bij het tikken erop.
export function initNativePush(navigeer: (url: string) => void) {
  if (Platform.OS === 'web' || handlersGezet) return
  handlersGezet = true
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
  const pak = (data: any) => {
    const url = typeof data?.url === 'string' ? data.url : null
    if (url) navigeer(url)
  }
  // Koud opgestart via een melding?
  Notifications.getLastNotificationResponseAsync().then((r: any) => {
    if (r) pak(r.notification.request.content.data)
  })
  // Tik terwijl de app draait.
  Notifications.addNotificationResponseReceivedListener((r: any) => {
    pak(r.notification.request.content.data)
  })
}

export async function nativePushStatus(): Promise<NativePushStatus> {
  if (Platform.OS === 'web') return 'niet'
  try {
    const { status } = await Notifications.getPermissionsAsync()
    return status as NativePushStatus
  } catch {
    return 'niet'
  }
}

// Vraagt indien nodig toestemming en registreert de push-token.
// Geeft de eindstatus terug (voor de rode nudge-balk).
export async function vraagNativePush(): Promise<NativePushStatus> {
  if (Platform.OS === 'web') return 'niet'
  try {
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status
    }
    if (status !== 'granted') return status as NativePushStatus
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Meldingen',
        importance: Notifications.AndroidImportance.MAX,
      })
    }
    if (Device.isDevice) await registreerToken()
    return 'granted'
  } catch {
    return 'niet'
  }
}

async function registreerToken() {
  const pid = projectId()
  if (!pid) return
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data
  await supabase.rpc('save_push_token', { p_token: token, p_platform: Platform.OS })
}

export async function zetNativePushUit() {
  if (Platform.OS === 'web') return
  try {
    const pid = projectId()
    if (!pid) return
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data
    await supabase.rpc('verwijder_push_token', { p_token: token })
  } catch {
    /* stil */
  }
}

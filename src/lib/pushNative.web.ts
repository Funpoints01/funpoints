// Funpoints · web-stub voor native push. Op web regelt lib/push.ts de meldingen,
// dus deze functies doen niets. (Metro kiest dit bestand op web.)
export type NativePushStatus = 'granted' | 'denied' | 'undetermined' | 'niet'
export function initNativePush(_navigeer: (url: string) => void) {}
export async function nativePushStatus(): Promise<NativePushStatus> { return 'niet' }
export async function vraagNativePush(): Promise<NativePushStatus> { return 'niet' }
export async function zetNativePushUit(): Promise<void> {}

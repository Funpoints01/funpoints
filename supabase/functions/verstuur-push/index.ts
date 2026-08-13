// Funpoints · Edge Function "verstuur-push"
// Verstuurt de push-notificatie van een campagne naar alle bereikbare bezoekers.
//
// Deploy:  supabase functions deploy verstuur-push
// Secrets: supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:info@funpoints.be
// (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch geïnjecteerd.)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { campagne_id } = await req.json()
    if (!campagne_id) return json({ error: 'GEEN_CAMPAGNE' }, 400)

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: camp } = await supa
      .from('push_campagne')
      .select('id, actie_id, verzonden_op')
      .eq('id', campagne_id)
      .maybeSingle()
    if (!camp) return json({ error: 'ONBEKEND' }, 404)
    if (camp.verzonden_op) return json({ status: 'al_verzonden' })

    const { data: actie } = await supa
      .from('actie')
      .select('titel, beschrijving, soort, bonus_pct, bonus_modus, bonus_vast, attractie_id')
      .eq('id', camp.actie_id)
      .maybeSingle()

    // Kraamnaam erbij halen voor een persoonlijke boodschap.
    let kraam = ''
    if (actie?.attractie_id) {
      const { data: at } = await supa
        .from('attractie')
        .select('naam')
        .eq('id', actie.attractie_id)
        .maybeSingle()
      kraam = at?.naam || ''
    }

    // Bouw een aantrekkelijke boodschap, bv.
    // "Geniet nu van 10% extra punten bij Eendjeskraam Ghysels".
    const bonusTekst = (() => {
      if (actie?.soort !== 'bonus_punten') return null
      if (actie?.bonus_modus === 'vast' && actie?.bonus_vast) return `${actie.bonus_vast} extra punten`
      if (actie?.bonus_pct) return `${actie.bonus_pct}% extra punten`
      return null
    })()
    const pushTitle = kraam ? `\uD83C\uDF89 ${kraam}` : (actie?.titel || 'Funpoints')
    const pushBody = bonusTekst
      ? (kraam ? `Geniet nu van ${bonusTekst} bij ${kraam}!` : `Geniet nu van ${bonusTekst}!`)
      : (actie?.beschrijving
          || (kraam ? `Er is een nieuwe actie bij ${kraam}!` : 'Er is een nieuwe actie voor jou!'))

    const { data: subs } = await supa.rpc('campagne_ontvangers', { p_campagne_id: campagne_id })

    try {
      webpush.setVapidDetails(
        Deno.env.get('VAPID_SUBJECT') || 'mailto:info@funpoints.be',
        Deno.env.get('VAPID_PUBLIC')!,
        Deno.env.get('VAPID_PRIVATE')!,
      )
    } catch (e) {
      await supa.rpc('campagne_terugbetaal', { p_campagne_id: campagne_id })
      return json({ error: 'PUSH_NIET_GECONFIGUREERD: ' + String(e), terugbetaald: true }, 500)
    }

    const payload = JSON.stringify({
      title: pushTitle,
      body: pushBody,
      url: '/bezoeker',
    })

    let ok = 0
    let mislukt = 0

    // 1) Web-push (browser / PWA op het beginscherm)
    for (const s of (subs ?? []).filter((r: any) => r.kanaal === 'web' || r.kanaal == null)) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        ok++
      } catch (e: any) {
        mislukt++
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supa.from('push_subscription').delete().eq('endpoint', s.endpoint)
        }
      }
    }

    // 2) Native push (iOS/Android) via de Expo Push Service.
    const expoTokens = (subs ?? [])
      .filter((r: any) => r.kanaal === 'expo' && r.token)
      .map((r: any) => r.token as string)
    for (let i = 0; i < expoTokens.length; i += 100) {
      const batch = expoTokens.slice(i, i + 100)
      const messages = batch.map((to: string) => ({
        to,
        title: pushTitle,
        body: pushBody,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        data: { url: '/bezoeker' },
      }))
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(messages),
        })
        const j = await res.json().catch(() => ({}))
        const tickets = Array.isArray(j?.data) ? j.data : []
        for (let k = 0; k < batch.length; k++) {
          const t = tickets[k]
          if (t?.status === 'ok') {
            ok++
          } else {
            mislukt++
            if (t?.details?.error === 'DeviceNotRegistered') {
              await supa.from('push_token').delete().eq('token', batch[k])
            }
          }
        }
      } catch (_e) {
        mislukt += batch.length
      }
    }

    if (ok === 0) {
      // Niets afgeleverd (bv. enkel verlopen endpoints) → credits terugzetten.
      await supa.rpc('campagne_terugbetaal', { p_campagne_id: campagne_id })
      return json({ status: 'niets_verzonden', verzonden: 0, mislukt, terugbetaald: true })
    }

    await supa
      .from('push_campagne')
      .update({ verzonden_op: new Date().toISOString(), verzonden_aantal: ok })
      .eq('id', campagne_id)

    return json({ status: 'ok', verzonden: ok, mislukt })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

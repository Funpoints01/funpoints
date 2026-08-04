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
      .select('titel, beschrijving')
      .eq('id', camp.actie_id)
      .maybeSingle()

    const { data: subs } = await supa.rpc('campagne_ontvangers', { p_campagne_id: campagne_id })

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:info@funpoints.be',
      Deno.env.get('VAPID_PUBLIC')!,
      Deno.env.get('VAPID_PRIVATE')!,
    )

    const payload = JSON.stringify({
      title: actie?.titel || 'Funpoints',
      body: actie?.beschrijving || 'Er is een nieuwe actie voor jou!',
      url: '/bezoeker',
    })

    let ok = 0
    let mislukt = 0
    for (const s of subs ?? []) {
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

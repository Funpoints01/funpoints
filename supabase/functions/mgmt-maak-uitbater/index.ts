// Funpoints · Edge Function "mgmt-maak-uitbater"
// Laat ENKEL managers een uitbater-account aanmaken (auth-gebruiker + uitbater-rij)
// met een gekozen pakket. Draait met de service-role sleutel, maar controleert
// eerst of de aanroeper effectief een manager is.
//
// Deploy:  supabase functions deploy mgmt-maak-uitbater
// (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch geïnjecteerd.)

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!jwt) return json({ error: 'GEEN_AUTH' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1) Wie roept aan? Verifieer de sessie en check of het een manager is.
    const { data: caller, error: uerr } = await admin.auth.getUser(jwt)
    if (uerr || !caller?.user) return json({ error: 'ONGELDIGE_SESSIE' }, 401)
    const { data: mgr } = await admin
      .from('manager').select('auth_user_id')
      .eq('auth_user_id', caller.user.id).maybeSingle()
    if (!mgr) return json({ error: 'NIET_GEMACHTIGD' }, 403)

    // 2) Input valideren.
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const wachtwoord = String(body.wachtwoord || '')
    const naam = String(body.naam || '').trim()
    const pakket = String(body.pakket || '')
    const maxA = Number.isFinite(body.max_attracties)
      ? Math.max(1, Math.floor(body.max_attracties))
      : (pakket === 'start' ? 1 : 2)
    if (!email || !wachtwoord || !naam) return json({ error: 'ONVOLLEDIG' }, 400)
    if (wachtwoord.length < 8) return json({ error: 'WACHTWOORD_TE_KORT' }, 400)
    if (pakket !== 'start' && pakket !== 'volledig') return json({ error: 'ONGELDIG_PAKKET' }, 400)

    // 3) Auth-gebruiker aanmaken (meteen bevestigd, kan direct inloggen).
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, password: wachtwoord, email_confirm: true,
    })
    if (cerr || !created?.user) return json({ error: 'AANMAKEN_MISLUKT: ' + (cerr?.message || '') }, 400)

    // 4) Uitbater-rij met pakket. Bij falen: auth-gebruiker terugdraaien.
    const { error: ierr } = await admin.from('uitbater').insert({
      auth_user_id: created.user.id, naam,
      pakket, max_attracties: maxA, status: 'proef', credits: 0,
    })
    if (ierr) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
      return json({ error: 'PROFIEL_MISLUKT: ' + ierr.message }, 400)
    }

    return json({ status: 'ok', email, pakket, max_attracties: maxA })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

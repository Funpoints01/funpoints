// Funpoints · Edge Function "mgmt-maak-uitbater"
// Laat ENKEL managers een uitbater aanmaken. De uitbater krijgt een
// uitnodiging per e-mail (via de ingestelde SMTP = Brevo) en kiest zélf
// zijn wachtwoord; het management kent het wachtwoord dus niet.
//
// Deploy:  supabase functions deploy mgmt-maak-uitbater

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const REDIRECT = 'https://app.funpoints.be/herstel'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!jwt) return json({ error: 'GEEN_AUTH' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1) Wie roept aan? Moet een manager zijn.
    const { data: caller, error: uerr } = await admin.auth.getUser(jwt)
    if (uerr || !caller?.user) return json({ error: 'ONGELDIGE_SESSIE' }, 401)
    const { data: mgr } = await admin
      .from('manager').select('auth_user_id')
      .eq('auth_user_id', caller.user.id).maybeSingle()
    if (!mgr) return json({ error: 'NIET_GEMACHTIGD' }, 403)

    // 2) Input valideren (geen wachtwoord meer).
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const naam = String(body.naam || '').trim()
    const pakket = String(body.pakket || '')
    const maxA = Number.isFinite(body.max_attracties)
      ? Math.max(1, Math.floor(body.max_attracties))
      : (pakket === 'start' ? 1 : 2)
    if (!email || !naam) return json({ error: 'ONVOLLEDIG' }, 400)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'ONGELDIGE_MAIL' }, 400)
    if (pakket !== 'start' && pakket !== 'volledig') return json({ error: 'ONGELDIG_PAKKET' }, 400)

    // 3) Uitnodiging versturen (maakt de auth-gebruiker aan + mailt de link).
    const { data: inv, error: ierr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { rol: 'uitbater' },
      redirectTo: REDIRECT,
    })
    if (ierr || !inv?.user) {
      const msg = (ierr?.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered')) {
        return json({ error: 'MAIL_BESTAAT_AL' }, 409)
      }
      return json({ error: 'UITNODIGEN_MISLUKT: ' + (ierr?.message || '') }, 400)
    }

    // 4) Uitbater-rij met pakket. Bij falen: uitgenodigde gebruiker terugdraaien.
    const { error: perr } = await admin.from('uitbater').insert({
      auth_user_id: inv.user.id, naam,
      pakket, max_attracties: maxA, status: 'proef', credits: 0,
    })
    if (perr) {
      await admin.auth.admin.deleteUser(inv.user.id).catch(() => {})
      return json({ error: 'PROFIEL_MISLUKT: ' + perr.message }, 400)
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

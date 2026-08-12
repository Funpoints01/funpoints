// Funpoints · Edge Function "foorkramer-uitnodigen"
// Laat ENKEL een uitbater een foorkramer uitnodigen voor één van zijn
// eigen kramen. Stuurt een uitnodigingsmail (via de ingestelde SMTP =
// Brevo) waarmee de foorkramer zélf zijn wachtwoord instelt. De uitbater
// kent het wachtwoord dus niet.
//
// Deploy:  supabase functions deploy foorkramer-uitnodigen
// (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch geïnjecteerd.)

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

    // 1) Wie roept aan? Moet een uitbater zijn.
    const { data: caller, error: uerr } = await admin.auth.getUser(jwt)
    if (uerr || !caller?.user) return json({ error: 'ONGELDIGE_SESSIE' }, 401)
    const { data: uit } = await admin
      .from('uitbater').select('id')
      .eq('auth_user_id', caller.user.id).maybeSingle()
    if (!uit) return json({ error: 'NIET_GEMACHTIGD' }, 403)

    // 2) Input.
    const body = await req.json().catch(() => ({}))
    const attractieId = String(body.attractie_id || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const naam = String(body.naam || '').trim() || null
    if (!attractieId || !email) return json({ error: 'ONVOLLEDIG' }, 400)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'ONGELDIGE_MAIL' }, 400)

    // 3) Is dit kraam van deze uitbater?
    const { data: attr } = await admin
      .from('attractie').select('id')
      .eq('id', attractieId).eq('uitbater_id', uit.id).maybeSingle()
    if (!attr) return json({ error: 'NIET_JOUW_KRAAM' }, 403)

    // 4) Gebruik je je eigen adres? Dan hoort dit bij "ik sta zelf in het kraam".
    if (email === (caller.user.email || '').toLowerCase()) {
      return json({ error: 'EIGEN_ADRES' }, 400)
    }

    // 5) Uitnodiging versturen (maakt de auth-gebruiker aan + mailt de link).
    const { data: inv, error: ierr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { rol: 'foorkramer' },
      redirectTo: REDIRECT,
    })
    if (ierr || !inv?.user) {
      const msg = (ierr?.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered')) {
        return json({ error: 'MAIL_BESTAAT_AL' }, 409)
      }
      return json({ error: 'UITNODIGEN_MISLUKT: ' + (ierr?.message || '') }, 400)
    }

    // 6) Foorkramer-rij koppelen. Bij falen: uitgenodigde gebruiker terugdraaien.
    const { error: ferr } = await admin.from('foorkramer').insert({
      uitbater_id: uit.id, attractie_id: attractieId, auth_user_id: inv.user.id,
      email, naam, status: 'uitgenodigd',
    })
    if (ferr) {
      await admin.auth.admin.deleteUser(inv.user.id).catch(() => {})
      return json({ error: 'KOPPELEN_MISLUKT: ' + ferr.message }, 400)
    }

    return json({ status: 'ok', email })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

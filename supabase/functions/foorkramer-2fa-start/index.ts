// Funpoints · Edge Function "foorkramer-2fa-start"
// Stuurt een 6-cijfer inlogcode naar de foorkramer per e-mail (via Brevo)
// en bewaart de hash + vervaldatum op de foorkramer-rij. De code zelf
// verlaat dus nooit de server in leesbare vorm buiten de mail.
//
// Vereist secret:  supabase secrets set BREVO_API_KEY=...
// Deploy:          supabase functions deploy foorkramer-2fa-start

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
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
    const { data: caller, error: uerr } = await admin.auth.getUser(jwt)
    if (uerr || !caller?.user) return json({ error: 'ONGELDIGE_SESSIE' }, 401)

    const { data: fk } = await admin
      .from('foorkramer').select('id, email')
      .eq('auth_user_id', caller.user.id).eq('status', 'actief').maybeSingle()
    if (!fk) return json({ error: 'GEEN_FOORKRAMER' }, 403)

    // 6-cijfercode, cryptografisch willekeurig.
    const n = new Uint32Array(1); crypto.getRandomValues(n)
    const code = String(n[0] % 1000000).padStart(6, '0')
    const hash = await sha256hex(code + fk.id)

    const { error: uperr } = await admin.from('foorkramer').update({
      otp_hash: hash,
      otp_exp: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      otp_pogingen: 0,
    }).eq('id', fk.id)
    if (uperr) return json({ error: 'OPSLAAN_MISLUKT' }, 500)

    // Mailen via Brevo.
    const key = Deno.env.get('BREVO_API_KEY')
    if (!key) return json({ error: 'GEEN_BREVO_KEY' }, 500)
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Funpoints', email: 'noreply@funpoints.be' },
        to: [{ email: fk.email }],
        subject: 'Je Funpoints inlogcode',
        htmlContent:
          `<div style="font-family:sans-serif">` +
          `<p>Je inlogcode voor Funpoints:</p>` +
          `<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>` +
          `<p>De code is 10 minuten geldig. Heb jij niet ingelogd? Negeer deze mail.</p></div>`,
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return json({ error: 'MAIL_MISLUKT: ' + t.slice(0, 200) }, 502)
    }
    return json({ status: 'ok' })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

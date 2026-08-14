import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { supabase } from '../lib/supabase'

// Toont een rode melding aan de uitbater wanneer zijn abonnement door het
// beheer op "gepauzeerd" is gezet (openstaande factuur). Puur administratief:
// de app blijft gewoon werken, dit is enkel een aansporing om te betalen.
export default function FactuurBanner() {
  const [toon, setToon] = useState(false)

  useEffect(() => {
    let levend = true
    ;(async () => {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user?.id
      if (!uid) return
      const { data } = await supabase
        .from('uitbater')
        .select('gepauzeerd')
        .eq('auth_user_id', uid)
        .maybeSingle()
      if (levend) setToon(((data as any)?.gepauzeerd ?? false) === true)
    })()
    return () => {
      levend = false
    }
  }, [])

  if (!toon) return null
  return (
    <View style={s.wrap}>
      <Text style={s.titel}>Openstaande factuur</Text>
      <Text style={s.tekst}>
        Er staat nog een factuur open voor je Funpoints-abonnement. Gelieve deze
        zo snel mogelijk te betalen. Heb je vragen of denk je dat dit niet klopt?
        Neem gerust contact met ons op.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(225,29,72,0.10)',
    borderColor: '#E11D48',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 4,
  },
  titel: { color: '#E11D48', fontWeight: '800', fontSize: 15 },
  tekst: { color: '#241B3A', fontSize: 13, lineHeight: 18 },
})

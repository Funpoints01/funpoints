import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'

// Native-versie: opent de OS-datumkiezer van iOS/Android.
// Waarde in/uit is altijd ISO 'JJJJ-MM-DD'.

function toonNL(iso: string): string {
  if (!iso) return ''
  const [j, m, d] = iso.split('-')
  return `${d}-${m}-${j}`
}

function naarISO(date: Date): string {
  const j = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${j}-${m}-${d}`
}

export function DatumVeld({ value, onChange, toekomst, vrij, placeholder }: { value: string; onChange: (iso: string) => void; toekomst?: boolean; vrij?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const huidig = value ? new Date(value + 'T00:00:00') : ((toekomst || vrij) ? new Date() : new Date(2005, 0, 1))

  return (
    <View>
      <Pressable style={s.veld} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? '#241B3A' : '#7A7290', fontSize: 16 }}>
          {value ? toonNL(value) : (placeholder ?? 'Kies een datum')}
        </Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={huidig}
          mode="date"
          {...(vrij ? {} : toekomst ? { minimumDate: new Date() } : { maximumDate: new Date() })}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setOpen(false)
            if (event.type === 'set' && date) onChange(naarISO(date))
            if (event.type === 'dismissed') setOpen(false)
          }}
        />
      ) : null}

      {Platform.OS === 'ios' && open ? (
        <Pressable onPress={() => setOpen(false)} style={s.klaar}>
          <Text style={s.klaarT}>Klaar</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  veld: {
    backgroundColor: '#F4F1FA', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(36,27,58,0.10)', paddingHorizontal: 14, paddingVertical: 14,
  },
  klaar: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 6, marginTop: 2 },
  klaarT: { color: '#FB7185', fontWeight: '800', fontSize: 14 },
})

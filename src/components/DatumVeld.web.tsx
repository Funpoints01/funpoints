import React from 'react'

// Web-versie: gebruikt de ingebouwde datumkiezer van de browser (<input type="date">).
// Waarde in/uit is altijd ISO 'JJJJ-MM-DD'.
export function DatumVeld({ value, onChange, toekomst, placeholder }: { value: string; onChange: (iso: string) => void; toekomst?: boolean; placeholder?: string }) {
  const vandaag = new Date().toISOString().slice(0, 10)
  return React.createElement('input', {
    type: 'date',
    value,
    ...(toekomst ? { min: vandaag } : { max: vandaag }),
    'aria-label': placeholder ?? 'Datum',
    onChange: (e: any) => onChange(e.target.value),
    style: {
      backgroundColor: '#F4F1FA',
      borderRadius: 12,
      border: '1px solid rgba(36,27,58,0.10)',
      color: value ? '#241B3A' : '#7A7290',
      fontSize: 16,
      padding: '13px 14px',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      outline: 'none',
    },
  })
}

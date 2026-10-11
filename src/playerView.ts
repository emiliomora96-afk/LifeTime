import type { Phase } from './players'

export const PHASES: Record<Phase, { label: string; cls: string }> = {
  crece: { label: '↗ Crece', cls: 'phase-up' },
  pico: { label: '→ En su pico', cls: 'phase-peak' },
  declive: { label: '↘ En declive', cls: 'phase-down' },
}

export function gainLabel(gain: number | undefined): string {
  if (gain === undefined) return '—'
  if (gain > 0) return `▲ +${gain}`
  if (gain < 0) return `▼ ${gain}`
  return '='
}

export function gainClass(gain: number | undefined): string {
  if (gain === undefined || gain === 0) return 'phase-peak'
  return gain > 0 ? 'phase-up' : 'phase-down'
}

// Color de la valoración: dorado para estrellas, verde para muy buenos, azul para buenos
export function ratingColor(rating: number): string {
  if (rating >= 85) return '#fbbf24'
  if (rating >= 75) return '#22c55e'
  if (rating >= 65) return '#60a5fa'
  return '#94a3b8'
}

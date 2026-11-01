import type { Phase } from './players'
import { auraOf } from './aura'

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

// Cambio de valoración de la última temporada, al estilo FIFA: "+2" en verde o "-1" en rojo (nada si no cambió)
export function deltaText(gain: number | undefined): string {
  if (gain === undefined || gain === 0) return ''
  return gain > 0 ? `+${gain}` : `-${Math.abs(gain)}`
}

export function deltaClass(gain: number | undefined): string {
  return 'delta ' + (gain !== undefined && gain > 0 ? 'up' : 'down')
}

// Color de la valoración: el mismo que el del aura (tramos y colores en aura.ts)
export function ratingColor(rating: number): string {
  return auraOf(rating).color
}

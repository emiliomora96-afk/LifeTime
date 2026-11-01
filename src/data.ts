import type { CrestShape } from './types'

export const SAVE_KEY = 'lifetime-club'
export const LEAGUE = 'España'
export const START_DIVISION = 2
// Presupuesto con el que empieza el club
export const START_BUDGET = 15_000_000

export const COLOR_PRESETS = [
  { name: 'Rojo y blanco', primary: '#c62828', secondary: '#ffffff' },
  { name: 'Azul y blanco', primary: '#1d4ed8', secondary: '#ffffff' },
  { name: 'Verde y blanco', primary: '#15803d', secondary: '#ffffff' },
  { name: 'Amarillo y azul', primary: '#facc15', secondary: '#1e3a8a' },
  { name: 'Negro y rojo', primary: '#111111', secondary: '#dc2626' },
  { name: 'Celeste y blanco', primary: '#38bdf8', secondary: '#ffffff' },
  { name: 'Granate y dorado', primary: '#7f1d1d', secondary: '#fbbf24' },
]

export const CREST_SHAPES: { id: CrestShape; label: string }[] = [
  { id: 'classic', label: 'Clásico' },
  { id: 'round', label: 'Redondo' },
  { id: 'modern', label: 'Moderno' },
]

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}
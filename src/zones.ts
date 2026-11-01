import type { Level } from './engine'
import { qualifyFor } from './europe'

export type Zone = 'champions' | 'europa' | 'conferencia' | 'up' | 'down'

// Color de cada zona: es el mismo en la barra de la izquierda, en el número de posición y en la leyenda de abajo
export const ZONE_COLOR: Record<Zone, string> = {
  champions: '#3b82f6', // azul
  europa: '#f59e0b', // naranja
  conferencia: '#14b8a6', // turquesa
  up: '#22c55e', // verde
  down: '#ef4444', // rojo
}

export function zoneOf(level: Level, i: number): Zone | null {
  if (level === 1) {
    const q = qualifyFor(i + 1)
    if (q) return q
    if (i >= 17) return 'down'
  } else {
    if (i < 3) return 'up'
    if (i >= 17) return 'down'
  }
  return null
}

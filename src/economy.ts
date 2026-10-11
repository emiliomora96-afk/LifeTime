import type { Level } from './engine'

// Cifras provisorias: se ajustan en el balance (Paso 11)
// Personal del club (no jugadores). Los sueldos de los jugadores salen de la plantilla.
export const STAFF_COST_BY_DIVISION: Record<Level, number> = { 1: 1_500_000, 2: 300_000 }
export const TICKETS_BASE: Record<Level, number> = { 1: 1_500_000, 2: 600_000 }
export const TICKETS_PER_STADIUM_LEVEL: Record<Level, number> = { 1: 200_000, 2: 100_000 }
export const SPONSOR_BASE: Record<Level, number> = { 1: 1_200_000, 2: 600_000 }
export const SPONSOR_PER_PRESTIGE = 15_000
export const TV_RIGHTS: Record<Level, number> = { 1: 3_000_000, 2: 700_000 }
export const OTHER_INCOME: Record<Level, number> = { 1: 300_000, 2: 200_000 }
export const POSITION_PRIZE_STEP: Record<Level, number> = { 1: 100_000, 2: 25_000 }

// Premio por ganar el título de liga: cifras por definir
export const LEAGUE_TITLE_PRIZE: Record<Level, number> = { 1: 2_000_000, 2: 300_000 }

export const START_PRESTIGE = 10
export const PRESTIGE_MIN = 0
export const PRESTIGE_MAX = 100

// Cuánto sube o baja el prestigio al cerrar la temporada
export function prestigeChange(o: {
  promoted: boolean
  relegated: boolean
  champion: boolean
  position: number
}): number {
  let change = 0
  if (o.promoted) change += 4
  if (o.relegated) change -= 4
  if (o.champion) change += 3
  if (o.position <= 5) change += 1
  else if (o.position >= 16) change -= 1
  return change
}

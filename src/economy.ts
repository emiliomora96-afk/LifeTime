import type { Level } from './engine'

// Cifras provisorias: se ajustan en el balance (Paso 11)
// Personal del club (no jugadores). Los sueldos de los jugadores salen de la plantilla.
export const STAFF_COST_BY_DIVISION: Record<Level, number> = { 1: 4_500_000, 2: 900_000 }
export const TICKETS_BASE: Record<Level, number> = { 1: 4_500_000, 2: 1_800_000 }
export const TICKETS_PER_STADIUM_LEVEL: Record<Level, number> = { 1: 600_000, 2: 300_000 }
export const SPONSOR_BASE: Record<Level, number> = { 1: 3_600_000, 2: 1_800_000 }
export const SPONSOR_PER_PRESTIGE = 70_000 // sube con el Val de las plantillas: un club de prestigio alto vive de patrocinios
export const TV_RIGHTS: Record<Level, number> = { 1: 11_000_000, 2: 2_700_000 }
export const OTHER_INCOME: Record<Level, number> = { 1: 900_000, 2: 600_000 }
export const POSITION_PRIZE_STEP: Record<Level, number> = { 1: 300_000, 2: 75_000 }

// Premio por ganar el título de liga: cifras por definir
export const LEAGUE_TITLE_PRIZE: Record<Level, number> = { 1: 6_000_000, 2: 900_000 }

/* ---------- Copas nacionales ----------
   Cifras a escala del juego. En la vida real el campeón de la Copa del Rey se lleva en torno a 1,2 M€
   entre premios por eliminatoria y taquilla, y la Supercopa paga mucho más que la Copa por el simple hecho de jugarla.
   Todo se ajusta aquí. */
export const COPA_PARTICIPATION = 30_000 // por jugar la Copa
// Premio por ganar cada eliminatoria (ganar la final es el premio del campeón)
export const COPA_ROUND_PRIZE: Record<'r64' | 'r32' | 'r16' | 'qf' | 'sf' | 'final', number> = {
  r64: 45_000,
  r32: 90_000,
  r16: 180_000,
  qf: 360_000,
  sf: 750_000,
  final: 1_800_000,
}
// Taquilla de cada partido de Copa en tu estadio (sube si recibes a un club de 1.ª)
export const COPA_GATE: Record<Level, number> = { 1: 180_000, 2: 120_000 }
export const COPA_GATE_VS_PRIMERA = 1.5
// Supercopa: los cuatro participantes cobran; el finalista y el campeón, más
export const SUPERCOPA_PARTICIPATION = 3_000_000
export const SUPERCOPA_FINALIST = 1_200_000
export const SUPERCOPA_CHAMPION = 1_800_000

/* ---------- Competiciones europeas ----------
   Cifras a escala del juego. En la vida real la UEFA paga una cantidad fija por entrar en la Champions,
   más un premio por victoria y por empate en la fase de liga, un bonus por clasificar directo a octavos,
   un premio por cada eliminatoria superada y otro para el campeón. Todo se ajusta aquí. */
export interface EuroPrizes {
  participation: number // por clasificar y jugar la competición
  win: number // por victoria en la fase de liga / de grupos
  draw: number // por empate
  directBonus: number // Champions: clasificar entre los 8 primeros y saltarse el playoff
  rounds: Record<string, number> // por cada ronda superada (la clave es la fase)
  champion: number // extra por ganar la final
}
export const EURO_PRIZES: Record<'champions' | 'europa' | 'conferencia', EuroPrizes> = {
  champions: {
    participation: 7_500_000,
    win: 750_000,
    draw: 240_000,
    directBonus: 1_500_000,
    rounds: { playoff: 900_000, octavos: 1_350_000, cuartos: 1_800_000, semi: 2_400_000 },
    champion: 6_000_000,
  },
  europa: {
    participation: 2_700_000,
    win: 270_000,
    draw: 90_000,
    directBonus: 0,
    rounds: { group: 360_000, quarter: 600_000, semi: 1_050_000 },
    champion: 2_400_000,
  },
  conferencia: {
    participation: 1_200_000,
    win: 120_000,
    draw: 45_000,
    directBonus: 0,
    rounds: { group: 180_000, quarter: 300_000, semi: 450_000 },
    champion: 900_000,
  },
}

import { PRESTIGE_FADE } from './lifetimeConfig'

export const START_PRESTIGE = 10
export const PRESTIGE_MIN = 0
export const PRESTIGE_MAX = 100

// Cuánto sube o baja el prestigio al cerrar la temporada
export function prestigeChange(o: {
  promoted: boolean
  relegated: boolean
  champion: boolean
  position: number
  prestige?: number // si se indica, un club de mucho prestigio que no está arriba lo va perdiendo (la fama no es eterna)
}): number {
  let change = 0
  if (o.prestige !== undefined && !o.promoted && o.position > PRESTIGE_FADE.afterPosition && o.prestige > PRESTIGE_FADE.from) {
    change -= Math.round((o.prestige - PRESTIGE_FADE.from) / PRESTIGE_FADE.divisor)
  }
  if (o.promoted) change += 4
  if (o.relegated) change -= 4
  if (o.champion) change += 3
  if (o.position <= 5) change += 1
  else if (o.position >= 16) change -= 1
  return change
}

// Prestigio por las copas nacionales: campeón de Copa +2, finalista +1, campeón de Supercopa +1
export function cupPrestigeChange(
  copa: { champion: boolean; reach: string } | null | undefined,
  supercopa: { champion: boolean } | null | undefined,
): number {
  let change = 0
  if (copa?.champion) change += 2
  else if (copa?.reach === 'final') change += 1
  if (supercopa?.champion) change += 1
  return change
}

import type { Position } from './sample'
import type { SimPlayer } from './players'
import { SEASON_ROUNDS, newCanterano, progressPlayer } from './players'
import { academyPool } from './activeLeague'
import type { Rng } from './rng'
import { clamp, pickWeighted } from './rng'
import { ACADEMY_CAPACITY as CAPACITY, ACADEMY_MAX_AGE as MAX_AGE, ACADEMY_TIERS } from './lifetimeConfig'

/* ---------- La cantera del club ---------- */
// Cuántos juveniles caben según el nivel de inversión en cantera (0 = Mínimo ... 3 = Máximo). Se ajusta en lifetimeConfig.ts
export const ACADEMY_CAPACITY = CAPACITY

// A los 19 años es su último año: si no lo subes al primer equipo, se va al terminar la temporada
export const ACADEMY_MAX_AGE = MAX_AGE

const POSITION_WEIGHTS: [Position, number][] = [
  ['POR', 1],
  ['DEF', 3],
  ['MED', 3],
  ['DEL', 3],
]

export function academyCapacity(level: number): number {
  return ACADEMY_CAPACITY[clamp(level, 0, ACADEMY_CAPACITY.length - 1)]
}

// Mejora (o empeora) a los juveniles de relleno de la plantilla según la inversión (los canteranos usan ACADEMY_TIERS)
export function academyBonus(level: number): number {
  return (level - 1) * 2.5
}

// Cuántos juveniles nuevos llegan cada temporada (si hay plazas libres).
// Con rng: el número real del año (por ejemplo 1 a 2 en Básica). Sin rng: el valor medio, para mostrarlo en pantalla.
export function intakeSize(level: number, academySize: number, rng?: Rng): number {
  const free = Math.max(0, academyCapacity(level) - academySize)
  const [lo, hi] = ACADEMY_TIERS[clamp(level, 0, ACADEMY_TIERS.length - 1)].intake
  const wanted = rng ? lo + Math.floor(rng() * (hi - lo + 1)) : Math.round((lo + hi) / 2)
  return Math.min(free, wanted)
}

// Canteranos nuevos que llegan a la cantera (16 a 18 años). Su potencial sale del nivel de inversión (lifetimeConfig.ts).
export function generateIntake(
  academy: SimPlayer[],
  level: number,
  _teamLevel: number, // ya no se usa: el potencial depende de la inversión, no del nivel del equipo (se deja por compatibilidad)
  season: number,
  rng: Rng,
  idPrefix: string = 'u', // los clubes de la IA usan 't<id>' para no repetir ids
): SimPlayer[] {
  const count = intakeSize(level, academy.length, rng)
  const youths: SimPlayer[] = []
  for (let i = 0; i < count; i++) {
    const pos = pickWeighted(POSITION_WEIGHTS, ([, w]) => w, rng)?.[0] ?? 'MED'
    youths.push(newCanterano(`${idPrefix}-a${season}-${i}`, pos, level, rng, academyPool()))
  }
  return youths
}

// Entrenamiento en la cantera: cuánto equivale a jugar (0 a 1) según la inversión. Crecen más que un suplente del primer equipo.
export function academyTraining(level: number): number {
  return clamp(0.5 + level * 0.1, 0.5, 0.8)
}

// Un año más: los juveniles entrenan y crecen, y los que pasan de 19 años se van
export function ageAcademy(academy: SimPlayer[], rng: Rng, level: number = 1): SimPlayer[] {
  const starts = Math.round(academyTraining(level) * SEASON_ROUNDS)
  return academy.map((p) => progressPlayer({ ...p, starts }, rng)).filter((p) => p.age <= ACADEMY_MAX_AGE)
}

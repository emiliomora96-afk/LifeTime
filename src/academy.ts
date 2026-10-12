import type { Position } from './sample'
import type { SimPlayer } from './players'
import { newYouth, progressPlayer } from './players'
import { ACADEMY_POOL } from './nations'
import type { Rng } from './rng'
import { clamp, pickWeighted } from './rng'

/* ---------- La cantera del club ---------- */
// Cuántos juveniles caben según el nivel de inversión en cantera (0 = Mínimo ... 3 = Máximo)
export const ACADEMY_CAPACITY = [4, 6, 8, 10]

// A los 19 años es su último año: si no lo subes al primer equipo, se va al terminar la temporada
export const ACADEMY_MAX_AGE = 19

const POSITION_WEIGHTS: [Position, number][] = [
  ['POR', 1],
  ['DEF', 3],
  ['MED', 3],
  ['DEL', 3],
]

export function academyCapacity(level: number): number {
  return ACADEMY_CAPACITY[clamp(level, 0, ACADEMY_CAPACITY.length - 1)]
}

// Mejora (o empeora) el potencial de los juveniles según la inversión
export function academyBonus(level: number): number {
  return (level - 1) * 2.5
}

// Cuántos juveniles nuevos llegan cada temporada (si hay plazas libres)
export function intakeSize(level: number, academySize: number): number {
  const free = Math.max(0, academyCapacity(level) - academySize)
  return Math.min(free, 2 + level)
}

// Juveniles nuevos que llegan a la cantera (16 a 18 años)
export function generateIntake(
  academy: SimPlayer[],
  level: number,
  teamLevel: number,
  season: number,
  rng: Rng,
): SimPlayer[] {
  const count = intakeSize(level, academy.length)
  const youths: SimPlayer[] = []
  for (let i = 0; i < count; i++) {
    const pos = pickWeighted(POSITION_WEIGHTS, ([, w]) => w, rng)?.[0] ?? 'MED'
    youths.push(newYouth(`u-a${season}-${i}`, pos, teamLevel, academyBonus(level), rng, ACADEMY_POOL))
  }
  return youths
}

// Un año más: los juveniles crecen (como suplentes) y los que pasan de 19 años se van
export function ageAcademy(academy: SimPlayer[], rng: Rng): SimPlayer[] {
  return academy.map((p) => progressPlayer({ ...p, starts: 0 }, rng)).filter((p) => p.age <= ACADEMY_MAX_AGE)
}

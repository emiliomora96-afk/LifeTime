import type { Position } from './sample'
import type { Rng } from './rng'
import { clamp, normal } from './rng'
import type { NatId, NatPool } from './nations'
import { ACADEMY_POOL, GIANT_POOL, SPAIN_POOL, randomIdentity, talentBonus } from './nations'

/* ---------- Jugador ---------- */
export interface SimPlayer {
  id: string
  name: string // nombre completo
  first?: string // nombre de pila (si falta, se saca de name)
  last?: string // apellido
  nat?: NatId // nacionalidad
  pos: Position
  age: number
  rating: number // valoración actual
  peak: number // valoración máxima que alcanzará. No se muestra: se ve un rango
  potBias: number // de -0.6 a 0.6: descentra el rango para que no revele el pico
  starter: boolean
  starts?: number // jornadas jugadas como titular esta temporada (se reinicia al cerrarla)
  prodigy?: boolean // OCULTO: nadie lo ve. Si juega, puede subir hasta 6 puntos por temporada
  lastGain?: number // cuánto cambió su valoración en la última temporada
}

export interface ScoutFilter {
  pos: Position
  minRating: number
  minPotential: number
  ageMin: number
  ageMax: number
}

export type Phase = 'crece' | 'pico' | 'declive'

/* ---------- Curva de edad (todo configurable aquí) ---------- */
// Los porteros maduran y envejecen más tarde
const PEAK_SHIFT = 2
const DECLINE_SHIFT = 3

// Qué parte de la distancia al pico le queda por recorrer a cada edad
const REMAINING: Record<number, number> = {
  16: 1, 17: 0.88, 18: 0.76, 19: 0.64, 20: 0.52, 21: 0.42,
  22: 0.32, 23: 0.23, 24: 0.15, 25: 0.09, 26: 0.04,
}

// Amplitud (±) del rango de potencial visible a cada edad. A partir de los 27 desaparece.
const SPREAD: Record<number, number> = {
  16: 14, 17: 13, 18: 12, 19: 10, 20: 9, 21: 8,
  22: 6.5, 23: 5, 24: 4, 25: 3, 26: 2,
}

// Puntos que baja por año desde los 31 (el declive se nota claramente desde los 35)
const DECLINE: Record<number, number> = { 31: 0.5, 32: 1, 33: 1.5, 34: 2, 35: 2.5, 36: 3 }
const DECLINE_MAX = 3.5

// Probabilidad de retirarse a cada edad
const RETIRE: Record<number, number> = { 35: 0.08, 36: 0.2, 37: 0.4, 38: 0.6, 39: 0.8 }

const GAP_AT_16 = 30 // distancia media entre su valoración a los 16 y su pico

// Crecimiento por temporada según los minutos (lo que sube cada año, como máximo)
const SEASON_ROUNDS = 38
const SUB_CAP = 3 // suplente que no juega: hasta 3 puntos por temporada
const STARTER_CAP = 4 // titular fijo: hasta 4 puntos por temporada
const PRODIGY_CAP = 6 // titular fijo y prodigio (oculto): hasta 6 puntos por temporada
const SUB_SPEED = 0.9 // velocidad respecto a la curva normal
const STARTER_SPEED = 1.25
const PRODIGY_SPEED = 1.7 // un prodigio que juega explota
const PRODIGY_PEAK_BONUS = 5 // los prodigios llegan más alto
export const PRODIGY_CHANCE = { youth: 0.05, scout: 0.05, squad: 0.03 }

function peakShift(pos: Position): number {
  return pos === 'POR' ? PEAK_SHIFT : 0
}

function declineShift(pos: Position): number {
  return pos === 'POR' ? DECLINE_SHIFT : 0
}

function remaining(effAge: number): number {
  if (effAge >= 27) return 0
  return REMAINING[Math.max(16, effAge)]
}

function declineStep(age: number, pos: Position): number {
  const a = age - declineShift(pos)
  if (a < 31) return 0
  return DECLINE[a] ?? DECLINE_MAX
}

function cumulativeDecline(age: number, pos: Position): number {
  let total = 0
  for (let x = 31 + declineShift(pos); x <= age; x++) total += declineStep(x, pos)
  return total
}

function gap16(rng: Rng): number {
  return Math.max(18, GAP_AT_16 + normal(rng) * 4)
}

export function retireChance(age: number, pos: Position): number {
  const a = age - peakShift(pos)
  if (a < 35) return 0
  return RETIRE[a] ?? 1
}

export function phaseOf(p: SimPlayer): Phase {
  if (p.age - peakShift(p.pos) < 27) return 'crece'
  if (p.age - declineShift(p.pos) < 31) return 'pico'
  return 'declive'
}

/* ---------- Potencial visible ---------- */
// Rango [mínimo, máximo] de valoración que puede alcanzar. Se cierra con los años.
export function potentialRange(p: SimPlayer): [number, number] {
  const eff = p.age - peakShift(p.pos)
  if (eff >= 27) return [p.rating, p.rating]
  const spread = SPREAD[Math.max(16, eff)]
  const center = p.peak + p.potBias * spread
  const lo = Math.max(p.rating, Math.round(center - spread))
  const hi = Math.min(99, Math.max(lo, Math.round(center + spread)))
  return [lo, hi]
}

export function potentialLabel(p: SimPlayer): string {
  const [lo, hi] = potentialRange(p)
  return lo === hi ? String(lo) : `${lo}–${hi}`
}

/* ---------- Crear jugadores ---------- */
// Nombre y apellido del jugador (los jugadores antiguos solo tienen name)
export function nameParts(p: { name: string; first?: string; last?: string }): { first: string; last: string } {
  if (p.first && p.last) return { first: p.first, last: p.last }
  const i = p.name.indexOf(' ')
  return i < 0 ? { first: p.name, last: '' } : { first: p.name.slice(0, i), last: p.name.slice(i + 1) }
}

function randomBias(rng: Rng): number {
  return Math.round((rng() * 1.2 - 0.6) * 100) / 100
}

// Valoración que le toca a su edad, dado su pico
function ratingForAge(peak: number, age: number, pos: Position, rng: Rng): number {
  const eff = age - peakShift(pos)
  let rating: number
  if (eff <= 26) rating = peak - gap16(rng) * remaining(eff) + normal(rng) * 1.2
  else if (age - declineShift(pos) < 31) rating = peak - Math.abs(normal(rng))
  else rating = peak - cumulativeDecline(age, pos) + normal(rng) * 1.2
  return clamp(Math.round(rating), 35, peak)
}

// Pico probable de alguien con esa edad y valoración
function inferPeak(age: number, rating: number, pos: Position, rng: Rng): number {
  const eff = age - peakShift(pos)
  let peak: number
  if (eff <= 26) peak = rating + gap16(rng) * remaining(eff)
  else if (age - declineShift(pos) < 31) peak = rating + Math.abs(normal(rng))
  else peak = rating + cumulativeDecline(age, pos)
  return Math.max(rating, Math.min(97, Math.round(peak)))
}

export interface PlayerBase {
  id: string
  name: string
  first?: string
  last?: string
  nat?: NatId
  pos: Position
  age: number
  starter: boolean
  prodigy?: boolean
}

// ¿Es un prodigio? Solo puede serlo un joven (hasta 21 años). Es un rasgo oculto.
export function rollProdigy(age: number, chance: number, rng: Rng): boolean {
  return age <= 21 && rng() < chance
}

// A partir de su pico (para jugadores nuevos)
export function createPlayer(base: PlayerBase & { peak: number }, rng: Rng): SimPlayer {
  const peak = base.prodigy ? Math.min(97, base.peak + PRODIGY_PEAK_BONUS) : base.peak
  return { ...base, peak, rating: ratingForAge(peak, base.age, base.pos, rng), potBias: randomBias(rng), starts: 0 }
}

// A partir de su valoración actual (para plantillas ya hechas)
export function playerFromRating(base: PlayerBase & { rating: number }, rng: Rng): SimPlayer {
  const inferred = inferPeak(base.age, base.rating, base.pos, rng)
  const peak = base.prodigy ? Math.min(97, inferred + PRODIGY_PEAK_BONUS) : inferred
  return { ...base, peak, potBias: randomBias(rng), starts: 0 }
}

// Juvenil de la cantera (16 a 18 años)
export function newYouth(
  id: string,
  pos: Position,
  level: number,
  bonus: number,
  rng: Rng,
  pool: NatPool = ACADEMY_POOL,
): SimPlayer {
  const who = randomIdentity(rng, pool)
  const age = 16 + Math.floor(rng() * 3)
  const peak = clamp(Math.round(level - 3 + bonus + talentBonus(who.nat) + normal(rng) * 5.5), 55, 97)
  const prodigy = rollProdigy(age, PRODIGY_CHANCE.youth, rng)
  return createPlayer({ id, ...who, pos, age, peak, starter: false, prodigy }, rng)
}

// Fichaje de otro club para renovar la plantilla de la IA (19 a 28 años)
export function newSigning(id: string, pos: Position, level: number, rng: Rng, pool: NatPool = SPAIN_POOL): SimPlayer {
  const who = randomIdentity(rng, pool)
  const age = 19 + Math.floor(rng() * 10)
  const peak = clamp(Math.round(level + 1 + talentBonus(who.nat) + normal(rng) * 3.5), 55, 97)
  const prodigy = rollProdigy(age, PRODIGY_CHANCE.squad, rng)
  return createPlayer({ id, ...who, pos, age, peak, starter: false, prodigy }, rng)
}

/* ---------- Un año más ---------- */
// Cuánto jugó esta temporada, de 0 a 1 (los partidos como titular entre las 38 jornadas)
export function playingTime(p: SimPlayer): number {
  if (p.starts === undefined) return p.starter ? 1 : 0 // partidas guardadas antes de contar minutos
  return clamp(p.starts / SEASON_ROUNDS, 0, 1)
}

export function progressPlayer(p: SimPlayer, rng: Rng): SimPlayer {
  const age = p.age + 1
  const effNew = age - peakShift(p.pos)
  const effOld = p.age - peakShift(p.pos)
  const minutes = playingTime(p)
  let rating: number

  if (effNew <= 26) {
    // Crece hacia su pico. Lo que sube cada año tiene un tope que depende de cuánto juega.
    const remOld = remaining(effOld) || 1
    const normalGain = (p.peak - p.rating) * (1 - remaining(effNew) / remOld) // lo que subiría con la curva normal
    const topSpeed = p.prodigy ? PRODIGY_SPEED : STARTER_SPEED
    const speed = SUB_SPEED + (topSpeed - SUB_SPEED) * minutes
    const topCap = p.prodigy ? PRODIGY_CAP : STARTER_CAP
    const cap = SUB_CAP + (topCap - SUB_CAP) * minutes
    rating = p.rating + clamp(normalGain * speed + normal(rng) * 0.6, 0, cap)
  } else {
    const drop = declineStep(age, p.pos)
    if (drop === 0) {
      // En su pico: se acerca a su valoración máxima (más despacio si no juega)
      const catchUp = 0.25 + 0.25 * minutes
      rating = clamp(p.rating + (p.peak - p.rating) * catchUp + normal(rng) * 0.6, p.peak - 2, p.peak)
    } else rating = p.rating - drop + normal(rng) * 0.6
  }

  const next = clamp(Math.round(rating), 35, 99)
  return { ...p, age, rating: next, peak: Math.max(p.peak, next), starts: 0, lastGain: next - p.rating }
}

/* ---------- Cazatalentos ---------- */
// Busca un jugador que cumpla el filtro (posición, valoración, potencial y edad)
export function generateScoutTarget(filter: ScoutFilter, id: string, rng: Rng): SimPlayer | null {
  for (let attempt = 0; attempt < 30; attempt++) {
    const age = filter.ageMin + Math.floor(rng() * (filter.ageMax - filter.ageMin + 1))
    const eff = age - peakShift(filter.pos)
    let expectedGap: number
    if (eff <= 26) expectedGap = GAP_AT_16 * remaining(eff)
    else if (age - declineShift(filter.pos) < 31) expectedGap = 0
    else expectedGap = cumulativeDecline(age, filter.pos)

    const needed = Math.max(filter.minPotential, filter.minRating + expectedGap)
    const peak = clamp(Math.round(needed + rng() * 8), 55, 97)
    const prodigy = rollProdigy(age, PRODIGY_CHANCE.scout, rng)
    const who = randomIdentity(rng, GIANT_POOL)
    const player = createPlayer({ id, ...who, pos: filter.pos, age, peak, starter: false, prodigy }, rng)
    if (player.rating >= filter.minRating && potentialRange(player)[1] >= filter.minPotential) return player
  }
  return null
}

/* ---------- Dinero ---------- */
const SALARY_SCALE = 180

// Sueldo anual: crece con la valoración. Los juveniles cobran menos.
export function playerSalary(p: SimPlayer): number {
  const base = Math.pow(Math.max(0, p.rating - 45), 2) * SALARY_SCALE
  const youth = p.age < 20 ? 0.5 : p.age < 23 ? 0.8 : 1
  return Math.max(15_000, Math.round((base * youth) / 1000) * 1000)
}

// Precio de mercado: en los jóvenes pesa el potencial, en los veteranos la edad
export function marketValue(p: SimPlayer): number {
  const hi = potentialRange(p)[1]
  const level = p.age <= 24 ? (p.rating + hi) / 2 : p.rating
  const base = 3500 * Math.pow(Math.max(0, level - 50), 2)
  const agePenalty = p.age > 29 ? Math.max(0.3, 1 - (p.age - 29) * 0.12) : 1
  return Math.max(150_000, Math.round((base * agePenalty) / 10_000) * 10_000)
}

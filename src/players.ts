import type { Position } from './sample'
import type { Rng } from './rng'
import { clamp, normal, pickOne } from './rng'

/* ---------- Jugador ---------- */
export interface SimPlayer {
  id: string
  name: string
  pos: Position
  age: number
  rating: number // valoración actual
  peak: number // valoración máxima que alcanzará. No se muestra: se ve un rango
  potBias: number // de -0.6 a 0.6: descentra el rango para que no revele el pico
  starter: boolean
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
const FIRST_NAMES = [
  'Adrián', 'Bruno', 'Carlos', 'Darío', 'Emilio', 'Félix', 'Gonzalo', 'Héctor', 'Íñigo', 'Julio',
  'Kiko', 'Lucas', 'Marco', 'Néstor', 'Óscar', 'Pedro', 'Quique', 'Rodrigo', 'Sergio', 'Teo',
  'Unai', 'Víctor', 'Xavi', 'Yago', 'Zacarías', 'Aitor', 'Borja', 'Cayetano', 'Damián', 'Eloy',
  'Fran', 'Gerard', 'Hugo', 'Iker', 'Jon', 'Koldo', 'Luis', 'Mikel', 'Nacho', 'Omar',
]

const LAST_NAMES = [
  'Arteaga', 'Bermejo', 'Cabrera', 'Duarte', 'Escalante', 'Fontán', 'Galindo', 'Heredia', 'Iglesias', 'Jaramillo',
  'Lozano', 'Navarrete', 'Ordóñez', 'Palacios', 'Quintero', 'Ramos', 'Salvatierra', 'Urrutia', 'Vallejo', 'Zamora',
  'Alcázar', 'Barrios', 'Calleja', 'Domínguez', 'Esteban', 'Ferrer', 'Gallardo', 'Huerta', 'Ibáñez', 'Juárez',
  'Lara', 'Montero', 'Nieto', 'Olmos', 'Peña', 'Revilla', 'Sandoval', 'Tapia', 'Uribe', 'Vega',
]

export function randomName(rng: Rng): string {
  return `${pickOne(FIRST_NAMES, rng)} ${pickOne(LAST_NAMES, rng)}`
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
  pos: Position
  age: number
  starter: boolean
}

// A partir de su pico (para jugadores nuevos)
export function createPlayer(base: PlayerBase & { peak: number }, rng: Rng): SimPlayer {
  return { ...base, rating: ratingForAge(base.peak, base.age, base.pos, rng), potBias: randomBias(rng) }
}

// A partir de su valoración actual (para plantillas ya hechas)
export function playerFromRating(base: PlayerBase & { rating: number }, rng: Rng): SimPlayer {
  return { ...base, peak: inferPeak(base.age, base.rating, base.pos, rng), potBias: randomBias(rng) }
}

// Juvenil de la cantera (16 a 18 años)
export function newYouth(id: string, pos: Position, level: number, bonus: number, rng: Rng): SimPlayer {
  const age = 16 + Math.floor(rng() * 3)
  const peak = clamp(Math.round(level - 3 + bonus + normal(rng) * 5.5), 55, 97)
  return createPlayer({ id, name: randomName(rng), pos, age, peak, starter: false }, rng)
}

// Fichaje de otro club para renovar la plantilla de la IA (19 a 28 años)
export function newSigning(id: string, pos: Position, level: number, rng: Rng): SimPlayer {
  const age = 19 + Math.floor(rng() * 10)
  const peak = clamp(Math.round(level + 1 + normal(rng) * 3.5), 55, 97)
  return createPlayer({ id, name: randomName(rng), pos, age, peak, starter: false }, rng)
}

/* ---------- Un año más ---------- */
export function progressPlayer(p: SimPlayer, rng: Rng): SimPlayer {
  const age = p.age + 1
  const effNew = age - peakShift(p.pos)
  const effOld = p.age - peakShift(p.pos)
  let rating: number

  if (effNew <= 26) {
    // Crece hacia su pico siguiendo su propia trayectoria
    const remOld = remaining(effOld) || 1
    const scaled = (p.peak - p.rating) * (remaining(effNew) / remOld)
    rating = p.peak - scaled + normal(rng) * 0.8
  } else {
    const drop = declineStep(age, p.pos)
    if (drop === 0) rating = clamp(p.rating + (p.peak - p.rating) * 0.5 + normal(rng) * 0.6, p.peak - 2, p.peak)
    else rating = p.rating - drop + normal(rng) * 0.6
  }

  const next = clamp(Math.round(rating), 35, 99)
  return { ...p, age, rating: next, peak: Math.max(p.peak, next) }
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
    const player = createPlayer({ id, name: randomName(rng), pos: filter.pos, age, peak, starter: false }, rng)
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

import type { Position } from './sample'
import type { Rng } from './rng'
import { clamp, normal, pickWeighted } from './rng'
import type { NatId, NatPool } from './nations'
import { randomIdentity, talentBonus } from './nations'
import { academyPool, giantPool, homePool } from './activeLeague'
import { ACADEMY_ENTRY_AGE, ACADEMY_TIERS, CANTERANO_EVENTS, DECLINE, DEVELOPMENT, MARKET, SALARY, SIGNING, VAL_LIMITS } from './lifetimeConfig'

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
  pot?: number // potencial sorteado (solo canteranos). Lo que ven los ojeadores; el pico real es un 85-100 % de esto
  peakAge?: number // OCULTO: edad en la que alcanza su pico (22 a 26). Sin definir = 26
  origin?: string // nivel de cantera del que salió (basica, alta, maxima...). Sirve para la validación
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
// Los porteros maduran más tarde
const PEAK_SHIFT = 2

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

// El declive por posición vive en lifetimeConfig.ts (DECLINE): delanteros 33-34, medios 34, defensas 34-35, porteros 37-38
// Probabilidad de retirarse a cada edad
const RETIRE: Record<number, number> = { 35: 0.08, 36: 0.2, 37: 0.4, 38: 0.6, 39: 0.8 }

const GAP_AT_16 = 30 // distancia media entre su valoración a los 16 y su pico
const YOUTH_GAP_FACTOR = 0.6 // los juveniles de cantera llegan más hechos: parten de un 60% de esa distancia

// Crecimiento por temporada según los minutos (lo que sube cada año, como máximo)
export const SEASON_ROUNDS = 38
const SUB_CAP = 3 // suplente que no juega: hasta 3 puntos por temporada
const STARTER_CAP = 4 // titular fijo: hasta 4 puntos por temporada
const HIGH_CAP = 5 // titular fijo de potencial alto: hasta 5 puntos por temporada
const PRODIGY_CAP = 6 // titular fijo y prodigio (oculto): hasta 6 puntos por temporada
export const HIGH_POTENTIAL = 85 // pico a partir del cual un jugador se considera de potencial alto
const SUB_SPEED = 0.85 // velocidad respecto al ritmo base (3 a 5 por año, ver DEVELOPMENT)
const STARTER_SPEED = 1.0
const HIGH_SPEED = 1.1 // los de potencial alto que juegan crecen más rápido
const PRODIGY_SPEED = 1.4 // un prodigio que juega explota
const PRODIGY_PEAK_BONUS = 5 // los prodigios llegan más alto
const PRODIGY_MIN_PEAK = 90 // y su pico nunca baja de 90: los hay que llegan a 94 o 95
// Con la cantera por niveles, el equivalente al prodigio en la cantera es la "joya inesperada" (lifetimeConfig.ts): youth = 0.
// Fuera de la cantera son poco frecuentes para que los Val 90+ sigan siendo muy raros.
export const PRODIGY_CHANCE = { youth: 0, scout: 0.03, squad: 0.01 }

function peakShift(pos: Position): number {
  return pos === 'POR' ? PEAK_SHIFT : 0
}

/* ---------- Declive por posición ---------- */
// Primera edad en la que puede empezar a bajar (todas las cifras en lifetimeConfig.ts)
export function declineStartAge(pos: Position): number {
  return DECLINE.start[pos][0]
}

// Cuánto baja en un año de declive a esa edad (de -1 a -3, cada año un poco más)
function dropSize(age: number, pos: Position): number {
  return clamp(DECLINE.firstDrop + (age - declineStartAge(pos)) * DECLINE.dropPerYear, DECLINE.firstDrop, DECLINE.maxDrop)
}

// Probabilidad de que baje ese año: algunos bajan antes, entre las dos edades baja a veces, después siempre
function dropChance(age: number, pos: Position): number {
  const [first, sure] = DECLINE.start[pos]
  if (age >= sure) return 1
  if (age >= first) return DECLINE.halfChance
  if (age >= first - 2) return DECLINE.earlyChance
  return 0
}

// Caída media esperada (para generar plantillas y ojeadores)
function declineStep(age: number, pos: Position): number {
  return dropChance(age, pos) * dropSize(age, pos)
}

// Caída real de este año: 0 o de -1 a -3, con azar
function rollDrop(age: number, pos: Position, rng: Rng): number {
  if (rng() >= dropChance(age, pos)) return 0
  return clamp(Math.round(dropSize(age, pos) + normal(rng) * 0.6), 1, DECLINE.maxDrop)
}

function remaining(effAge: number): number {
  if (effAge >= 27) return 0
  return REMAINING[Math.max(16, effAge)]
}

function cumulativeDecline(age: number, pos: Position): number {
  let total = 0
  for (let x = declineStartAge(pos) - 2; x <= age; x++) total += declineStep(x, pos)
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
  if (p.age < declineStartAge(p.pos)) return 'pico'
  return 'declive'
}

/* ---------- Potencial visible ---------- */
// Rango [mínimo, máximo] de valoración que puede alcanzar. Se cierra con los años.
export function potentialRange(p: SimPlayer): [number, number] {
  const eff = p.age - peakShift(p.pos)
  if (eff >= 27) return [p.rating, p.rating]
  const spread = SPREAD[Math.max(16, eff)]
  const center = (p.pot ?? p.peak) + p.potBias * spread
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
  else if (age < declineStartAge(pos) - 2) rating = peak - Math.abs(normal(rng))
  else rating = peak - cumulativeDecline(age, pos) + normal(rng) * 1.2
  return clamp(Math.round(rating), 35, peak)
}

// Pico probable de alguien con esa edad y valoración
function inferPeak(age: number, rating: number, pos: Position, rng: Rng): number {
  const eff = age - peakShift(pos)
  let peak: number
  if (eff <= 26) peak = rating + gap16(rng) * remaining(eff)
  else if (age < declineStartAge(pos) - 2) peak = rating + Math.abs(normal(rng))
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
  pot?: number
  peakAge?: number
  origin?: string
}

// ¿Es un prodigio? Solo puede serlo un joven (hasta 21 años). Es un rasgo oculto.
export function rollProdigy(age: number, chance: number, rng: Rng): boolean {
  return age <= 21 && rng() < chance
}

// Pico de un prodigio: su pico normal más el bono, y nunca menos de 90 (entre 90 y 95 como mínimo)
function prodigyPeak(peak: number, rng: Rng): number {
  const floor = PRODIGY_MIN_PEAK + Math.floor(rng() * 6)
  return Math.min(97, Math.max(peak + PRODIGY_PEAK_BONUS, floor))
}

// A partir de su pico (para jugadores nuevos)
export function createPlayer(base: PlayerBase & { peak: number }, rng: Rng): SimPlayer {
  const peak = base.prodigy ? prodigyPeak(base.peak, rng) : base.peak
  return { ...base, peak, rating: ratingForAge(peak, base.age, base.pos, rng), potBias: randomBias(rng), starts: 0 }
}

// A partir de su valoración actual (para plantillas ya hechas)
export function playerFromRating(base: PlayerBase & { rating: number }, rng: Rng): SimPlayer {
  const inferred = inferPeak(base.age, base.rating, base.pos, rng)
  const peak = base.prodigy ? prodigyPeak(inferred, rng) : inferred
  return { ...base, peak, potBias: randomBias(rng), starts: 0 }
}

// Juvenil de la cantera (16 a 18 años)
export function newYouth(
  id: string,
  pos: Position,
  level: number,
  bonus: number,
  rng: Rng,
  pool: NatPool = academyPool(),
): SimPlayer {
  const who = randomIdentity(rng, pool)
  const age = 16 + Math.floor(rng() * 3)
  const peak = clamp(Math.round(level - 3 + bonus + talentBonus(who.nat) + normal(rng) * 5.5), 55, 97)
  const prodigy = rollProdigy(age, PRODIGY_CHANCE.youth, rng)
  const base = createPlayer({ id, ...who, pos, age, peak, starter: false, prodigy }, rng)
  // Los de la cantera no empiezan tan bajos: con potencial alto arrancan con una valoración digna
  const gap = Math.max(12, GAP_AT_16 * YOUTH_GAP_FACTOR + normal(rng) * 3)
  const rating = clamp(Math.round(base.peak - gap * remaining(age) + normal(rng) * 1.2), 40, base.peak)
  return { ...base, rating }
}

function between(range: [number, number], rng: Rng): number {
  return range[0] + rng() * (range[1] - range[0])
}

// Potencial de un canterano según su nivel de inversión: campana de Gauss limitada al rango del nivel,
// con dos eventos raros (fracaso y joya inesperada). Devuelve también qué evento tocó.
export function rollCanteranoPotential(level: number, rng: Rng): { pot: number; event: 'fracaso' | 'joya' | null; tier: (typeof ACADEMY_TIERS)[number] } {
  const tier = ACADEMY_TIERS[clamp(level, 0, ACADEMY_TIERS.length - 1)]
  let pot = clamp(Math.round(tier.mean + normal(rng) * tier.sd), tier.min, tier.max)
  const roll = rng()
  let event: 'fracaso' | 'joya' | null = null
  if (roll < CANTERANO_EVENTS.failChance) {
    pot = Math.max(40, Math.round(pot - between(CANTERANO_EVENTS.failDrop, rng)))
    event = 'fracaso'
  } else if (roll < CANTERANO_EVENTS.failChance + CANTERANO_EVENTS.gemChance) {
    pot = Math.min(tier.gemCap, Math.round(pot + between(CANTERANO_EVENTS.gemBoost, rng)))
    event = 'joya'
  }
  return { pot, event, tier }
}

function rollPeakAge(rng: Rng): number {
  const entries = Object.entries(DEVELOPMENT.peakAgeWeights).map(([age, w]) => [Number(age), w] as [number, number])
  return pickWeighted(entries, ([, w]) => w, rng)?.[0] ?? 24
}

// Canterano (16 a 18 años) de una cantera con ese nivel de inversión:
//  - potencial sorteado según el nivel (ver ACADEMY_TIERS y CANTERANO_EVENTS)
//  - llega entre 10 y 20 puntos por debajo de su potencial
//  - su pico real es un 85-100 % del potencial y lo alcanza entre los 22 y los 26 años
export function newCanterano(id: string, pos: Position, level: number, rng: Rng, pool: NatPool = academyPool()): SimPlayer {
  const who = randomIdentity(rng, pool)
  const age = ACADEMY_ENTRY_AGE[0] + Math.floor(rng() * (ACADEMY_ENTRY_AGE[1] - ACADEMY_ENTRY_AGE[0] + 1))
  const { pot, tier } = rollCanteranoPotential(level, rng)
  const peak = clamp(Math.round(pot * between(DEVELOPMENT.peakFactor, rng)), 40, pot)
  const rating = clamp(Math.round(pot - between(DEVELOPMENT.entryGap, rng)), 35, peak)
  return {
    id,
    ...who,
    pos,
    age,
    rating,
    peak,
    pot,
    peakAge: rollPeakAge(rng),
    origin: tier.id,
    potBias: randomBias(rng),
    starter: false,
    starts: 0,
  }
}

// Fichaje de otro club para renovar la plantilla de la IA (19 a 28 años).
// "level" es la media actual de la liga: los jugadores nuevos nacen calibrados a ella (no hay inflación de Val).
export function newSigning(id: string, pos: Position, level: number, rng: Rng, pool: NatPool = homePool()): SimPlayer {
  const who = randomIdentity(rng, pool)
  const age = 19 + Math.floor(rng() * 10)
  const peak = clamp(Math.round(level + SIGNING.peakOffset + talentBonus(who.nat) + normal(rng) * 3.5), 55, 97)
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
  const shift = peakShift(p.pos)
  const minutes = playingTime(p)
  let rating: number

  // Lo máximo que puede subir en la temporada según cuánto juega y qué potencial tiene
  const high = p.peak >= HIGH_POTENTIAL
  const topCap = p.prodigy ? PRODIGY_CAP : high ? HIGH_CAP : STARTER_CAP
  const cap = SUB_CAP + (topCap - SUB_CAP) * minutes
  const peakAge = (p.peakAge ?? 26) + shift // sin definir (jugadores antiguos o de plantilla): 26

  if (age <= peakAge) {
    // Crece hacia su pico de +3 a +5 por año (según cuánto juega), más despacio al final y sin pasar de su pico
    const topSpeed = p.prodigy ? PRODIGY_SPEED : high ? HIGH_SPEED : STARTER_SPEED
    const speed = SUB_SPEED + (topSpeed - SUB_SPEED) * minutes
    const late = age > Math.min(peakAge, DEVELOPMENT.growthEndAge + shift) ? DEVELOPMENT.lateGrowth : 1
    const rate = (DEVELOPMENT.growthRate[0] + rng() * (DEVELOPMENT.growthRate[1] - DEVELOPMENT.growthRate[0])) * speed * late
    const room = Math.max(0, p.peak - p.rating)
    const gain = clamp(Math.min(room, rate) + normal(rng) * 0.4, 0, cap)
    rating = Math.min(p.rating + gain, Math.max(p.peak, p.rating))
  } else if (age < declineStartAge(p.pos) - 2) {
    // En su pico: se acerca a su valoración máxima (más despacio si no juega), sin pasar el tope por temporada
    const catchUp = 0.25 + 0.25 * minutes
    const gain = clamp((p.peak - p.rating) * catchUp + normal(rng) * 0.6, 0, cap)
    rating = clamp(p.rating + gain, 0, p.peak)
  } else {
    // Declive por posición: de -1 a -3 por año, con azar (algunos bajan antes)
    rating = p.rating - rollDrop(age, p.pos, rng)
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
    else if (age < declineStartAge(filter.pos) - 2) expectedGap = 0
    else expectedGap = cumulativeDecline(age, filter.pos)

    const needed = Math.max(filter.minPotential, filter.minRating + expectedGap)
    const peak = clamp(Math.round(needed + rng() * 8), 55, 97)
    const prodigy = rollProdigy(age, PRODIGY_CHANCE.scout, rng)
    const who = randomIdentity(rng, giantPool())
    const player = createPlayer({ id, ...who, pos: filter.pos, age, peak, starter: false, prodigy }, rng)
    if (player.rating >= filter.minRating && potentialRange(player)[1] >= filter.minPotential) return player
  }
  return null
}

/* ---------- Dinero ---------- */
// Sueldo anual: curva empinada con la valoración (las estrellas cuestan de retener). Los juveniles cobran menos.
export function playerSalary(p: SimPlayer): number {
  const base = SALARY.scale * Math.pow(Math.max(0, p.rating - SALARY.base), SALARY.exponent)
  const youth = p.age < 20 ? SALARY.youth.under20 : p.age < 23 ? SALARY.youth.under23 : 1
  return Math.max(SALARY.floor, Math.round((base * youth) / 1000) * 1000)
}

// Precio de mercado: depende del Val actual, del potencial (pesa más cuanto más joven) y de la edad
// (cae al acercarse el declive de su posición). Todas las cifras están en MARKET (lifetimeConfig.ts).
export function marketValue(p: SimPlayer): number {
  const [lo, hi] = potentialRange(p)
  const weight = MARKET.potentialWeight[Math.max(16, p.age)] ?? 0
  const effective = p.rating + weight * Math.max(0, (lo + hi) / 2 - p.rating)
  const base = MARKET.scale * Math.pow(Math.max(0, effective - MARKET.ref), MARKET.exponent)
  const decayFrom = declineStartAge(p.pos) - MARKET.ageGrace
  const ageFactor = p.age > decayFrom ? Math.max(MARKET.ageFloor, 1 - (p.age - decayFrom) * MARKET.ageSlope) : 1
  // Superestrellas: si el Val actual o el valor efectivo (Val + potencial) llega al nivel de estrella, cuestan más
  const star = p.rating >= VAL_LIMITS.topStarRating || effective >= VAL_LIMITS.topStarRating ? VAL_LIMITS.topStarPremium : 1
  return Math.max(MARKET.minValue, Math.round((base * ageFactor * star) / 10_000) * 10_000)
}

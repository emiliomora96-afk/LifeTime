import type { Position } from './sample'
import { STARTERS, SUBS } from './sample'
import type { Rng } from './rng'
import { clamp, normal } from './rng'
import type { SimPlayer } from './players'
import {
  createPlayer,
  newSigning,
  newYouth,
  playerFromRating,
  progressPlayer,
  randomName,
  retireChance,
} from './players'

export const POSITION_ORDER: Position[] = ['POR', 'DEF', 'MED', 'DEL']
export const FORMATION = '4-3-3'
export const FORMATION_COUNT: Record<Position, number> = { POR: 1, DEF: 4, MED: 3, DEL: 3 }
export const SQUAD_TEMPLATE: Record<Position, number> = { POR: 2, DEF: 6, MED: 5, DEL: 5 }
export const MAX_SQUAD = 24

function byRating(a: SimPlayer, b: SimPlayer): number {
  return b.rating - a.rating || a.id.localeCompare(b.id)
}

// Elige el mejor once para la formación 4-3-3
export function pickStarters(squad: SimPlayer[]): SimPlayer[] {
  const chosen = new Set<string>()
  for (const pos of POSITION_ORDER) {
    squad
      .filter((p) => p.pos === pos)
      .sort(byRating)
      .slice(0, FORMATION_COUNT[pos])
      .forEach((p) => chosen.add(p.id))
  }
  const rest = squad.filter((p) => !chosen.has(p.id)).sort(byRating)
  while (chosen.size < 11 && rest.length > 0) {
    const next = rest.shift()
    if (next) chosen.add(next.id)
  }
  return squad.map((p) => ({ ...p, starter: chosen.has(p.id) }))
}

// Mantiene el once que eligió el jugador y solo corrige lo que haya quedado roto (ventas, retiros...)
export function repairStarters(squad: SimPlayer[]): SimPlayer[] {
  const chosen = new Set(squad.filter((p) => p.starter).map((p) => p.id))
  for (const pos of POSITION_ORDER) {
    const inPos = squad.filter((p) => p.pos === pos)
    const current = inPos.filter((p) => chosen.has(p.id)).sort(byRating)
    // Si sobran titulares en una posición, salen los peores
    current.slice(FORMATION_COUNT[pos]).forEach((p) => chosen.delete(p.id))
    // Si faltan, entran los mejores suplentes de esa posición
    const missing = FORMATION_COUNT[pos] - Math.min(current.length, FORMATION_COUNT[pos])
    inPos
      .filter((p) => !chosen.has(p.id))
      .sort(byRating)
      .slice(0, missing)
      .forEach((p) => chosen.add(p.id))
  }
  const rest = squad.filter((p) => !chosen.has(p.id)).sort(byRating)
  while (chosen.size < 11 && rest.length > 0) {
    const next = rest.shift()
    if (next) chosen.add(next.id)
  }
  return squad.map((p) => ({ ...p, starter: chosen.has(p.id) }))
}

// Nivel del equipo: promedio de valoración del once inicial
export function squadStrength(squad: SimPlayer[]): number {
  const starters = squad.filter((p) => p.starter)
  if (starters.length === 0) return 60
  return Math.round((starters.reduce((sum, p) => sum + p.rating, 0) / starters.length) * 10) / 10
}

// Plantilla generada para un club rival, ajustada a su nivel
export function placeholderSquad(teamId: number, level: number, rng: Rng): SimPlayer[] {
  const players: SimPlayer[] = []
  let n = 0
  for (const pos of POSITION_ORDER) {
    for (let i = 0; i < SQUAD_TEMPLATE[pos]; i++) {
      const main = i < FORMATION_COUNT[pos]
      const age = main
        ? clamp(Math.round(27 + normal(rng) * 3.5), 20, 35)
        : clamp(Math.round(23.5 + normal(rng) * 4.5), 17, 34)
      const peak = clamp(
        Math.round(main ? level + 2.5 + normal(rng) * 3 : level - 4 + normal(rng) * 3.5),
        55,
        97,
      )
      players.push(createPlayer({ id: `t${teamId}-${n++}`, name: randomName(rng), pos, age, peak, starter: false }, rng))
    }
  }

  // Se desplaza toda la plantilla para que el once inicial quede en el nivel del club
  const picked = pickStarters(players)
  const delta = Math.round(level - squadStrength(picked))
  return pickStarters(
    picked.map((p) => {
      const rating = clamp(p.rating + delta, 35, 99)
      return { ...p, rating, peak: Math.max(rating, clamp(p.peak + delta, 55, 99)) }
    }),
  )
}

// Plantilla del club del jugador (por ahora, la de ejemplo)
export function userSquad(rng: Rng): SimPlayer[] {
  return pickStarters(
    [...STARTERS, ...SUBS].map((p) =>
      playerFromRating({ id: `u-${p.id}`, name: p.name, pos: p.pos, age: p.age, rating: p.rating, starter: false }, rng),
    ),
  )
}

export interface ProgressOptions {
  level: number // nivel al que apunta el club al reponer jugadores
  youthBonus: number // mejora de los juveniles (inversión en cantera)
  useYouth: boolean // true: reponer con la cantera. false: fichajes de otros clubes
  removeIds: string[] // jugadores que se van al terminar la temporada
  keepLineup?: boolean // true: respetar el once elegido por el jugador
  idPrefix: string
}

// Pasa un año: todos envejecen, se retiran los veteranos y se completa la plantilla
export function progressSquad(squad: SimPlayer[], o: ProgressOptions, rng: Rng): SimPlayer[] {
  let list = squad.filter((p) => !o.removeIds.includes(p.id)).map((p) => progressPlayer(p, rng))

  list = list.filter((p) => rng() >= retireChance(p.age, p.pos))
  // Los clubes de la IA renuevan su plantilla soltando a algunos veteranos
  if (!o.useYouth) list = list.filter((p) => !(p.age >= 33 && rng() < 0.35))

  // Si la plantilla es demasiado grande, salen los peores de las posiciones con exceso
  while (list.length > MAX_SQUAD) {
    const excess = list
      .filter((p) => list.filter((q) => q.pos === p.pos).length > SQUAD_TEMPLATE[p.pos])
      .sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id))
    if (excess.length === 0) break
    const out = excess[0]
    list = list.filter((p) => p.id !== out.id)
  }

  // Se completan las posiciones que quedaron cortas
  let n = 0
  for (const pos of POSITION_ORDER) {
    while (list.filter((p) => p.pos === pos).length < SQUAD_TEMPLATE[pos]) {
      const id = `${o.idPrefix}-${n++}`
      list.push(o.useYouth ? newYouth(id, pos, o.level, o.youthBonus, rng) : newSigning(id, pos, o.level, rng))
    }
  }
  return o.keepLineup ? repairStarters(list) : pickStarters(list)
}

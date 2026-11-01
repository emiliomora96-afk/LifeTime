import { USER_ID, computeTable } from './engine'
import type { DivisionState, LeagueState, Level } from './engine'
import { zoneOf } from './zones'
import type { Zone } from './zones'

export const BOARD_SIZE = 3 // filas de la mini tabla: el de arriba, tu club y el de abajo

export interface BoardRow {
  id: number
  pos: number // 1 = líder
  name: string
  colors: [string, string]
  isMe: boolean
  played: number
  won: number
  drawn: number
  lost: number
  gd: number // diferencia de goles
  points: number
  /** Puestos que sube (+) o baja (−) respecto a la jornada anterior. 0 = igual o sin dato. */
  move: number
  zone: Zone | null
}

export interface Board {
  level: Level
  rows: BoardRow[]
  total: number
}

/** Ventana de `size` filas centrada en `center`. Cerca del primero o del último se desplaza para mostrar `size` filas igual. */
export function windowAround(total: number, center: number, size = BOARD_SIZE): [number, number] {
  if (total <= size) return [0, total]
  const half = Math.floor(size / 2)
  const start = Math.max(0, Math.min(center - half, total - size))
  return [start, start + size]
}

// Orden de la clasificación; antes de jugar, por nivel de los equipos (igual que getTable)
function orderedIds(div: DivisionState, played: number): number[] {
  const rows = computeTable(div)
  if (played === 0) {
    const strength = new Map(div.teams.map((t) => [t.id, t.strength]))
    rows.sort((a, b) => (strength.get(b.id) ?? 0) - (strength.get(a.id) ?? 0) || a.id - b.id)
  }
  return rows.map((r) => r.id)
}

/** Puestos de cada club en la jornada anterior (vacío si aún no hay jornada anterior). */
export function previousPositions(div: DivisionState): Map<number, number> {
  if (div.played < 2) return new Map()
  const prev: DivisionState = { ...div, results: div.results.filter((m) => m.round < div.played), played: div.played - 1 }
  return new Map(computeTable(prev).map((r, i) => [r.id, i + 1]))
}

export function buildBoard(
  league: LeagueState,
  club: { name: string; primaryColor: string; secondaryColor: string },
  size = BOARD_SIZE,
): Board {
  const level = league.userDivision
  const div = league.divisions[level]
  const stats = new Map(computeTable(div).map((r) => [r.id, r]))
  const teams = new Map(div.teams.map((t) => [t.id, t]))
  const order = orderedIds(div, div.played)
  const prev = previousPositions(div)

  const me = Math.max(0, order.indexOf(USER_ID))
  const [from, to] = windowAround(order.length, me, size)

  const rows: BoardRow[] = order.slice(from, to).map((id, k) => {
    const i = from + k
    const s = stats.get(id)
    const t = teams.get(id)
    const isMe = id === USER_ID
    const before = prev.get(id)
    return {
      id,
      pos: i + 1,
      name: isMe ? club.name : (t?.name ?? '?'),
      colors: isMe ? [club.primaryColor, club.secondaryColor] : (t?.colors ?? ['#475569', '#cbd5e1']),
      isMe,
      played: s?.played ?? 0,
      won: s?.won ?? 0,
      drawn: s?.drawn ?? 0,
      lost: s?.lost ?? 0,
      gd: (s?.gf ?? 0) - (s?.ga ?? 0),
      points: s?.points ?? 0,
      move: before === undefined ? 0 : before - (i + 1),
      zone: zoneOf(level, i),
    }
  })
  return { level, rows, total: order.length }
}

export interface NextMatch {
  round: number
  rival: string
  home: boolean
}

/** Próximo partido del club del jugador (null si la temporada ya terminó). */
export function nextMatch(league: LeagueState): NextMatch | null {
  const div = league.divisions[league.userDivision]
  const round = div.played
  const pair = div.schedule[round]?.find(([h, a]) => h === USER_ID || a === USER_ID)
  if (!pair) return null
  const home = pair[0] === USER_ID
  const rivalId = home ? pair[1] : pair[0]
  return { round: round + 1, rival: div.teams.find((t) => t.id === rivalId)?.name ?? '?', home }
}

import { USER_ID, computeTable } from './engine'
import type { DivisionState, LeagueState, SimTeam } from './engine'
import type { Position } from './sample'
import { clAllMatches } from './champions'
import type { ClState } from './champions'
import type { DomesticSeason } from './domestic'
import { HOME_ID_PREFIX } from './europe'
import { createRng, mixSeed } from './rng'

/* ==========================================================================
   Lifetime Balón de Oro
   Cada temporada, al cerrar, se puntúa a todos los candidatos:
     puntos = títulos del club (si el jugador participó) + puntos por su ranking de rendimiento personal
   Gana quien más puntos suma. Todo lo ajustable está en BALON.
   ========================================================================== */

export const BALON = {
  name: 'Lifetime Balón de Oro',
  short: 'Balón de Oro',

  // Puntos por los títulos del club. Se suman todos los que ganó el club del jugador esa temporada.
  titles: { champions: 30, liga: 20, copa: 15, supercopa: 15 },
  // Para cobrar los puntos de títulos: haber sido titular en al menos esta parte de los partidos de liga de su club
  minShare: 0.4,

  // Puntos por el ranking de rendimiento personal (1.º, 2.º, 3.º...). Del 11.º en adelante: 0
  rankPoints: [60, 50, 41, 33, 26, 20, 15, 10, 6, 3],

  // Rendimiento: goles y asistencias (la Champions vale más), vallas invictas para defensas y porteros, y un extra por valoración
  championsMult: 1.5, // un gol o una asistencia en la Champions vale esto frente a uno de liga
  goalWeight: 1,
  assistWeight: 2.1, // alto a propósito: los goles se concentran en los delanteros y así los medios con muchas asistencias compiten
  cleanSheetWeight: { POR: 1.2, DEF: 0.9, MED: 0, DEL: 0 } as Record<Position, number>,
  ratingBase: 78, // por encima de esta valoración empieza a sumar
  ratingWeight: 0.45,
  // Multiplicador por posición sobre el rendimiento. Ajustado con simulaciones para que los ganadores salgan
  // en torno a 45 % delanteros, 45 % medios, 8 % defensas y 2 % porteros. Es muy sensible en defensas y porteros: muévelo de a poco.
  positionMult: { DEL: 1, MED: 1.22, DEF: 1.22, POR: 1.5 } as Record<Position, number>,
  // Los números de un jugador de 2.ª división (tu club, si aún no ascendió) valen esta parte
  secondDivisionFactor: 0.5,

  // Azar: solo para romper empates (puntos)
  tiebreak: 1,
  // Cuántos jugadores se guardan en el historial de cada temporada
  keep: 5,

  // Prestigio para el club del ganador y para los de los puestos 2.º y 3.º
  prestige: [3, 1, 1],
}

export type BalonTitle = 'champions' | 'liga' | 'copa' | 'supercopa'

export interface BalonEntry {
  id: string
  name: string
  pos: Position
  club: string | null // null = tu club
  teamId: number | null // id del club en tu liga (null si es un club invitado de Europa)
  points: number // total
  titlePts: number // por títulos del club
  rankPts: number // por el ranking de rendimiento
  rank: number // puesto en el ranking de rendimiento
  goals: number // goles de liga + Champions
  assists: number
  clGoals: number // de ellos, en la Champions
  clAssists: number
  titles: BalonTitle[]
}

export interface BalonRecord {
  season: number
  top: BalonEntry[] // los mejores de la temporada; el primero es el ganador
}

export function balonWinner(r: BalonRecord | null | undefined): BalonEntry | null {
  return r?.top[0] ?? null
}

export interface BalonInput {
  league: LeagueState
  champions: ClState | null
  domestic: DomesticSeason | null
  season: number
  seed: number
}

export interface BalonCand {
  key: string
  id: string
  name: string
  pos: Position
  rating: number
  teamId: number | null
  club: string | null
  clEntrant: string // id del club en la Champions
  inFirst: boolean // juega en 1.ª división
  foreign: boolean
  factor: number // peso de sus números de liga
  starts: number
  played: number
  lg: number
  la: number
  clg: number
  cla: number
  cs: number // vallas invictas que le tocan
  titles: BalonTitle[] // títulos de su club que cuentan para él (vacío si no jugó lo suficiente)
}

const clEntrantId = (teamId: number) => (teamId === USER_ID ? 'user' : `${HOME_ID_PREFIX}${teamId}`)
const cupEntrantId = (teamId: number) => (teamId === USER_ID ? 'user' : `t${teamId}`)

// Goles, asistencias y vallas invictas de cada club en una división
function divisionStats(div: DivisionState) {
  const goals = new Map<string, number>()
  const assists = new Map<string, number>()
  const sheets = new Map<number, number>()
  for (const m of div.results) {
    if (m.ag === 0) sheets.set(m.home, (sheets.get(m.home) ?? 0) + 1)
    if (m.hg === 0) sheets.set(m.away, (sheets.get(m.away) ?? 0) + 1)
    for (const e of m.goals) {
      goals.set(e.scorer, (goals.get(e.scorer) ?? 0) + 1)
      if (e.assist) assists.set(e.assist, (assists.get(e.assist) ?? 0) + 1)
    }
  }
  return { goals, assists, sheets }
}

function candidatesOf(league: LeagueState, champions: ClState | null): BalonCand[] {
  const cands: BalonCand[] = []
  const byId = new Map<string, BalonCand>()

  const addTeam = (t: SimTeam, div: DivisionState, inFirst: boolean) => {
    const st = divisionStats(div)
    const played = Math.max(1, div.played)
    const factor = inFirst ? 1 : BALON.secondDivisionFactor
    const teamSheets = st.sheets.get(t.id) ?? 0
    for (const p of t.squad) {
      const starts = p.starts ?? 0
      const c: BalonCand = {
        key: `t${t.id}:${p.id}`,
        id: p.id,
        name: p.name,
        pos: p.pos,
        rating: p.rating,
        teamId: t.id,
        club: t.id === USER_ID ? null : t.name,
        clEntrant: clEntrantId(t.id),
        inFirst,
        foreign: false,
        factor,
        starts,
        played,
        lg: st.goals.get(p.id) ?? 0,
        la: st.assists.get(p.id) ?? 0,
        clg: 0,
        cla: 0,
        cs: teamSheets * Math.min(1, starts / played),
        titles: [],
      }
      cands.push(c)
      byId.set(p.id, c)
    }
  }

  // Candidatos: los jugadores de los clubes de 1.ª, los de tu club (esté en la división que esté)…
  for (const t of league.divisions[1].teams) addTeam(t, league.divisions[1], true)
  if (league.userDivision === 2) {
    const mine = league.divisions[2].teams.find((t) => t.id === USER_ID)
    if (mine) addTeam(mine, league.divisions[2], false)
  }

  // …y los que marcaron o asistieron en la Champions (incluidos los de clubes invitados)
  if (champions) {
    const names = new Map(champions.entrants.map((e) => [e.id, e.name]))
    const foreign = new Map<string, BalonCand>()
    const pick = (entrant: string, p: { id: string; name: string; pos: Position; rating: number }): BalonCand => {
      const home = byId.get(p.id)
      if (home && (entrant === 'user' || entrant.startsWith(HOME_ID_PREFIX))) return home
      const key = `eu:${entrant}:${p.id}`
      let c = foreign.get(key)
      if (!c) {
        c = {
          key,
          id: p.id,
          name: p.name,
          pos: p.pos,
          rating: p.rating,
          teamId: null,
          club: names.get(entrant) ?? '',
          clEntrant: entrant,
          inFirst: false,
          foreign: true,
          factor: 0,
          starts: 0,
          played: 1,
          lg: 0,
          la: 0,
          clg: 0,
          cla: 0,
          cs: 0,
          titles: [],
        }
        foreign.set(key, c)
        cands.push(c)
      }
      return c
    }
    for (const m of clAllMatches(champions)) {
      for (const g of m.goals) {
        const entrant = g.side === 0 ? m.home : m.away
        pick(entrant, g.scorer).clg++
        if (g.assist) pick(entrant, g.assist).cla++
      }
    }
  }
  return cands
}

// Rendimiento personal de la temporada (antes del multiplicador de posición)
function performance(c: BalonCand): number {
  const goals = c.lg * c.factor + c.clg * BALON.championsMult
  const assists = c.la * c.factor + c.cla * BALON.championsMult
  const defence = c.cs * c.factor * BALON.cleanSheetWeight[c.pos]
  const rating = Math.max(0, c.rating - BALON.ratingBase) * BALON.ratingWeight
  return goals * BALON.goalWeight + assists * BALON.assistWeight + defence + rating
}

// Todos los candidatos de la temporada, con sus números y los títulos que les cuentan
export function balonPool(g: BalonInput): BalonCand[] {
  const cl = g.champions && g.champions.season === g.season ? g.champions : null
  const domestic = g.domestic && g.domestic.season === g.season ? g.domestic : null
  const cands = candidatesOf(g.league, cl)

  // Quién ganó cada título esta temporada
  const first = g.league.divisions[1]
  const leagueChampion = first.played > 0 ? computeTable(first)[0]?.id : undefined
  const clChampion = cl?.champion ?? null

  for (const c of cands) {
    // Los títulos solo cuentan si el jugador participó (titular en al menos minShare de los partidos de liga de su club)
    if (!(c.foreign || c.starts >= BALON.minShare * c.played)) continue
    if (clChampion !== null && c.clEntrant === clChampion) c.titles.push('champions')
    if (c.teamId === null) continue
    if (c.inFirst && c.teamId === leagueChampion) c.titles.push('liga')
    if (domestic && cupEntrantId(c.teamId) === domestic.copa.champion) c.titles.push('copa')
    if (domestic && cupEntrantId(c.teamId) === domestic.supercopa.champion) c.titles.push('supercopa')
  }
  return cands
}

// Rendimiento ya con el multiplicador de su posición: es lo que ordena el ranking personal
export function balonScore(c: BalonCand): number {
  return performance(c) * BALON.positionMult[c.pos]
}

export function computeBalonDeOro(g: BalonInput): BalonRecord | null {
  const cands = balonPool(g)
  if (cands.length === 0) return null

  // Ranking de rendimiento
  const ranked = cands.map((c) => ({ c, perf: balonScore(c) })).sort((a, b) => b.perf - a.perf || a.c.key.localeCompare(b.c.key))

  const rng = createRng(mixSeed(g.seed, g.season, 8801))
  const entries = ranked.map(({ c }, i): BalonEntry => {
    const titlePts = c.titles.reduce((n, t) => n + BALON.titles[t], 0)
    const rankPts = BALON.rankPoints[i] ?? 0
    return {
      id: c.id,
      name: c.name,
      pos: c.pos,
      club: c.club,
      teamId: c.teamId,
      points: titlePts + rankPts + rng() * BALON.tiebreak,
      titlePts,
      rankPts,
      rank: i + 1,
      goals: c.lg + c.clg,
      assists: c.la + c.cla,
      clGoals: c.clg,
      clAssists: c.cla,
      titles: c.titles,
    }
  })

  const top = entries
    .sort((a, b) => b.points - a.points || a.rank - b.rank)
    .slice(0, BALON.keep)
    .map((e) => ({ ...e, points: Math.round(e.points) }))
  return { season: g.season, top }
}

// Prestigio que gana el club de cada uno de los tres primeros (solo clubes de tu liga)
export function balonPrestige(record: BalonRecord | null): { teamId: number; bonus: number }[] {
  if (!record) return []
  return record.top
    .slice(0, BALON.prestige.length)
    .flatMap((e, i) => (e.teamId === null ? [] : [{ teamId: e.teamId, bonus: BALON.prestige[i] }]))
}

export const POS_LABEL: Record<Position, string> = { POR: 'Portero', DEF: 'Defensa', MED: 'Mediocampista', DEL: 'Delantero' }
export const TITLE_LABEL: Record<BalonTitle, string> = {
  champions: 'Champions',
  liga: 'Liga',
  copa: 'Copa',
  supercopa: 'Supercopa',
}

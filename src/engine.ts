import { clamp, createRng, mixSeed, normal, pickWeighted, poisson, round1, shuffle } from './rng'
import type { Rng } from './rng'
import { placeholderSquad, squadStrength, userSquad } from './squads'
import type { SimPlayer } from './squads'
import { DIV1_NAMES, DIV2_NAMES } from './sample'

export type Level = 1 | 2
export type Tactic = 'ofensiva' | 'equilibrada' | 'defensiva'

export const USER_ID = 0
export const TEAMS_PER_DIVISION = 20
export const ROUNDS = 2 * (TEAMS_PER_DIVISION - 1) // 38 jornadas
export const PROMOTED_COUNT = 3 // provisorio: las reglas de ascenso están pendientes

/* ---------- Ajustes del modelo de partido ---------- */
const BASE_GOALS = 1.25 // goles esperados de un equipo igual al rival, en campo neutral
const HOME_FACTOR = 1.15
const AWAY_FACTOR = 0.9
const STRENGTH_SENSITIVITY = 0.045 // cuánto pesa cada punto de diferencia de nivel
const FORM_EFFECT = 2 // puntos de nivel que aporta la forma (de -1 a 1)

const TACTIC_MOD: Record<Tactic, { atk: number; def: number }> = {
  ofensiva: { atk: 2, def: -2 },
  equilibrada: { atk: 0, def: 0 },
  defensiva: { atk: -2, def: 2 },
}

const SCORE_WEIGHT = { POR: 0.005, DEF: 0.12, MED: 0.45, DEL: 1 }
const ASSIST_WEIGHT = { POR: 0.02, DEF: 0.35, MED: 1, DEL: 0.7 }

/* ---------- Tipos ---------- */
export interface SimTeam {
  id: number
  name: string // vacío en el club del jugador
  strength: number
  form: number // de -1 a 1, según los últimos resultados
  tactic: Tactic
  squad: SimPlayer[]
}

export interface GoalEvent {
  team: number
  scorer: string
  assist: string | null
  minute: number
}

export interface MatchStats {
  poss: number // % de posesión del local
  shots: [number, number]
  onTarget: [number, number]
  corners: [number, number]
  fouls: [number, number]
  yellow: [number, number]
  red: [number, number]
}

export interface MatchResult {
  round: number
  home: number
  away: number
  hg: number
  ag: number
  stats: MatchStats
  goals: GoalEvent[]
}

export interface DivisionState {
  level: Level
  teams: SimTeam[]
  schedule: [number, number][][] // por jornada, pares [local, visitante]
  results: MatchResult[]
  played: number // jornadas simuladas
}

export interface LeagueState {
  userDivision: Level
  divisions: Record<Level, DivisionState>
}

export interface StandRow {
  id: number
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
}

export interface SeasonOutcome {
  division: Level
  position: number
  points: number
  promoted: boolean
  relegated: boolean
  champion: boolean
}

/* ---------- Partido ---------- */
function attack(t: SimTeam): number {
  return t.strength + TACTIC_MOD[t.tactic].atk + t.form * FORM_EFFECT
}

function defense(t: SimTeam): number {
  return t.strength + TACTIC_MOD[t.tactic].def + t.form * FORM_EFFECT
}

function shotsFor(lambda: number, goals: number, rng: Rng): number {
  return Math.max(goals, Math.round(lambda * 7 + 1 + normal(rng) * 2))
}

function goalEvents(team: SimTeam, goals: number, rng: Rng): GoalEvent[] {
  const events: GoalEvent[] = []
  for (let i = 0; i < goals; i++) {
    const scorer = pickWeighted(
      team.squad,
      (p) => SCORE_WEIGHT[p.pos] * Math.pow(p.rating / 70, 3) * (p.starter ? 1 : 0.3),
      rng,
    )
    if (!scorer) continue
    let assist: string | null = null
    if (rng() < 0.7) {
      const helper = pickWeighted(
        team.squad.filter((p) => p.id !== scorer.id),
        (p) => ASSIST_WEIGHT[p.pos] * Math.pow(p.rating / 70, 2) * (p.starter ? 1 : 0.3),
        rng,
      )
      assist = helper ? helper.id : null
    }
    events.push({ team: team.id, scorer: scorer.id, assist, minute: 1 + Math.floor(rng() * 90) })
  }
  return events
}

export function simulateMatch(home: SimTeam, away: SimTeam, round: number, rng: Rng): MatchResult {
  const lamHome = clamp(BASE_GOALS * HOME_FACTOR * Math.exp(STRENGTH_SENSITIVITY * (attack(home) - defense(away))), 0.15, 5)
  const lamAway = clamp(BASE_GOALS * AWAY_FACTOR * Math.exp(STRENGTH_SENSITIVITY * (attack(away) - defense(home))), 0.15, 5)
  const hg = poisson(lamHome, rng)
  const ag = poisson(lamAway, rng)

  const shotsH = shotsFor(lamHome, hg, rng)
  const shotsA = shotsFor(lamAway, ag, rng)
  const onTargetH = Math.min(shotsH, hg + poisson(shotsH * 0.2, rng))
  const onTargetA = Math.min(shotsA, ag + poisson(shotsA * 0.2, rng))
  const foulsH = Math.max(4, Math.round(12 + normal(rng) * 3))
  const foulsA = Math.max(4, Math.round(12 + normal(rng) * 3))

  const stats: MatchStats = {
    poss: clamp(Math.round(52 + (home.strength - away.strength) * 1.1 + normal(rng) * 4), 28, 72),
    shots: [shotsH, shotsA],
    onTarget: [onTargetH, onTargetA],
    corners: [poisson(shotsH * 0.42, rng), poisson(shotsA * 0.42, rng)],
    fouls: [foulsH, foulsA],
    yellow: [poisson(foulsH * 0.17, rng), poisson(foulsA * 0.17, rng)],
    red: [rng() < 0.02 ? 1 : 0, rng() < 0.02 ? 1 : 0],
  }

  const goals = [...goalEvents(home, hg, rng), ...goalEvents(away, ag, rng)].sort((a, b) => a.minute - b.minute)
  return { round, home: home.id, away: away.id, hg, ag, stats, goals }
}

/* ---------- Calendario ---------- */
// Todos contra todos, ida y vuelta (método del círculo)
export function buildSchedule(teamIds: number[]): [number, number][][] {
  const n = teamIds.length
  const ids = [...teamIds]
  const firstLeg: [number, number][][] = []
  for (let r = 0; r < n - 1; r++) {
    const round: [number, number][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i]
      const b = ids[n - 1 - i]
      round.push((r + i) % 2 === 0 ? [a, b] : [b, a])
    }
    firstLeg.push(round)
    const last = ids.pop()
    if (last !== undefined) ids.splice(1, 0, last)
  }
  const secondLeg = firstLeg.map((round) => round.map(([h, a]): [number, number] => [a, h]))
  return [...firstLeg, ...secondLeg]
}

/* ---------- Divisiones ---------- */
function nextForm(form: number, goalDiff: number): number {
  const score = goalDiff > 0 ? 1 : goalDiff < 0 ? -1 : 0
  return clamp(form * 0.7 + 0.3 * score, -1, 1)
}

// Simula las jornadas pendientes hasta la jornada indicada, sin modificar el estado recibido
export function simulateDivision(div: DivisionState, toRound: number, rng: Rng): DivisionState {
  const teams = div.teams.map((t) => ({ ...t }))
  const byId = new Map(teams.map((t) => [t.id, t]))
  const results = [...div.results]
  const target = Math.min(toRound, div.schedule.length)

  for (let r = div.played; r < target; r++) {
    for (const [homeId, awayId] of div.schedule[r]) {
      const home = byId.get(homeId)
      const away = byId.get(awayId)
      if (!home || !away) continue
      const match = simulateMatch(home, away, r + 1, rng)
      results.push(match)
      home.form = nextForm(home.form, match.hg - match.ag)
      away.form = nextForm(away.form, match.ag - match.hg)
    }
  }
  return { ...div, teams, results, played: Math.max(div.played, target) }
}

export function computeTable(div: DivisionState): StandRow[] {
  const rows = new Map<number, StandRow>(
    div.teams.map((t) => [t.id, { id: t.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]),
  )
  for (const m of div.results) {
    const h = rows.get(m.home)
    const a = rows.get(m.away)
    if (!h || !a) continue
    h.played++
    a.played++
    h.gf += m.hg
    h.ga += m.ag
    a.gf += m.ag
    a.ga += m.hg
    if (m.hg > m.ag) {
      h.won++
      a.lost++
      h.points += 3
    } else if (m.hg < m.ag) {
      a.won++
      h.lost++
      a.points += 3
    } else {
      h.drawn++
      a.drawn++
      h.points += 1
      a.points += 1
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.id - y.id,
  )
}

/* ---------- Liga ---------- */
function makeTeam(id: number, name: string, strength: number, rng: Rng): SimTeam {
  const s = round1(strength)
  return { id, name, strength: s, form: 0, tactic: 'equilibrada', squad: placeholderSquad(id, s, rng) }
}

function makeUserTeam(): SimTeam {
  const squad = userSquad()
  return { id: USER_ID, name: '', strength: squadStrength(squad), form: 0, tactic: 'equilibrada', squad }
}

function buildDivision(level: Level, teams: SimTeam[], rng: Rng): DivisionState {
  const order = shuffle(teams.map((t) => t.id), rng)
  return { level, teams, schedule: buildSchedule(order), results: [], played: 0 }
}

export function createLeague(seed: number): LeagueState {
  const rng = createRng(mixSeed(seed, 7))

  const first = DIV1_NAMES.map((name, i) => makeTeam(i + 1, name, 81 - i * 0.6 + normal(rng), rng))

  let nextId = DIV1_NAMES.length + 1
  const second: SimTeam[] = DIV2_NAMES.map((name, i) => {
    if (name === null) return makeUserTeam()
    return makeTeam(nextId++, name, 72.5 - i * 0.55 + normal(rng), rng)
  })

  return {
    userDivision: 2,
    divisions: { 1: buildDivision(1, first, rng), 2: buildDivision(2, second, rng) },
  }
}

export function setUserTactic(league: LeagueState, tactic: Tactic): LeagueState {
  const level = league.userDivision
  const div = league.divisions[level]
  const teams = div.teams.map((t) => (t.id === USER_ID ? { ...t, tactic } : t))
  return { ...league, divisions: { ...league.divisions, [level]: { ...div, teams } } }
}

export function simulateLeague(league: LeagueState, toRound: number, seed: number): LeagueState {
  const rng = createRng(seed)
  return {
    ...league,
    divisions: {
      1: simulateDivision(league.divisions[1], toRound, rng),
      2: simulateDivision(league.divisions[2], toRound, rng),
    },
  }
}

// Posición actual del club del jugador. Antes de jugar, una estimación según el nivel.
export function userPosition(league: LeagueState): number {
  const div = league.divisions[league.userDivision]
  if (div.played === 0) {
    const byStrength = [...div.teams].sort((a, b) => b.strength - a.strength || a.id - b.id)
    return byStrength.findIndex((t) => t.id === USER_ID) + 1
  }
  return computeTable(div).findIndex((r) => r.id === USER_ID) + 1
}

export function userSeasonResult(league: LeagueState): SeasonOutcome {
  const level = league.userDivision
  const table = computeTable(league.divisions[level])
  const idx = table.findIndex((r) => r.id === USER_ID)
  const position = idx + 1
  return {
    division: level,
    position,
    points: table[idx]?.points ?? 0,
    promoted: level === 2 && position <= PROMOTED_COUNT,
    relegated: level === 1 && position > TEAMS_PER_DIVISION - PROMOTED_COUNT,
    champion: position === 1,
  }
}

const LEVEL_MEAN: Record<Level, number> = { 1: 76, 2: 67 }

function evolveTeam(team: SimTeam, level: Level, rng: Rng): SimTeam {
  if (team.id === USER_ID) return { ...team, form: 0 }
  const drift = (LEVEL_MEAN[level] - team.strength) * 0.08 + normal(rng)
  const strength = round1(clamp(team.strength + drift, 55, 88))
  return { ...team, strength, form: 0, tactic: 'equilibrada', squad: placeholderSquad(team.id, strength, rng) }
}

// Cierra la temporada: ascensos, descensos y arranque de la siguiente
export function finishSeason(league: LeagueState, seed: number): LeagueState {
  const rng = createRng(seed)
  const div1 = league.divisions[1]
  const div2 = league.divisions[2]
  const table1 = computeTable(div1)
  const table2 = computeTable(div2)

  const promotedIds = new Set(table2.slice(0, PROMOTED_COUNT).map((r) => r.id))
  const relegatedIds = new Set(table1.slice(TEAMS_PER_DIVISION - PROMOTED_COUNT).map((r) => r.id))

  const stay1 = div1.teams.filter((t) => !relegatedIds.has(t.id))
  const up = div2.teams.filter((t) => promotedIds.has(t.id))
  const stay2 = div2.teams.filter((t) => !promotedIds.has(t.id))
  const down = div1.teams.filter((t) => relegatedIds.has(t.id))

  const newFirst = [...stay1, ...up].map((t) => evolveTeam(t, 1, rng))
  const newSecond = [...stay2, ...down].map((t) => evolveTeam(t, 2, rng))

  return {
    userDivision: newFirst.some((t) => t.id === USER_ID) ? 1 : 2,
    divisions: { 1: buildDivision(1, newFirst, rng), 2: buildDivision(2, newSecond, rng) },
  }
}

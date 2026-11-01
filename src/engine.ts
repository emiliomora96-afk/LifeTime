import { clamp, createRng, mixSeed, normal, pickWeighted, poisson, round1, shuffle } from './rng'
import type { Rng } from './rng'
import { FORMATION_COUNT, POSITION_ORDER, pickStarters, placeholderSquad, progressSquad, repairStarters, squadStrength, userSquad } from './squads'
import type { SimPlayer } from './players'
import type { Position } from './sample'
import { TIER_PROFILE, USER_SLOT_DIV2 } from './clubs'
import { activeLeague, giantPool } from './activeLeague'
import type { LeagueId } from './leagues'
import { leagueDef } from './leagues'
import type { ClubDef, Tier } from './clubs'
import { generateIntake } from './academy'
import { aiTransferWindow, evolveAiTeam, leagueMean } from './aiclubs'
import { START } from './lifetimeConfig'
import type { MoveNews } from './aiclubs'

export type Level = 1 | 2
export type Tactic = 'ofensiva' | 'equilibrada' | 'defensiva'

export const USER_ID = 0
export const TEAMS_PER_DIVISION = 20
export const ROUNDS = 2 * (TEAMS_PER_DIVISION - 1) // 38 jornadas
export const LEAGUE_VERSION = 6
export const PROMOTED_COUNT = 3 // provisorio: las reglas de ascenso están pendientes

/* ---------- Ajustes del modelo de partido ---------- */
const BASE_GOALS = 1.3 // goles esperados de un equipo igual al rival, en campo neutral
const HOME_FACTOR = 1.15
const AWAY_FACTOR = 0.9
const STRENGTH_SENSITIVITY = 0.045 // cuánto pesa cada punto de diferencia de nivel
const FORM_EFFECT = 2 // puntos de nivel que aporta la forma (de -1 a 1)

const TACTIC_MOD: Record<Tactic, { atk: number; def: number }> = {
  ofensiva: { atk: 2, def: -2 },
  equilibrada: { atk: 0, def: 0 },
  defensiva: { atk: -2, def: 2 },
}

const SCORE_WEIGHT = { POR: 0.005, DEF: 0.1, MED: 0.3, DEL: 1 }
// Los goles se concentran en los mejores: un delantero de élite se lleva buena parte de los goles de su equipo
const SCORE_EXPONENT = 9
// Cada jugador tiene su "olfato": un rematador nato (hasta +25 %) o uno más discreto (hasta -15 %), fijo según su id
function finishing(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 0.8 + 0.65 * ((h % 1000) / 999)
}
// Peso de un jugador al repartir los goles de su equipo (lo usan la liga, las copas y las competiciones europeas)
export function scoringWeight(p: { id: string; pos: Position; rating: number; starter?: boolean }): number {
  return SCORE_WEIGHT[p.pos] * Math.pow(p.rating / 70, SCORE_EXPONENT) * finishing(p.id) * (p.starter ? 1 : 0.3)
}
const ASSIST_WEIGHT = { POR: 0.02, DEF: 0.35, MED: 1, DEL: 0.7 }

/* ---------- Tipos ---------- */
export interface SimTeam {
  id: number
  name: string // vacío en el club del jugador
  level: number // nivel al que apunta el club (la plantilla puede variar alrededor)
  strength: number // promedio de valoración del once inicial
  form: number // de -1 a 1, según los últimos resultados
  tactic: Tactic
  squad: SimPlayer[]
  city?: string // ciudad del club (el club del jugador la tiene en su ficha)
  colors?: [string, string] // colores del club
  tier?: Tier // gigante, aspirante, media tabla...
  // Clubes de la IA (Paso 10): viven con las mismas reglas que el club del jugador
  budget?: number // dinero del club
  prestige?: number // 0 a 100, como el del jugador
  academy?: SimPlayer[] // juveniles de su cantera
  academyLevel?: number // inversión en cantera, 0 a 3
  stadiumLevel?: number // mantenimiento del estadio, 0 a 3
  autoLineup?: boolean // false: el jugador eligió su once (solo el club del jugador). Sin definir = automático
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
  v?: number // versión de la estructura (si cambia, la partida guardada se reinicia)
  year: number // temporadas cerradas
  moves?: MoveNews[] // fichajes y juveniles destacados de la última ventana de la IA
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
      scoringWeight,
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
  // Los titulares de este tramo suman las jornadas jugadas (cuenta para su crecimiento)
  const rounds = Math.max(0, target - div.played)
  if (rounds > 0) {
    for (const team of teams) {
      team.squad = team.squad.map((p) => (p.starter ? { ...p, starts: (p.starts ?? 0) + rounds } : p))
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
function makeTeam(id: number, def: ClubDef, level: number, rng: Rng, tier: Tier = def.tier): SimTeam {
  const profile = TIER_PROFILE[tier]
  const lv = round1(level)
  // Plantilla aleatoria: los gigantes también (con más extranjeros). Después fichan y suben juveniles como cualquiera.
  const squad = placeholderSquad(id, lv, rng, tier === 'elite' || tier === 'grande' ? giantPool() : undefined)
  const strength = squadStrength(squad)
  return {
    id,
    name: def.name,
    level: lv,
    strength,
    form: 0,
    tactic: 'equilibrada',
    squad,
    city: def.city,
    colors: def.colors,
    tier,
    budget: Math.round((profile.budget * (0.8 + rng() * 0.4)) / 10_000) * 10_000,
    prestige: profile.prestige,
    academyLevel: profile.academy,
    stadiumLevel: profile.stadium,
    academy: generateIntake([], profile.academy, strength, 0, rng, `t${id}`),
  }
}

function makeUserTeam(rng: Rng): SimTeam {
  const squad = userSquad(rng)
  const strength = squadStrength(squad)
  return { id: USER_ID, name: '', level: strength, strength, form: 0, tactic: 'equilibrada', squad }
}

function buildDivision(level: Level, teams: SimTeam[], rng: Rng): DivisionState {
  const order = shuffle(teams.map((t) => t.id), rng)
  return { level, teams, schedule: buildSchedule(order), results: [], played: 0 }
}

// leagueId: la liga en la que se crea el mundo (si no se indica, la de la partida en curso)
export function createLeague(seed: number, leagueId?: LeagueId): LeagueState {
  const rng = createRng(mixSeed(seed, 7))
  const def = leagueId ? leagueDef(leagueId) : activeLeague()
  const DIV1_CLUBS = def.div1
  const DIV2_CLUBS = def.div2

  // Punto de partida (lifetimeConfig.ts, START): el Val medio de cada división y cuántos clubes arrancan como élite.
  // Se conserva el orden y las diferencias del diseño de cada club (def.base), reescaladas a la media de la división.
  const baseMean = (defs: ClubDef[]) => defs.reduce((sum, d) => sum + d.base, 0) / defs.length
  const startLevel = (def: ClubDef, defs: ClubDef[], cfg: { mean: number; spread: number }) =>
    cfg.mean + (def.base - baseMean(defs)) * cfg.spread + normal(rng) * START.clubNoise
  // Los N primeros de 1.ª (los mejores) son élite; si el diseño del club decía élite pero queda fuera del corte, pasa a grande
  const tierOf = (def: ClubDef, i: number): Tier => (i < START.eliteClubsPerLeague ? 'elite' : def.tier === 'elite' ? 'grande' : def.tier)

  const first = DIV1_CLUBS.map((def, i) => makeTeam(i + 1, def, startLevel(def, DIV1_CLUBS, START.div1), rng, tierOf(def, i)))

  let nextId = DIV1_CLUBS.length + 1
  const second: SimTeam[] = []
  DIV2_CLUBS.forEach((def, i) => {
    if (i === USER_SLOT_DIV2) second.push(makeUserTeam(rng))
    second.push(makeTeam(nextId++, def, startLevel(def, DIV2_CLUBS, START.div2), rng))
  })

  return {
    v: LEAGUE_VERSION,
    year: 0,
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

// Cambia la plantilla del club del jugador y recalcula su nivel (afecta a los partidos que faltan)
function updateUserTeam(league: LeagueState, change: (team: SimTeam) => SimTeam): LeagueState {
  const level = league.userDivision
  const div = league.divisions[level]
  const teams = div.teams.map((t) => (t.id === USER_ID ? change(t) : t))
  return { ...league, divisions: { ...league.divisions, [level]: { ...div, teams } } }
}

// Cambia la plantilla. Si el jugador eligió su once, se respeta; si no, el entrenador elige el mejor.
function updateUserSquad(league: LeagueState, change: (squad: SimPlayer[]) => SimPlayer[]): LeagueState {
  return updateUserTeam(league, (t) => {
    const changed = change(t.squad)
    const squad = t.autoLineup === false ? repairStarters(changed) : pickStarters(changed)
    return { ...t, squad, strength: squadStrength(squad) }
  })
}

export function getUserTeam(league: LeagueState): SimTeam | undefined {
  return league.divisions[league.userDivision].teams.find((t) => t.id === USER_ID)
}

// Intercambia un titular y un suplente de la misma posición. Desde entonces el once es manual.
export function swapUserStarters(league: LeagueState, idA: string, idB: string): LeagueState {
  const squad = getUserSquad(league)
  const a = squad.find((p) => p.id === idA)
  const b = squad.find((p) => p.id === idB)
  if (!a || !b || a.pos !== b.pos || a.starter === b.starter) return league
  return updateUserTeam(league, (t) => {
    const next = t.squad.map((p) => (p.id === idA || p.id === idB ? { ...p, starter: !p.starter } : p))
    return { ...t, autoLineup: false, squad: next, strength: squadStrength(next) }
  })
}

// Corrige un once que no cumple el 4-3-3 (partidas guardadas con una versión anterior, por ejemplo).
// Respeta lo que eligió el jugador y solo arregla lo que esté roto.
export function normalizeUserLineup(league: LeagueState): LeagueState {
  const team = getUserTeam(league)
  if (!team) return league
  const starters = team.squad.filter((p) => p.starter)
  const ok =
    starters.length === 11 &&
    POSITION_ORDER.every((pos) => starters.filter((p) => p.pos === pos).length === FORMATION_COUNT[pos])
  if (ok) return league
  return updateUserTeam(league, (t) => {
    const squad = repairStarters(t.squad)
    return { ...t, squad, strength: squadStrength(squad) }
  })
}

// Vuelve a dejar que el entrenador elija el mejor once
export function setUserAutoLineup(league: LeagueState): LeagueState {
  return updateUserTeam(league, (t) => {
    const next = pickStarters(t.squad)
    return { ...t, autoLineup: true, squad: next, strength: squadStrength(next) }
  })
}

export function addUserPlayer(league: LeagueState, player: SimPlayer): LeagueState {
  return updateUserSquad(league, (squad) => [...squad, { ...player, starter: false }])
}

export function removeUserPlayer(league: LeagueState, playerId: string): LeagueState {
  return updateUserSquad(league, (squad) => squad.filter((p) => p.id !== playerId))
}

export function getUserSquad(league: LeagueState): SimPlayer[] {
  const team = league.divisions[league.userDivision].teams.find((t) => t.id === USER_ID)
  return team ? team.squad : []
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

export interface SeasonOptions {
  academyBonus: number // mejora de los juveniles del club del jugador
  leaving: string[] // jugadores del club del jugador que se van al terminar la temporada
  userAsAi?: boolean // simulación sin interfaz: el club del jugador se trata como un club más de la IA (no hay nadie que lo gestione)
}

// Un año más para todos los jugadores del club del jugador
function evolveUserTeam(team: SimTeam, year: number, rng: Rng, o: SeasonOptions): SimTeam {
  const squad = progressSquad(
    team.squad,
    {
      level: team.strength,
      youthBonus: o.academyBonus,
      useYouth: true,
      removeIds: o.leaving,
      keepLineup: team.autoLineup === false,
      idPrefix: `u-y${year}`,
    },
    rng,
  )
  return { ...team, level: team.strength, strength: squadStrength(squad), form: 0, squad }
}

// Ventana de fichajes de la IA a mitad de temporada (más pequeña que la de verano)
export function aiWinterWindow(league: LeagueState, seed: number, userAsAi = false): LeagueState {
  const rng = createRng(seed)
  const ai = [...league.divisions[1].teams, ...league.divisions[2].teams].filter((t) => userAsAi || t.id !== USER_ID)
  const divisionOf: Record<number, Level> = {}
  for (const level of [1, 2] as Level[]) for (const t of league.divisions[level].teams) divisionOf[t.id] = level
  const { teams, news } = aiTransferWindow(ai, rng, { window: 'invierno', season: league.year + 1, tag: `i${league.year + 1}`, divisionOf })
  const byId = new Map(teams.map((t) => [t.id, t]))
  const swap = (d: DivisionState): DivisionState => ({ ...d, teams: d.teams.map((t) => byId.get(t.id) ?? t) })
  return { ...league, moves: news, divisions: { 1: swap(league.divisions[1]), 2: swap(league.divisions[2]) } }
}

// Cierra la temporada: ascensos, descensos, un año más para todos, mercado de la IA y arranque de la siguiente
export function finishSeason(
  league: LeagueState,
  seed: number,
  options: SeasonOptions = { academyBonus: 0, leaving: [] },
): LeagueState {
  const rng = createRng(seed)
  const year = league.year + 1
  const div1 = league.divisions[1]
  const div2 = league.divisions[2]
  const table1 = computeTable(div1)
  const table2 = computeTable(div2)

  const promotedIds = new Set(table2.slice(0, PROMOTED_COUNT).map((r) => r.id))
  const relegatedIds = new Set(table1.slice(TEAMS_PER_DIVISION - PROMOTED_COUNT).map((r) => r.id))
  const position = new Map<number, number>()
  table1.forEach((r, i) => position.set(r.id, i + 1))
  table2.forEach((r, i) => position.set(r.id, i + 1))

  const stay1 = div1.teams.filter((t) => !relegatedIds.has(t.id))
  const up = div2.teams.filter((t) => promotedIds.has(t.id))
  const stay2 = div2.teams.filter((t) => !promotedIds.has(t.id))
  const down = div1.teams.filter((t) => relegatedIds.has(t.id))

  const news: MoveNews[] = []
  // Media actual de la liga (Val del once de todos los clubes): a ella se calibran los fichajes de relleno
  const ref = leagueMean([...div1.teams, ...div2.teams])
  const evolve = (t: SimTeam, from: Level, to: Level): SimTeam =>
    t.id === USER_ID && !options.userAsAi
      ? evolveUserTeam(t, year, rng, options)
      : evolveAiTeam(
          t,
          {
            division: from,
            position: position.get(t.id) ?? 10,
            promoted: promotedIds.has(t.id),
            relegated: relegatedIds.has(t.id),
            newDivision: to,
            year: year + 1,
            ref,
          },
          rng,
          news,
        )

  const first = [...stay1.map((t) => evolve(t, 1, 1)), ...up.map((t) => evolve(t, 2, 1))]
  const second = [...stay2.map((t) => evolve(t, 2, 2)), ...down.map((t) => evolve(t, 1, 2))]

  // Mercado de verano de la IA: los clubes ricos van a por los mejores jugadores
  const ai = [...first, ...second].filter((t) => options.userAsAi || t.id !== USER_ID)
  const divisionOf: Record<number, Level> = {}
  first.forEach((t) => (divisionOf[t.id] = 1))
  second.forEach((t) => (divisionOf[t.id] = 2))
  const window = aiTransferWindow(ai, rng, { window: 'verano', season: year + 1, tag: `v${year + 1}`, divisionOf })
  const byId = new Map(window.teams.map((t) => [t.id, t]))
  const newFirst = first.map((t) => byId.get(t.id) ?? t)
  const newSecond = second.map((t) => byId.get(t.id) ?? t)

  const moves = [...window.news, ...news.filter((n) => n.kind === 'cantera')].slice(0, 16)
  return {
    v: LEAGUE_VERSION,
    year,
    moves,
    userDivision: newFirst.some((t) => t.id === USER_ID) ? 1 : 2,
    divisions: { 1: buildDivision(1, newFirst, rng), 2: buildDivision(2, newSecond, rng) },
  }
}

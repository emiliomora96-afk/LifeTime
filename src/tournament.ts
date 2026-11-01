import type { LeagueState, MatchStats, SimTeam } from './engine'
import { buildSchedule, getUserTeam, scoringWeight, simulateMatch } from './engine'
import type { Entrant, EuropeId, EuropeSeason } from './europe'
import { EUROPE } from './europe'
import type { NatId, NatPool } from './nations'
import { SPAIN_POOL } from './nations'
import { activeLeague } from './activeLeague'
import type { SimPlayer } from './players'
import type { Rng } from './rng'
import { clamp, createRng, mixSeed, pickWeighted, poisson, shuffle } from './rng'
import type { Position } from './sample'
import { placeholderSquad, squadStrength } from './squads'

/* ==========================================================================
   Paso 9: torneo europeo
   El motor calcula TODA la competición (grupos, cuadro, resultados, estadísticas
   y aportes de cada jugador) antes de abrir la pantalla. La pantalla solo lo
   presenta, así que nunca se desincroniza con el motor.
   ========================================================================== */

/* ---------- Formato (todo configurable aquí) ---------- */
export const GROUP_COUNT = 4 // grupos
export const GROUP_SIZE = 4 // clubes por grupo
export const GROUP_LEGS: 1 | 2 = 1 // 1 = solo ida (3 partidos por club). 2 = ida y vuelta (6 partidos)
export const GROUP_ROUNDS = (GROUP_SIZE - 1) * GROUP_LEGS
export const FIELD_SIZE = GROUP_COUNT * GROUP_SIZE // 16 clubes
const GROUP_NAMES = ['A', 'B', 'C', 'D']

export type Stage = 'group' | 'quarter' | 'semi' | 'final'
export const STAGES: Stage[] = ['group', 'quarter', 'semi', 'final']
export const STAGE_LABEL: Record<Stage, string> = {
  group: 'Fase de grupos',
  quarter: 'Cuartos de final',
  semi: 'Semifinales',
  final: 'Final',
}
export const STAGE_SHORT: Record<Stage, string> = { group: 'Grupos', quarter: 'Cuartos', semi: 'Semis', final: 'Final' }

/* ---------- Ajustes del modelo (eliminatorias) ---------- */
export const EXTRA_TIME_GOALS = 0.4 // goles esperados por equipo en la prórroga (30 min), a igual nivel
export const STRENGTH_SENSITIVITY = 0.045 // mismo peso del nivel que en la liga
export const PENALTY_BASE = 0.76 // probabilidad de marcar un penal
export const PENALTY_EDGE = 0.004 // ventaja por cada punto de nivel (muy pequeña: los penales son lotería)
const ASSIST_WEIGHT: Record<Position, number> = { POR: 0.02, DEF: 0.35, MED: 1, DEL: 0.7 }

/* ---------- Tipos ---------- */
// Referencia a un jugador, con lo justo para mostrarlo (nombre, posición y valoración)
export interface TPlayer {
  id: string
  name: string
  pos: Position
  rating: number
}

export interface TGoal {
  side: 0 | 1 // 0 = local, 1 = visitante
  minute: number // más de 90 = prórroga
  scorer: TPlayer
  assist: TPlayer | null
}

export type MatchTag =
  | 'remontada'
  | 'goleada'
  | 'ultimo-minuto'
  | 'sorpresa'
  | 'prorroga'
  | 'penales'
  | 'duelo-espanol'

export const TAG_LABEL: Record<MatchTag, string> = {
  remontada: '🔥 Remontada',
  goleada: '💥 Goleada',
  'ultimo-minuto': '⏱️ Gol sobre la hora',
  sorpresa: '😱 Sorpresa',
  prorroga: '⌛ Prórroga',
  penales: '🎯 Penales',
  // El nombre interno es el de cuando solo existía España: hoy es el duelo entre dos clubes de tu propio país
  get 'duelo-espanol'() {
    const l = activeLeague()
    return `${l.flag} Duelo ${l.adjective}`
  },
}

export interface TMatch {
  id: string
  seq: number // orden cronológico en todo el torneo
  stage: Stage
  group: number | null // índice del grupo (solo en la fase de grupos)
  matchday: number | null // jornada de grupos (1, 2, 3...)
  home: string // id del club (Entrant.id)
  away: string
  hg: number // goles del local (con prórroga, sin penales)
  ag: number
  extraTime: boolean
  pens: [number, number] | null // tanda de penales [local, visitante]
  winner: string | null // null = empate (solo en grupos)
  stats: MatchStats // estadísticas de los 90 minutos (poss = % del local)
  goals: TGoal[]
  mvp: { side: 0 | 1; player: TPlayer } | null // figura del partido
  tags: MatchTag[]
}

export interface TGroup {
  name: string
  ids: string[] // clubes del grupo
  matches: TMatch[] // en orden cronológico
}

export interface TRound {
  stage: Exclude<Stage, 'group'>
  matches: TMatch[]
}

export interface Tournament {
  comp: EuropeId
  season: number
  entrants: Entrant[]
  groups: TGroup[]
  rounds: TRound[] // cuartos, semifinales, final
  champion: string // id del campeón
  runnerUp: string // id del finalista
}

// Lo que se guarda en la partida: la competición del club (o la principal si no juega) y los campeones de todas
export interface TournamentSeason {
  season: number
  main: Tournament
  champions: Record<EuropeId, Entrant>
}

export interface GroupRow {
  id: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
}

export type Reach = 'campeon' | 'final' | 'semi' | 'cuartos' | 'octavos' | 'playoff' | 'liga' | 'grupos'

export const REACH_LABEL: Record<Reach, string> = {
  campeon: 'Campeón',
  final: 'Finalista',
  semi: 'Semifinalista',
  cuartos: 'Cuartos de final',
  octavos: 'Octavos de final',
  playoff: 'Playoff',
  liga: 'Fase de liga',
  grupos: 'Fase de grupos',
}

// Lo que se anota en el historial de la temporada
export interface EuroRecord {
  comp: EuropeId
  reach: Reach
  champion: boolean
  goals: number // goles del club en el torneo
  margin: number // mayor diferencia de goles en una victoria
}

/* ---------- Equipos del torneo ---------- */
interface Ctx {
  teams: Map<string, SimTeam> // por id de club. Cada SimTeam usa un id numérico propio (1 a 16)
  byId: Map<string, Entrant>
  rng: Rng
}

const COUNTRY_NAT: Record<string, NatId> = { ESP: 'ESP', ING: 'ING', ITA: 'ITA', ALE: 'ALE', FRA: 'FRA', POR: 'POR', HOL: 'PBA' }

// Los jugadores de un club invitado son sobre todo de su país, con algún extranjero
export function poolFor(country: string): NatPool {
  const nat = COUNTRY_NAT[country]
  if (!nat || nat === 'ESP') return SPAIN_POOL
  return { [nat]: 12, BRA: 1, ARG: 1, SEN: 1, CRO: 1 }
}

export function findLeagueTeam(league: LeagueState, id: number): SimTeam | undefined {
  return league.divisions[1].teams.find((t) => t.id === id) ?? league.divisions[2].teams.find((t) => t.id === id)
}

function buildTeams(entrants: Entrant[], league: LeagueState, rng: Rng): Map<string, SimTeam> {
  const teams = new Map<string, SimTeam>()
  const userTeam = getUserTeam(league)
  entrants.forEach((e, i) => {
    const id = i + 1
    let team: SimTeam
    const esp = e.id.startsWith('esp-') ? findLeagueTeam(league, Number(e.id.slice(4))) : undefined
    if (e.user && userTeam) {
      // Tu club juega con su plantilla y su táctica reales
      team = { ...userTeam, id, name: '', form: 0 }
    } else if (esp) {
      team = { ...esp, id, name: e.name, form: 0, tactic: 'equilibrada' }
    } else {
      const squad = placeholderSquad(id, e.level, rng, poolFor(e.country))
      team = { id, name: e.name, level: e.level, strength: squadStrength(squad), form: 0, tactic: 'equilibrada', squad }
    }
    teams.set(e.id, team)
  })
  return teams
}

/* ---------- Sorteo de grupos ---------- */
// 4 bombos por nivel; cada grupo recibe un club de cada bombo y se evita juntar clubes del mismo país
function drawGroups(sortedIds: string[], countryOf: (id: string) => string, rng: Rng): string[][] {
  const groups: string[][] = Array.from({ length: GROUP_COUNT }, () => [])
  for (let p = 0; p < GROUP_SIZE; p++) {
    const pot = shuffle(sortedIds.slice(p * GROUP_COUNT, (p + 1) * GROUP_COUNT), rng)
    const free: number[] = Array.from({ length: GROUP_COUNT }, (_, g) => g)
    for (const id of pot) {
      const apart = free.filter((g) => !groups[g].some((o) => countryOf(o) === countryOf(id)))
      const options = apart.length > 0 ? apart : free
      const g = options[Math.floor(rng() * options.length)]
      groups[g].push(id)
      free.splice(free.indexOf(g), 1)
    }
  }
  return groups
}

/* ---------- Partido ---------- */
export function refOf(team: SimTeam, playerId: string): TPlayer {
  const p = team.squad.find((q) => q.id === playerId)
  return p
    ? { id: p.id, name: p.name, pos: p.pos, rating: p.rating }
    : { id: playerId, name: 'Jugador', pos: 'DEL', rating: 70 }
}

export function toRef(p: SimPlayer): TPlayer {
  return { id: p.id, name: p.name, pos: p.pos, rating: p.rating }
}

export function pickGoal(team: SimTeam, side: 0 | 1, minute: number, rng: Rng): TGoal | null {
  const scorer = pickWeighted(
    team.squad,
    scoringWeight,
    rng,
  )
  if (!scorer) return null
  let assist: TPlayer | null = null
  if (rng() < 0.7) {
    const helper = pickWeighted(
      team.squad.filter((p) => p.id !== scorer.id),
      (p) => ASSIST_WEIGHT[p.pos] * Math.pow(p.rating / 70, 2) * (p.starter ? 1 : 0.3),
      rng,
    )
    assist = helper ? toRef(helper) : null
  }
  return { side, minute, scorer: toRef(scorer), assist }
}

// Tanda de penales: 5 tiros cada uno y, si siguen igualados, muerte súbita
function shootout(homeStrength: number, awayStrength: number, rng: Rng): [number, number] {
  const ph = clamp(PENALTY_BASE + (homeStrength - awayStrength) * PENALTY_EDGE, 0.65, 0.85)
  const pa = clamp(PENALTY_BASE + (awayStrength - homeStrength) * PENALTY_EDGE, 0.65, 0.85)
  let h = 0
  let a = 0
  for (let i = 0; i < 5; i++) {
    if (rng() < ph) h++
    if (rng() < pa) a++
  }
  let guard = 0
  while (h === a && guard++ < 40) {
    if (rng() < ph) h++
    if (rng() < pa) a++
  }
  if (h === a) h++ // no debería pasar nunca
  return [h, a]
}

export function nextForm(form: number, goalDiff: number): number {
  const score = goalDiff > 0 ? 1 : goalDiff < 0 ? -1 : 0
  return clamp(form * 0.7 + 0.3 * score, -1, 1)
}

// Figura del partido: quien más aportó (goles y asistencias), con un plus para el ganador
export function pickMvp(goals: TGoal[], winnerSide: 0 | 1 | null, home: SimTeam, away: SimTeam, rng: Rng): TMatch['mvp'] {
  const board = new Map<string, { side: 0 | 1; player: TPlayer; pts: number }>()
  const add = (side: 0 | 1, player: TPlayer, pts: number) => {
    const key = `${side}:${player.id}`
    const row = board.get(key)
    if (row) row.pts += pts
    else board.set(key, { side, player, pts })
  }
  for (const g of goals) {
    add(g.side, g.scorer, 3)
    if (g.assist) add(g.side, g.assist, 1.5)
  }
  if (board.size === 0) {
    // Sin goles: la figura es un portero
    const side: 0 | 1 = rng() < 0.5 ? 0 : 1
    const squad = (side === 0 ? home : away).squad
    const keeper = squad.filter((p) => p.starter && p.pos === 'POR')[0] ?? [...squad].sort((a, b) => b.rating - a.rating)[0]
    return keeper ? { side, player: toRef(keeper) } : null
  }
  let best: { side: 0 | 1; player: TPlayer; pts: number } | null = null
  let bestScore = -Infinity
  for (const row of board.values()) {
    const score = row.pts + (row.side === winnerSide ? 1 : 0) + row.player.rating / 200
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return best ? { side: best.side, player: best.player } : null
}

// Situaciones que dan variedad: remontadas, goleadas, sorpresas, rivalidades...
function tagsFor(
  m: Omit<TMatch, 'tags'>,
  homeTeam: SimTeam,
  awayTeam: SimTeam,
  homeEntrant: Entrant | undefined,
  awayEntrant: Entrant | undefined,
): MatchTag[] {
  const tags: MatchTag[] = []
  const winnerSide: 0 | 1 | null = m.winner === null ? null : m.winner === m.home ? 0 : 1

  // Remontada: el ganador llegó a ir perdiendo
  if (winnerSide !== null) {
    let diff = 0
    let behind = false
    for (const g of m.goals) {
      diff += g.side === winnerSide ? 1 : -1
      if (diff < 0) behind = true
    }
    if (behind) tags.push('remontada')
  }
  if (Math.abs(m.hg - m.ag) >= 3) tags.push('goleada')
  const last = m.goals[m.goals.length - 1]
  if (last && Math.abs(m.hg - m.ag) <= 1 && (last.minute >= 88 && last.minute <= 90 ? true : last.minute >= 118)) {
    tags.push('ultimo-minuto')
  }
  if (winnerSide !== null) {
    const winnerStrength = winnerSide === 0 ? homeTeam.strength : awayTeam.strength
    const loserStrength = winnerSide === 0 ? awayTeam.strength : homeTeam.strength
    if (loserStrength - winnerStrength >= 4) tags.push('sorpresa')
  }
  if (m.pens) tags.push('penales')
  else if (m.extraTime) tags.push('prorroga')
  if (homeEntrant?.country === activeLeague().code && awayEntrant?.country === activeLeague().code) tags.push('duelo-espanol')
  return tags
}

interface Meta {
  id: string
  seq: number
  stage: Stage
  group: number | null
  matchday: number | null
}

function playMatch(ctx: Ctx, meta: Meta, homeId: string, awayId: string, knockout: boolean): TMatch {
  const home = ctx.teams.get(homeId) as SimTeam
  const away = ctx.teams.get(awayId) as SimTeam
  const rng = ctx.rng

  const raw = simulateMatch(home, away, meta.seq + 1, rng)
  const goals: TGoal[] = raw.goals.map((g) => {
    const side: 0 | 1 = g.team === home.id ? 0 : 1
    const team = side === 0 ? home : away
    return { side, minute: g.minute, scorer: refOf(team, g.scorer), assist: g.assist ? refOf(team, g.assist) : null }
  })
  let hg = raw.hg
  let ag = raw.ag
  let extraTime = false
  let pens: [number, number] | null = null

  if (knockout && hg === ag) {
    // Empate en una eliminatoria: prórroga y, si sigue igual, penales
    extraTime = true
    const lamH = clamp(EXTRA_TIME_GOALS * Math.exp(STRENGTH_SENSITIVITY * (home.strength - away.strength)), 0.1, 1.4)
    const lamA = clamp(EXTRA_TIME_GOALS * Math.exp(STRENGTH_SENSITIVITY * (away.strength - home.strength)), 0.1, 1.4)
    const extraH = poisson(lamH, rng)
    const extraA = poisson(lamA, rng)
    for (let i = 0; i < extraH; i++) {
      const g = pickGoal(home, 0, 91 + Math.floor(rng() * 30), rng)
      if (g) {
        goals.push(g)
        hg++
      }
    }
    for (let i = 0; i < extraA; i++) {
      const g = pickGoal(away, 1, 91 + Math.floor(rng() * 30), rng)
      if (g) {
        goals.push(g)
        ag++
      }
    }
    goals.sort((a, b) => a.minute - b.minute)
    if (hg === ag) pens = shootout(home.strength, away.strength, rng)
  }

  let winner: string | null = null
  if (hg > ag) winner = homeId
  else if (ag > hg) winner = awayId
  else if (pens) winner = pens[0] > pens[1] ? homeId : awayId

  const winnerSide: 0 | 1 | null = winner === null ? null : winner === homeId ? 0 : 1
  const mvp = pickMvp(goals, winnerSide, home, away, rng)

  home.form = nextForm(home.form, hg - ag)
  away.form = nextForm(away.form, ag - hg)

  const base: Omit<TMatch, 'tags'> = {
    id: meta.id,
    seq: meta.seq,
    stage: meta.stage,
    group: meta.group,
    matchday: meta.matchday,
    home: homeId,
    away: awayId,
    hg,
    ag,
    extraTime,
    pens,
    winner,
    stats: raw.stats,
    goals,
    mvp,
  }
  return { ...base, tags: tagsFor(base, home, away, ctx.byId.get(homeId), ctx.byId.get(awayId)) }
}

/* ---------- Tabla de grupo ---------- */
// Tabla de un grupo con los partidos hasta la jornada indicada (por defecto, todos)
export function groupTable(group: TGroup, upToMatchday = Infinity): GroupRow[] {
  const rows = new Map<string, GroupRow>(
    group.ids.map((id) => [id, { id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]),
  )
  for (const m of group.matches) {
    if ((m.matchday ?? 0) > upToMatchday) continue
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
      h.points++
      a.points++
    }
  }
  const order = (id: string) => group.ids.indexOf(id)
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || order(x.id) - order(y.id),
  )
}

/* ---------- Simulación de una competición completa ---------- */
export function simulateTournament(
  comp: EuropeId,
  entrants: Entrant[],
  league: LeagueState,
  seed: number,
  season: number,
): Tournament {
  if (entrants.length !== FIELD_SIZE) {
    throw new Error(`El torneo necesita ${FIELD_SIZE} clubes y tiene ${entrants.length}`)
  }
  const rng = createRng(seed)
  const teams = buildTeams(entrants, league, rng)
  const byId = new Map(entrants.map((e) => [e.id, e]))
  const entrantOfNum = new Map<number, string>()
  teams.forEach((t, id) => entrantOfNum.set(t.id, id))
  const ctx: Ctx = { teams, byId, rng }

  const strengthOf = (id: string) => (teams.get(id) as SimTeam).strength
  const ranking = [...entrants].sort((a, b) => strengthOf(b.id) - strengthOf(a.id) || a.id.localeCompare(b.id))
  const drawn = drawGroups(ranking.map((e) => e.id), (id) => byId.get(id)?.country ?? '', rng)

  let seq = 0
  const groups: TGroup[] = drawn.map((ids, gi) => ({ name: GROUP_NAMES[gi], ids, matches: [] }))
  const fixtures = drawn.map((ids) => buildSchedule(ids.map((id) => (teams.get(id) as SimTeam).id)).slice(0, GROUP_ROUNDS))

  // Fase de grupos: jornada a jornada, grupo a grupo
  for (let md = 0; md < GROUP_ROUNDS; md++) {
    for (let gi = 0; gi < groups.length; gi++) {
      fixtures[gi][md].forEach(([h, a], n) => {
        const meta: Meta = { id: `G${gi}-${md}-${n}`, seq: seq++, stage: 'group', group: gi, matchday: md + 1 }
        groups[gi].matches.push(playMatch(ctx, meta, entrantOfNum.get(h) as string, entrantOfNum.get(a) as string, false))
      })
    }
  }

  // Cuadro: 1.º de un grupo contra 2.º de otro, para que los dos de un grupo solo se vean en la final
  const tables = groups.map((g) => groupTable(g))
  const first = tables.map((t) => t[0].id)
  const second = tables.map((t) => t[1].id)
  const quarterPairs: [string, string][] = [
    [first[0], second[1]],
    [first[2], second[3]],
    [first[1], second[0]],
    [first[3], second[2]],
  ]
  const play = (stage: Exclude<Stage, 'group'>, i: number, h: string, a: string): TMatch =>
    playMatch(ctx, { id: `${stage[0].toUpperCase()}${i}`, seq: seq++, stage, group: null, matchday: null }, h, a, true)

  const quarter = quarterPairs.map(([h, a], i) => play('quarter', i, h, a))
  const semiPairs: [string, string][] = [
    [quarter[0].winner as string, quarter[1].winner as string],
    [quarter[2].winner as string, quarter[3].winner as string],
  ]
  const semi = semiPairs.map(([h, a], i) => play('semi', i, h, a))
  const finalists = [semi[0].winner as string, semi[1].winner as string]
  // La final es en campo neutral: el sorteo decide quién figura como local
  const [fh, fa] = rng() < 0.5 ? finalists : [finalists[1], finalists[0]]
  const final = play('final', 0, fh, fa)

  const champion = final.winner as string
  return {
    comp,
    season,
    entrants,
    groups,
    rounds: [
      { stage: 'quarter', matches: quarter },
      { stage: 'semi', matches: semi },
      { stage: 'final', matches: [final] },
    ],
    champion,
    runnerUp: champion === final.home ? final.away : final.home,
  }
}

// Simula las competiciones europeas con formato de grupos (16 clubes). La Lifetime Champions League (36 clubes)
// la calcula champions.ts: aquí solo se anota su campeón (clChampion) para que todo sea coherente.
// Se guarda completa la competición de tu club; si no juegas ninguna, la primera que se haya simulado.
export function playEuropeSeason(game: {
  league: LeagueState
  europe: EuropeSeason | null
  seed: number
  season: number
  clChampion?: Entrant | null
}): TournamentSeason | null {
  const europe = game.europe
  if (!europe || europe.season !== game.season) return null

  const champions = {} as Record<EuropeId, Entrant>
  const played = new Map<EuropeId, Tournament>()
  EUROPE.forEach((comp, i) => {
    const field = europe.fields[comp.id]
    if (field.length !== FIELD_SIZE) {
      if (comp.id === 'champions' && game.clChampion) champions.champions = game.clChampion
      return
    }
    const t = simulateTournament(comp.id, field, game.league, mixSeed(game.seed, game.season, 4242, i), game.season)
    champions[comp.id] = t.entrants.find((e) => e.id === t.champion) as Entrant
    played.set(comp.id, t)
  })
  const mainId: EuropeId | undefined =
    europe.user && played.has(europe.user) ? europe.user : played.has('champions') ? 'champions' : [...played.keys()][0]
  const main = mainId ? played.get(mainId) : undefined
  return main ? { season: game.season, main, champions } : null
}

/* ---------- Consultas para la pantalla ---------- */
export function allMatches(t: Tournament): TMatch[] {
  return [...t.groups.flatMap((g) => g.matches), ...t.rounds.flatMap((r) => r.matches)].sort((a, b) => a.seq - b.seq)
}

export function userEntrant(t: Tournament): Entrant | undefined {
  return t.entrants.find((e) => e.user)
}

export function userParticipates(ts: TournamentSeason): boolean {
  return userEntrant(ts.main) !== undefined
}

// Los partidos de tu club, en orden, desde la fase de grupos hasta donde llegue
export function userMatches(t: Tournament): TMatch[] {
  const me = userEntrant(t)
  if (!me) return []
  return allMatches(t).filter((m) => m.home === me.id || m.away === me.id)
}

export function userGroupIndex(t: Tournament): number {
  const me = userEntrant(t)
  return me ? t.groups.findIndex((g) => g.ids.includes(me.id)) : -1
}

export function userReach(t: Tournament): Reach | null {
  const me = userEntrant(t)
  if (!me) return null
  if (t.champion === me.id) return 'campeon'
  const mine = userMatches(t)
  const last = mine[mine.length - 1]
  if (!last) return null
  if (last.stage === 'final') return 'final'
  if (last.stage === 'semi') return 'semi'
  if (last.stage === 'quarter') return 'cuartos'
  return 'grupos'
}

export function matchOutcome(m: TMatch, clubId: string): 'win' | 'draw' | 'loss' {
  if (m.winner === null) return 'draw'
  return m.winner === clubId ? 'win' : 'loss'
}

// Titular de la tarjeta de resultado, según lo que pasó en el partido
export function matchHeadline(m: TMatch, clubId: string): string {
  const out = matchOutcome(m, clubId)
  const tags = m.tags
  if (m.stage === 'final') {
    if (out === 'win') return tags.includes('penales') ? '¡CAMPEONES EN LOS PENALES!' : '¡CAMPEONES!'
    return tags.includes('penales') ? 'La final se pierde en los penales' : 'La final se escapa'
  }
  if (tags.includes('penales')) return out === 'win' ? 'Héroes en los penales' : 'Cruel desenlace en los penales'
  if (tags.includes('remontada')) return out === 'win' ? 'Remontada para la historia' : 'Se escapó la victoria'
  if (tags.includes('goleada')) return out === 'win' ? 'Goleada contundente' : 'Una noche para olvidar'
  if (tags.includes('prorroga')) return out === 'win' ? 'Sufrido, pero seguimos vivos' : 'Adiós en la prórroga'
  if (tags.includes('ultimo-minuto')) return out === 'win' ? 'Gol sobre la hora' : 'Dolor en el último suspiro'
  if (tags.includes('sorpresa')) return out === 'win' ? 'Sorpresa mayúscula' : 'Un tropiezo inesperado'
  if (out === 'win') return m.stage === 'group' ? 'Victoria' : 'Pasamos de ronda'
  if (out === 'draw') return 'Reparto de puntos'
  return m.stage === 'group' ? 'Derrota' : 'Eliminados'
}

// Frase de la pantalla de suspenso (varía según lo que está en juego)
export function suspenseLine(m: TMatch, rivalIsCompatriot: boolean): string {
  if (m.stage === 'final') return 'Todo el continente mira. Una noche para la historia.'
  if (m.stage === 'semi') return 'Quien gane, sueña con la final.'
  if (m.stage === 'quarter') return 'Eliminatoria a partido único: perder es despedirse.'
  if (rivalIsCompatriot) return `Duelo ${activeLeague().adjective} en Europa: el orgullo también juega.`
  return m.matchday && m.matchday >= GROUP_ROUNDS ? 'Última jornada del grupo: se define todo.' : 'Empieza el camino europeo.'
}

/* ---------- Estadísticas del torneo ---------- */
export interface ScorerRow {
  key: string
  player: TPlayer
  club: string // id del club
  goals: number
  assists: number
}

export function tournamentScorers(t: Tournament): ScorerRow[] {
  const rows = new Map<string, ScorerRow>()
  const row = (club: string, player: TPlayer): ScorerRow => {
    const key = `${club}:${player.id}`
    let r = rows.get(key)
    if (!r) {
      r = { key, player, club, goals: 0, assists: 0 }
      rows.set(key, r)
    }
    return r
  }
  for (const m of allMatches(t)) {
    for (const g of m.goals) {
      const club = g.side === 0 ? m.home : m.away
      row(club, g.scorer).goals++
      if (g.assist) row(club, g.assist).assists++
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || b.player.rating - a.player.rating || a.key.localeCompare(b.key),
  )
}

// Resumen del paso de tu club por el torneo (para el historial)
export function euroRecord(ts: TournamentSeason): EuroRecord | null {
  const t = ts.main
  const me = userEntrant(t)
  const reach = userReach(t)
  if (!me || !reach) return null
  let goals = 0
  let margin = 0
  for (const m of userMatches(t)) {
    const mine = m.home === me.id ? m.hg : m.ag
    const theirs = m.home === me.id ? m.ag : m.hg
    goals += mine
    if (mine > theirs) margin = Math.max(margin, mine - theirs)
  }
  return { comp: t.comp, reach, champion: reach === 'campeon', goals, margin }
}

/* ---------- Logros ---------- */
export function achievements(t: Tournament, history: { euro?: EuroRecord | null }[]): string[] {
  const me = userEntrant(t)
  if (!me) return []
  const before = history.map((h) => h.euro).filter((e): e is EuroRecord => !!e && e.comp === t.comp)
  const titles = before.filter((e) => e.champion).length
  const mine = userMatches(t)
  const reach = userReach(t)
  const list: string[] = []

  if (reach === 'campeon') {
    list.push(titles === 0 ? '⭐ ¡Primer título europeo de la historia del club!' : `🏆 ¡${titles + 1}.º título de esta competición!`)
    if (mine.every((m) => matchOutcome(m, me.id) !== 'loss')) list.push('🛡️ Campeón invicto')
    if (mine.every((m) => matchOutcome(m, me.id) === 'win')) list.push('💯 Pleno de victorias')
  }
  if (before.length === 0) list.push('🌍 Debut en esta competición')

  const record = euroRecord({ season: t.season, main: t, champions: {} as Record<EuropeId, Entrant> })
  if (record) {
    if (before.length > 0 && record.goals > Math.max(...before.map((e) => e.goals))) {
      list.push(`⚽ Récord goleador del club en un torneo: ${record.goals} goles`)
    }
    if (record.margin >= 3 && record.margin > Math.max(0, ...before.map((e) => e.margin))) {
      list.push(`💥 Mayor goleada europea del club (+${record.margin})`)
    }
  }
  if (mine.some((m) => m.stage !== 'group' && matchOutcome(m, me.id) === 'win' && m.tags.includes('remontada'))) {
    list.push('🔥 Remontada épica en una eliminatoria')
  }
  const scorers = tournamentScorers(t)
  if (scorers[0] && scorers[0].club === me.id && scorers[0].goals >= 2) {
    list.push(`👟 Máximo goleador del torneo: ${scorers[0].player.name} (${scorers[0].goals})`)
  }
  for (const m of mine) {
    const perPlayer = new Map<string, { name: string; n: number }>()
    for (const g of m.goals) {
      if ((g.side === 0 ? m.home : m.away) !== me.id) continue
      const r = perPlayer.get(g.scorer.id) ?? { name: g.scorer.name, n: 0 }
      r.n++
      perPlayer.set(g.scorer.id, r)
    }
    const hat = [...perPlayer.values()].find((r) => r.n >= 3)
    if (hat) {
      list.push(`🎩 Hat-trick de ${hat.name}`)
      break
    }
  }
  return list.slice(0, 5)
}

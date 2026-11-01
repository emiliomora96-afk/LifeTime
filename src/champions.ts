import type { LeagueState, MatchStats, SimTeam } from './engine'
import { buildSchedule, getUserTeam, simulateMatch } from './engine'
import type { Entrant, EuropeSeason } from './europe'
import type { Rng } from './rng'
import { clamp, createRng, mixSeed, poisson, shuffle } from './rng'
import { placeholderSquad, squadStrength } from './squads'
import { activeLeague } from './activeLeague'
import type { EuroRecord, MatchTag, Reach, ScorerRow, TGoal, TMatch } from './tournament'
import {
  EXTRA_TIME_GOALS,
  PENALTY_BASE,
  PENALTY_EDGE,
  STRENGTH_SENSITIVITY,
  findLeagueTeam,
  nextForm,
  pickGoal,
  pickMvp,
  poolFor,
} from './tournament'
import type { MatchTimeline } from './clTimeline'
import { buildTimeline, isAnimated, shootoutKicks } from './clTimeline'

/* ==========================================================================
   Lifetime Champions League
   El motor calcula la competición en dos tandas (la pantalla solo la presenta):
   - Parada de inicio: la fase de liga completa (con las plantillas de ese momento).
   - Parada de invierno: no hay Champions; es el mercado para reforzar la plantilla.
   - Parada final: playoff, octavos, cuartos, semifinales y final, justo antes de cerrar la temporada.
   ========================================================================== */

/* ---------- Formato (todo configurable aquí) ---------- */
export const CL_SIZE = 36 // clubes
export const CL_LEAGUE_MATCHES = 8 // partidos por club: 8 rivales distintos, 4 de local y 4 de visita
export const CL_DIRECT = 8 // puestos 1-8: pasan directo a octavos
export const CL_PLAYOFF_LAST = 24 // puestos 9-24: playoff de ida y vuelta. Del 25 al 36: eliminados

export type ClStage = 'liga' | 'playoff' | 'octavos' | 'cuartos' | 'semi' | 'final'
export const CL_STAGES: ClStage[] = ['liga', 'playoff', 'octavos', 'cuartos', 'semi', 'final']
export const CL_STAGE_LABEL: Record<ClStage, string> = {
  liga: 'Fase de liga',
  playoff: 'Playoff',
  octavos: 'Octavos de final',
  cuartos: 'Cuartos de final',
  semi: 'Semifinales',
  final: 'Final',
}
export const CL_STAGE_SHORT: Record<ClStage, string> = {
  liga: 'Liga',
  playoff: 'Playoff',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semi: 'Semis',
  final: 'Final',
}
export const CL_STAGE_REACH: Record<Exclude<ClStage, 'liga'>, Reach> = {
  playoff: 'playoff',
  octavos: 'octavos',
  cuartos: 'cuartos',
  semi: 'semi',
  final: 'final',
}

/* ---------- Tipos ---------- */
export interface ClMatch {
  id: string
  seq: number // orden cronológico en toda la competición
  stage: ClStage
  matchday: number | null // jornada de la fase de liga (1 a 8)
  tie: string | null // eliminatoria a la que pertenece (null en la fase de liga)
  leg: 1 | 2 | null // ida o vuelta (null en la fase de liga y en la final)
  home: string // id del club (Entrant.id)
  away: string
  hg: number // goles del local (con prórroga, sin penales)
  ag: number
  extraTime: boolean
  pens: [number, number] | null // tanda de penales [local, visitante]
  winner: string | null // quien ganó el partido (también por penales). null = empate
  stats: MatchStats // estadísticas de los 90 minutos (poss = % del local)
  goals: TGoal[]
  mvp: TMatch['mvp']
  tags: MatchTag[]
  timeline: MatchTimeline | null // solo si la fase está en ANIMATED_STAGES (clTimeline.ts); por defecto la Champions no se anima
}

export interface ClRow {
  id: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
}

export interface ClTie {
  id: string
  stage: Exclude<ClStage, 'liga'>
  first: string // anfitrión de la ida (en la final, el “local” del sorteo)
  second: string // anfitrión de la vuelta
  legs: ClMatch[] // 2 partidos (1 en la final)
  agg: [number, number] // goles totales de first y second
  winner: string
  decidedBy: 'global' | 'prorroga' | 'penales'
}

export interface ClRound {
  stage: Exclude<ClStage, 'liga'>
  ties: ClTie[]
}

export interface ClState {
  season: number
  entrants: Entrant[] // los 36 clubes, del más fuerte al más débil
  league: ClMatch[] // los 144 partidos de la fase de liga
  table: ClRow[] // tabla final de la fase de liga, ordenada
  rounds: ClRound[] // vacío hasta que se juegan las eliminatorias (parada final)
  champion: string | null
  runnerUp: string | null
}

export type ClPath = 'directo' | 'playoff' | 'eliminado'

/* ---------- Equipos ---------- */
interface Ctx {
  teams: Map<string, SimTeam>
  byId: Map<string, Entrant>
  rng: Rng
  seed: number
  season: number
  seq: number
}

// Cada club juega con su plantilla de ese momento. Los invitados se regeneran siempre igual (misma semilla)
function buildClTeams(entrants: Entrant[], league: LeagueState, seed: number, season: number): Map<string, SimTeam> {
  const teams = new Map<string, SimTeam>()
  const userTeam = getUserTeam(league)
  entrants.forEach((e, i) => {
    const id = i + 1
    const esp = e.id.startsWith('esp-') ? findLeagueTeam(league, Number(e.id.slice(4))) : undefined
    let team: SimTeam
    if (e.user && userTeam) {
      // Tu club juega con su plantilla y su táctica reales
      team = { ...userTeam, id, name: '', form: 0 }
    } else if (esp) {
      team = { ...esp, id, name: e.name, form: 0, tactic: 'equilibrada' }
    } else {
      const squad = placeholderSquad(id, e.level, createRng(mixSeed(seed, season, 3636, i)), poolFor(e.country))
      team = { id, name: e.name, level: e.level, strength: squadStrength(squad), form: 0, tactic: 'equilibrada', squad }
    }
    teams.set(e.id, team)
  })
  return teams
}

/* ---------- Partido ---------- */
function clTags(
  m: Pick<ClMatch, 'home' | 'away' | 'hg' | 'ag' | 'goals' | 'winner' | 'extraTime' | 'pens'>,
  homeTeam: SimTeam,
  awayTeam: SimTeam,
  homeEntrant: Entrant | undefined,
  awayEntrant: Entrant | undefined,
): MatchTag[] {
  const tags: MatchTag[] = []
  const winnerSide: 0 | 1 | null = m.winner === null ? null : m.winner === m.home ? 0 : 1
  const scoreSide: 0 | 1 | null = m.hg > m.ag ? 0 : m.ag > m.hg ? 1 : null

  // Remontada: quien ganó en el campo llegó a ir perdiendo
  if (scoreSide !== null) {
    let diff = 0
    let behind = false
    for (const g of m.goals) {
      diff += g.side === scoreSide ? 1 : -1
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
  stage: ClStage
  matchday: number | null
  tie: string | null
  leg: 1 | 2 | null
}

// carry: ventaja con la que llega el local a un partido que cierra una eliminatoria (null = no hay prórroga: liga e ida)
function playMatch(ctx: Ctx, meta: Meta, homeId: string, awayId: string, carry: number | null): ClMatch {
  const home = ctx.teams.get(homeId) as SimTeam
  const away = ctx.teams.get(awayId) as SimTeam
  const rng = ctx.rng
  const seq = ctx.seq++

  const raw = simulateMatch(home, away, seq + 1, rng)
  const goals: TGoal[] = raw.goals.map((g) => {
    const side: 0 | 1 = g.team === home.id ? 0 : 1
    const team = side === 0 ? home : away
    const ref = (id: string) => {
      const p = team.squad.find((q) => q.id === id)
      return p ? { id: p.id, name: p.name, pos: p.pos, rating: p.rating } : { id, name: 'Jugador', pos: 'DEL' as const, rating: 70 }
    }
    return { side, minute: g.minute, scorer: ref(g.scorer), assist: g.assist ? ref(g.assist) : null }
  })
  let hg = raw.hg
  let ag = raw.ag
  let extraTime = false
  let pens: [number, number] | null = null
  let kicks: ReturnType<typeof shootoutKicks>['kicks'] | null = null

  if (carry !== null && hg + carry === ag) {
    // La eliminatoria sigue igualada: prórroga y, si continúa igual, penales
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
    if (hg + carry === ag) {
      const ph = clamp(PENALTY_BASE + (home.strength - away.strength) * PENALTY_EDGE, 0.65, 0.85)
      const pa = clamp(PENALTY_BASE + (away.strength - home.strength) * PENALTY_EDGE, 0.65, 0.85)
      const shoot = shootoutKicks(ph, pa, rng)
      pens = shoot.tally
      kicks = shoot.kicks
    }
  }

  let winner: string | null = null
  if (hg > ag) winner = homeId
  else if (ag > hg) winner = awayId
  else if (pens) winner = pens[0] > pens[1] ? homeId : awayId

  const winnerSide: 0 | 1 | null = winner === null ? null : winner === homeId ? 0 : 1
  const mvp = pickMvp(goals, winnerSide, home, away, rng)

  home.form = nextForm(home.form, hg - ag)
  away.form = nextForm(away.form, ag - hg)

  const homeEntrant = ctx.byId.get(homeId)
  const awayEntrant = ctx.byId.get(awayId)
  const base = { ...meta, seq, home: homeId, away: awayId, hg, ag, extraTime, pens, winner, stats: raw.stats, goals, mvp }
  const timeline =
    (homeEntrant?.user || awayEntrant?.user) && isAnimated(meta.stage)
      ? buildTimeline(
          { goals, stats: raw.stats, extraTime, kicks, strengthDiff: home.strength - away.strength },
          createRng(mixSeed(ctx.seed, ctx.season, 3637, seq)),
        )
      : null
  return { ...base, tags: clTags(base, home, away, homeEntrant, awayEntrant), timeline }
}

/* ---------- Fase de liga: sorteo ---------- */
interface Fixture {
  home: string
  away: string
  matchday: number
}

// Orienta cada partido (local y visitante) para que todos los clubes tengan 4 de local y 4 de visita:
// con grado par en todos los clubes, un recorrido cerrado por los partidos deja tantas salidas como llegadas
function orientEdges(n: number, edges: [number, number][]): [number, number][] {
  const adj: { to: number; e: number }[][] = Array.from({ length: n }, () => [])
  edges.forEach(([a, b], e) => {
    adj[a].push({ to: b, e })
    adj[b].push({ to: a, e })
  })
  const used = new Array<boolean>(edges.length).fill(false)
  const out: [number, number][] = new Array(edges.length)
  for (let s = 0; s < n; s++) {
    for (;;) {
      let v = s
      let moved = false
      for (;;) {
        const next = adj[v].find((x) => !used[x.e])
        if (!next) break
        used[next.e] = true
        out[next.e] = [v, next.to]
        v = next.to
        moved = true
      }
      if (!moved) break
    }
  }
  return out
}

// 8 jornadas en las que juegan los 36 clubes a la vez, contra 8 rivales distintos.
// Entre varios sorteos al azar se queda con el más parejo (que nadie tenga un calendario mucho más fácil).
function drawLeague(ids: string[], strengthOf: (id: string) => number, rng: Rng): Fixture[] {
  const n = ids.length
  let best: { order: string[]; rounds: [number, number][][] } | null = null
  let bestCost = Infinity
  for (let k = 0; k < 120; k++) {
    const order = shuffle(ids, rng)
    const all = buildSchedule(order.map((_, i) => i)).slice(0, n - 1) // la primera vuelta de un todos contra todos
    const rounds = shuffle(
      all.map((_, i) => i),
      rng,
    )
      .slice(0, CL_LEAGUE_MATCHES)
      .map((i) => all[i])
    const rival = new Array<number>(n).fill(0)
    for (const round of rounds) {
      for (const [a, b] of round) {
        rival[a] += strengthOf(order[b])
        rival[b] += strengthOf(order[a])
      }
    }
    const mean = rival.reduce((s, v) => s + v, 0) / n
    const cost = rival.reduce((s, v) => s + (v - mean) * (v - mean), 0)
    if (cost < bestCost) {
      bestCost = cost
      best = { order, rounds }
    }
  }
  const { order, rounds } = best as { order: string[]; rounds: [number, number][][] }
  const edges: [number, number][] = []
  const day: number[] = []
  rounds.forEach((round, r) =>
    round.forEach(([a, b]) => {
      edges.push([a, b])
      day.push(r + 1)
    }),
  )
  return orientEdges(n, edges).map(([h, a], i) => ({ home: order[h], away: order[a], matchday: day[i] }))
}

/* ---------- Tabla de la fase de liga ---------- */
// Tabla con los partidos hasta la jornada indicada (por defecto, todos)
export function clTable(entrants: Entrant[], matches: ClMatch[], upToMatchday = Infinity): ClRow[] {
  const rows = new Map<string, ClRow>(
    entrants.map((e) => [e.id, { id: e.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]),
  )
  for (const m of matches) {
    if (m.stage !== 'liga' || (m.matchday ?? 0) > upToMatchday) continue
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
  const order = new Map(entrants.map((e, i) => [e.id, i]))
  const at = (id: string) => order.get(id) ?? 0
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || y.won - x.won || at(x.id) - at(y.id),
  )
}

/* ---------- Eliminatorias ---------- */
function playTie(ctx: Ctx, stage: ClTie['stage'], index: number, first: string, second: string): ClTie {
  const id = `${stage}-${index}`
  const leg1 = playMatch(ctx, { id: `${id}-1`, stage, matchday: null, tie: id, leg: 1 }, first, second, null)
  // La vuelta: el anfitrión llega con lo que marcó y encajó en la ida
  const leg2 = playMatch(ctx, { id: `${id}-2`, stage, matchday: null, tie: id, leg: 2 }, second, first, leg1.ag - leg1.hg)
  const agg: [number, number] = [leg1.hg + leg2.ag, leg1.ag + leg2.hg]
  const winner = agg[0] > agg[1] ? first : agg[1] > agg[0] ? second : (leg2.winner as string)
  const decidedBy: ClTie['decidedBy'] = leg2.pens ? 'penales' : leg2.extraTime ? 'prorroga' : 'global'
  return { id, stage, first, second, legs: [leg1, leg2], agg, winner, decidedBy }
}

// La final es un partido único en campo neutral: el sorteo decide quién figura como local
function playFinal(ctx: Ctx, a: string, b: string): ClTie {
  const [home, away] = ctx.rng() < 0.5 ? [a, b] : [b, a]
  const m = playMatch(ctx, { id: 'final-0-1', stage: 'final', matchday: null, tie: 'final-0', leg: null }, home, away, 0)
  const decidedBy: ClTie['decidedBy'] = m.pens ? 'penales' : m.extraTime ? 'prorroga' : 'global'
  return { id: 'final-0', stage: 'final', first: home, second: away, legs: [m], agg: [m.hg, m.ag], winner: m.winner as string, decidedBy }
}

function playKnockout(ctx: Ctx, table: ClRow[]): { rounds: ClRound[]; champion: string; runnerUp: string } {
  const rng = ctx.rng
  const ids = table.map((r) => r.id)
  const rank = new Map(ids.map((id, i) => [id, i]))
  // El mejor clasificado en la liga juega la vuelta en casa
  const hosts = (a: string, b: string): [string, string] => ((rank.get(a) ?? 0) <= (rank.get(b) ?? 0) ? [b, a] : [a, b])

  // Playoff (puestos 9 a 24): 9-10 contra 23-24, 11-12 contra 21-22, 13-14 contra 19-20 y 15-16 contra 17-18
  const playoff: ClTie[] = []
  for (let g = 0; g < 4; g++) {
    const seeded = [ids[8 + 2 * g], ids[9 + 2 * g]]
    const rivals = shuffle([ids[22 - 2 * g], ids[23 - 2 * g]], rng)
    seeded.forEach((s, j) => playoff.push(playTie(ctx, 'playoff', playoff.length, rivals[j], s)))
  }

  // Octavos: los mejores de la liga reciben a los peores del playoff (1-2 con 15-16/17-18, y así hacia arriba)
  const round16: ClTie[] = []
  for (let p = 0; p < 4; p++) {
    const g = 3 - p
    const winners = shuffle([playoff[2 * g].winner, playoff[2 * g + 1].winner], rng)
    for (let j = 0; j < 2; j++) {
      const [first, second] = hosts(winners[j], ids[2 * p + j])
      round16.push(playTie(ctx, 'octavos', round16.length, first, second))
    }
  }

  const advance = (stage: ClTie['stage'], from: ClTie[], pairs: [number, number][]): ClTie[] => {
    const out: ClTie[] = []
    for (const [x, y] of pairs) {
      const [first, second] = hosts(from[x].winner, from[y].winner)
      out.push(playTie(ctx, stage, out.length, first, second))
    }
    return out
  }
  // Cuadro: los cabezas de serie 1 y 2 solo se cruzan en la final
  const quarter = advance('cuartos', round16, [[0, 3], [1, 2], [4, 7], [5, 6]])
  const semi = advance('semi', quarter, [[0, 3], [1, 2]])
  const final = playFinal(ctx, semi[0].winner, semi[1].winner)

  const champion = final.winner
  return {
    rounds: [
      { stage: 'playoff', ties: playoff },
      { stage: 'octavos', ties: round16 },
      { stage: 'cuartos', ties: quarter },
      { stage: 'semi', ties: semi },
      { stage: 'final', ties: [final] },
    ],
    champion,
    runnerUp: champion === final.first ? final.second : final.first,
  }
}

/* ---------- Simulación (las dos tandas) ---------- */
type ClGame = { league: LeagueState; europe: EuropeSeason | null; seed: number; season: number }

export function clApplies(game: Pick<ClGame, 'europe' | 'season'>): boolean {
  const e = game.europe
  return !!e && e.season === game.season && e.fields.champions.length === CL_SIZE
}

// ¿Tu club juega la Lifetime Champions League esta temporada?
export function userInChampions(game: Pick<ClGame, 'europe' | 'season'>): boolean {
  return clApplies(game) && game.europe?.user === 'champions'
}

function makeCtx(game: ClGame, entrants: Entrant[], tag: number, seq: number): Ctx {
  return {
    teams: buildClTeams(entrants, game.league, game.seed, game.season),
    byId: new Map(entrants.map((e) => [e.id, e])),
    rng: createRng(mixSeed(game.seed, game.season, tag)),
    seed: game.seed,
    season: game.season,
    seq,
  }
}

// Parada de inicio: la fase de liga completa
export function playChampionsLeague(game: ClGame): ClState | null {
  if (!clApplies(game)) return null
  const entrants = (game.europe as EuropeSeason).fields.champions
  const ctx = makeCtx(game, entrants, 3601, 0)
  const strengthOf = (id: string) => (ctx.teams.get(id) as SimTeam).strength
  const fixtures = drawLeague(entrants.map((e) => e.id), strengthOf, ctx.rng)

  const league: ClMatch[] = []
  for (let md = 1; md <= CL_LEAGUE_MATCHES; md++) {
    fixtures
      .filter((f) => f.matchday === md)
      .forEach((f, n) => {
        league.push(playMatch(ctx, { id: `L${md}-${n}`, stage: 'liga', matchday: md, tie: null, leg: null }, f.home, f.away, null))
      })
  }
  return { season: game.season, entrants, league, table: clTable(entrants, league), rounds: [], champion: null, runnerUp: null }
}

// Parada final: playoff, octavos, cuartos, semifinales y final, con las plantillas de ese momento (ya con el mercado de invierno).
// Si la fase de liga no se jugó en la parada de inicio (tu club no participa), se calcula aquí entera.
export function playChampionsKnockout(game: ClGame & { champions: ClState | null }): ClState | null {
  if (!clApplies(game)) return null
  const base = game.champions && game.champions.season === game.season ? game.champions : playChampionsLeague(game)
  if (!base) return null
  if (base.champion !== null) return base
  const ctx = makeCtx(game, base.entrants, 3602, base.league.length)
  const k = playKnockout(ctx, base.table)
  return { ...base, rounds: k.rounds, champion: k.champion, runnerUp: k.runnerUp }
}

/* ---------- Consultas para la pantalla ---------- */
export function clUser(state: ClState): Entrant | undefined {
  return state.entrants.find((e) => e.user)
}

export function clAllMatches(state: ClState): ClMatch[] {
  return [...state.league, ...state.rounds.flatMap((r) => r.ties.flatMap((t) => t.legs))].sort((a, b) => a.seq - b.seq)
}

// Los partidos de tu club, en orden: fase de liga y eliminatorias
export function clUserMatches(state: ClState): ClMatch[] {
  const me = clUser(state)
  return me ? clAllMatches(state).filter((m) => m.home === me.id || m.away === me.id) : []
}

export function clTieOf(state: ClState, m: ClMatch): ClTie | undefined {
  return m.tie ? state.rounds.flatMap((r) => r.ties).find((t) => t.id === m.tie) : undefined
}

// Puesto de tu club en la fase de liga (0 si no juega)
export function clUserPosition(state: ClState): number {
  const me = clUser(state)
  return me ? state.table.findIndex((r) => r.id === me.id) + 1 : 0
}

export function clPathOf(position: number): ClPath {
  return position <= CL_DIRECT ? 'directo' : position <= CL_PLAYOFF_LAST ? 'playoff' : 'eliminado'
}

// ¿Tu club sigue en la competición después de la fase de liga?
export function clUserQualified(state: ClState): boolean {
  const p = clUserPosition(state)
  return p > 0 && p <= CL_PLAYOFF_LAST
}

export function clChampionEntrant(state: ClState): Entrant | null {
  return state.champion ? (state.entrants.find((e) => e.id === state.champion) ?? null) : null
}

export function clReach(state: ClState): Reach | null {
  const me = clUser(state)
  if (!me || state.champion === null) return null
  if (state.champion === me.id) return 'campeon'
  const last = clUserMatches(state).slice(-1)[0]
  if (!last) return null
  return last.stage === 'liga' ? 'liga' : CL_STAGE_REACH[last.stage]
}

export function clMatchOutcome(m: ClMatch, clubId: string): 'win' | 'draw' | 'loss' {
  if (m.winner === null) return 'draw'
  return m.winner === clubId ? 'win' : 'loss'
}

// Lo que se anota en el historial de la temporada
export function clRecord(state: ClState | null, season?: number): EuroRecord | null {
  if (!state || (season !== undefined && state.season !== season)) return null
  const me = clUser(state)
  const reach = clReach(state)
  if (!me || !reach) return null
  let goals = 0
  let margin = 0
  for (const m of clUserMatches(state)) {
    const mine = m.home === me.id ? m.hg : m.ag
    const theirs = m.home === me.id ? m.ag : m.hg
    goals += mine
    if (mine > theirs) margin = Math.max(margin, mine - theirs)
  }
  return { comp: 'champions', reach, champion: reach === 'campeon', goals, margin }
}

// Titular de la tarjeta de resultado, según lo que pasó en el partido
export function clHeadline(m: ClMatch, clubId: string, tie: ClTie | undefined): string {
  const out = clMatchOutcome(m, clubId)
  const tags = m.tags
  if (m.stage === 'liga') {
    if (tags.includes('remontada')) return out === 'win' ? 'Remontada para la historia' : 'Se escapó la victoria'
    if (tags.includes('goleada')) return out === 'win' ? 'Goleada contundente' : 'Una noche para olvidar'
    if (tags.includes('ultimo-minuto')) return out === 'win' ? 'Gol sobre la hora' : 'Dolor en el último suspiro'
    if (tags.includes('sorpresa')) return out === 'win' ? 'Sorpresa mayúscula' : 'Un tropiezo inesperado'
    if (out === 'win') return 'Victoria'
    return out === 'draw' ? 'Reparto de puntos' : 'Derrota'
  }
  const advanced = tie?.winner === clubId
  const decides = m.leg !== 1 // la vuelta y la final deciden la eliminatoria
  if (m.stage === 'final') {
    if (advanced) return tags.includes('penales') ? '¡CAMPEONES EN LOS PENALES!' : '¡CAMPEONES!'
    return tags.includes('penales') ? 'La final se pierde en los penales' : 'La final se escapa'
  }
  if (!decides) {
    if (out === 'win') return 'Ventaja en la ida'
    return out === 'draw' ? 'Todo abierto para la vuelta' : 'Hay que remontar en la vuelta'
  }
  if (tie?.decidedBy === 'penales') return advanced ? 'Héroes en los penales' : 'Cruel desenlace en los penales'
  if (tie?.decidedBy === 'prorroga') return advanced ? 'Sufrido, pero seguimos vivos' : 'Adiós en la prórroga'
  if (advanced && tags.includes('remontada')) return 'Remontada para la historia'
  return advanced ? 'Pasamos de ronda' : 'Eliminados'
}

// Frase de la pantalla de suspenso (varía según lo que está en juego)
export function clSuspenseLine(m: ClMatch, rivalIsCompatriot: boolean): string {
  if (m.stage === 'final') return 'Todo el continente mira. Una noche para la historia.'
  if (m.stage === 'semi') return m.leg === 1 ? 'Media final se juega hoy.' : 'Quien gane, sueña con la final.'
  if (m.stage === 'cuartos') return m.leg === 1 ? 'La ida marca el rumbo de la eliminatoria.' : 'Vuelta de cuartos: perder es despedirse.'
  if (m.stage === 'octavos') return m.leg === 1 ? 'Empiezan las eliminatorias: ida de octavos.' : 'Vuelta de octavos: todo se decide esta noche.'
  if (m.stage === 'playoff') return m.leg === 1 ? 'El playoff no perdona: dos partidos para seguir.' : 'Vuelta del playoff: o octavos o a casa.'
  if (rivalIsCompatriot) return `Duelo ${activeLeague().adjective} en Europa: el orgullo también juega.`
  return (m.matchday ?? 1) >= CL_LEAGUE_MATCHES ? 'Última jornada de la fase de liga: se define todo.' : 'Cada punto cuenta en la fase de liga.'
}

/* ---------- Estadísticas ---------- */
export function clScorers(state: ClState): ScorerRow[] {
  const rows = new Map<string, ScorerRow>()
  const row = (club: string, player: ScorerRow['player']): ScorerRow => {
    const key = `${club}:${player.id}`
    let r = rows.get(key)
    if (!r) {
      r = { key, player, club, goals: 0, assists: 0 }
      rows.set(key, r)
    }
    return r
  }
  for (const m of clAllMatches(state)) {
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

/* ---------- Logros ---------- */
export function clAchievements(state: ClState, history: { euro?: EuroRecord | null }[]): string[] {
  const me = clUser(state)
  if (!me) return []
  const before = history.map((h) => h.euro).filter((e): e is EuroRecord => !!e && e.comp === 'champions')
  const titles = before.filter((e) => e.champion).length
  const mine = clUserMatches(state)
  const reach = clReach(state)
  const list: string[] = []

  if (reach === 'campeon') {
    list.push(titles === 0 ? '⭐ ¡Primera Champions de la historia del club!' : `🏆 ¡${titles + 1}.ª Champions del club!`)
    if (mine.every((m) => clMatchOutcome(m, me.id) !== 'loss')) list.push('🛡️ Campeón invicto')
    if (mine.every((m) => clMatchOutcome(m, me.id) === 'win')) list.push('💯 Pleno de victorias')
  }
  if (before.length === 0) list.push('🌍 Debut en la Lifetime Champions League')
  if (clUserPosition(state) > 0 && clUserPosition(state) <= CL_DIRECT) list.push('🚀 Entre los 8 mejores de la fase de liga: octavos directos')

  const record = clRecord(state)
  if (record) {
    if (before.length > 0 && record.goals > Math.max(...before.map((e) => e.goals))) {
      list.push(`⚽ Récord goleador del club en la Champions: ${record.goals} goles`)
    }
    if (record.margin >= 3 && record.margin > Math.max(0, ...before.map((e) => e.margin))) {
      list.push(`💥 Mayor goleada europea del club (+${record.margin})`)
    }
  }
  if (mine.some((m) => m.stage !== 'liga' && clMatchOutcome(m, me.id) === 'win' && m.tags.includes('remontada'))) {
    list.push('🔥 Remontada épica en una eliminatoria')
  }
  const scorers = clScorers(state)
  if (scorers[0] && scorers[0].club === me.id && scorers[0].goals >= 2) {
    list.push(`👟 Máximo goleador de la Champions: ${scorers[0].player.name} (${scorers[0].goals})`)
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

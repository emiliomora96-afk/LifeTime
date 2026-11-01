import type { LeagueState, SimTeam } from './engine'
import { USER_ID, computeTable } from './engine'
import type { Rng } from './rng'
import { clamp, createRng, normal, poisson, shuffle } from './rng'
import {
  COPA_GATE,
  COPA_GATE_VS_PRIMERA,
  COPA_PARTICIPATION,
  COPA_ROUND_PRIZE,
  SUPERCOPA_CHAMPION,
  SUPERCOPA_FINALIST,
  SUPERCOPA_PARTICIPATION,
} from './economy'
import { activeLeague } from './activeLeague'
import type { LeagueDef } from './leagues'

/* ==========================================================================
   Copas nacionales de cada país: la Copa y la Supercopa (Copa del Rey y Supercopa de España en España).
   Se simulan enteras al cerrar la temporada (sin pantallas de partidos) y dejan su
   resultado en el balance, el historial y el palmarés.
   Los nombres salen de la liga de la partida (leagues.ts): se leen al usarlos, no al cargar el archivo.
   ========================================================================== */
export const COPA = {
  id: 'copa' as const,
  get name() { return activeLeague().cup.name },
  get short() { return activeLeague().cup.short },
  get icon() { return activeLeague().cup.icon },
}
export const SUPERCOPA = {
  id: 'supercopa' as const,
  get name() { return activeLeague().supercup.name },
  get short() { return activeLeague().supercup.short },
  get icon() { return activeLeague().supercup.icon },
}

// Copa: eliminatorias a partido único. Juegan los 40 clubes de 1.ª y 2.ª más 24 clubes de categorías inferiores.
// Como en la vida real, el club de menor categoría juega en casa; semifinales y final, en campo neutral.
export type CopaRound = 'r64' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
export const COPA_ROUNDS: { id: CopaRound; label: string }[] = [
  { id: 'r64', label: 'Primera ronda' },
  { id: 'r32', label: 'Dieciseisavos' },
  { id: 'r16', label: 'Octavos' },
  { id: 'qf', label: 'Cuartos' },
  { id: 'sf', label: 'Semifinales' },
  { id: 'final', label: 'Final' },
]
const LOWER_CLUBS = 24

// Hasta dónde llegó un club: la ronda en la que cayó, o campeón
export type CupReach = CopaRound | 'champion'
export const ROUND_LABEL: Record<CopaRound, string> = Object.fromEntries(COPA_ROUNDS.map((r) => [r.id, r.label])) as Record<CopaRound, string>
export const REACH_TEXT: Record<CupReach, string> = {
  champion: 'Campeón',
  final: 'Finalista',
  sf: 'Semifinalista',
  qf: 'Cuartos de final',
  r16: 'Octavos de final',
  r32: 'Dieciseisavos',
  r64: 'Primera ronda',
}

/* ---------- Tipos ---------- */
export interface CupEntrant {
  id: string // 'user' para tu club
  name: string // vacío en tu club (se muestra el nombre de tu club)
  level: number // fuerza con la que juega
  colors: [string, string]
  tier: 1 | 2 | 3 // 1.ª, 2.ª o categorías inferiores
  user?: boolean
}

export interface CupTie {
  round: CopaRound
  home: string
  away: string
  hg: number // goles del local (incluida la prórroga)
  ag: number
  et?: boolean // hubo prórroga
  pk?: [number, number] // penaltis: local, visitante
  neutral?: boolean
  winner: string
}

export interface CupTournament {
  entrants: CupEntrant[]
  ties: CupTie[]
  champion: string
  finalist: string
}

export interface SupercopaTournament extends CupTournament {
  reasons: Record<string, string> // por qué juega cada club
}

export interface DomesticSeason {
  season: number
  copa: CupTournament
  supercopa: SupercopaTournament
}

// Lo que se guarda en el historial de cada temporada
export interface CupRecord {
  reach: CupReach
  champion: boolean
  goals: number
}

export function entrantName(e: CupEntrant, clubName: string): string {
  return e.user ? clubName : e.name
}

export function entrantMap(t: CupTournament): Map<string, CupEntrant> {
  return new Map(t.entrants.map((e) => [e.id, e]))
}

/* ---------- Partido ---------- */
// Mismo modelo que la liga (engine.ts): los goles esperados salen de la diferencia de nivel
const BASE_GOALS = 1.3
const HOME_FACTOR = 1.15
const AWAY_FACTOR = 0.9
const STRENGTH_SENSITIVITY = 0.045
const EXTRA_TIME_SHARE = 0.33 // la prórroga es un tercio de partido

function shootout(pHome: number, rng: Rng): [number, number] {
  const convert = (p: number) => clamp(0.75 + (p - 0.5), 0.6, 0.9)
  const ch = convert(pHome)
  const ca = convert(1 - pHome)
  let h = 0
  let a = 0
  for (let k = 0; k < 5; k++) {
    if (rng() < ch) h++
    if (rng() < ca) a++
  }
  for (let guard = 0; h === a && guard < 20; guard++) {
    if (rng() < ch) h++
    if (rng() < ca) a++
  }
  if (h === a) {
    if (rng() < pHome) h++
    else a++
  }
  return [h, a]
}

export function playTie(home: CupEntrant, away: CupEntrant, round: CopaRound, neutral: boolean, rng: Rng): CupTie {
  const diff = home.level - away.level
  const lamHome = clamp(BASE_GOALS * (neutral ? 1 : HOME_FACTOR) * Math.exp(STRENGTH_SENSITIVITY * diff), 0.15, 5)
  const lamAway = clamp(BASE_GOALS * (neutral ? 1 : AWAY_FACTOR) * Math.exp(-STRENGTH_SENSITIVITY * diff), 0.15, 5)
  let hg = poisson(lamHome, rng)
  let ag = poisson(lamAway, rng)
  const tie: CupTie = { round, home: home.id, away: away.id, hg, ag, winner: home.id }
  if (neutral) tie.neutral = true

  if (hg === ag) {
    hg += poisson(lamHome * EXTRA_TIME_SHARE, rng)
    ag += poisson(lamAway * EXTRA_TIME_SHARE, rng)
    tie.et = true
    tie.hg = hg
    tie.ag = ag
  }
  if (hg === ag) {
    const pk = shootout(clamp(0.5 + diff * 0.004, 0.42, 0.58), rng)
    tie.pk = pk
    tie.winner = pk[0] > pk[1] ? home.id : away.id
  } else {
    tie.winner = hg > ag ? home.id : away.id
  }
  return tie
}

/* ---------- Clubes de categorías inferiores (inventados, con nombres de cada país) ---------- */
const LOWER_COLORS: [string, string][] = [
  ['#dc2626', '#f8fafc'], ['#1d4ed8', '#f8fafc'], ['#16a34a', '#f8fafc'], ['#f59e0b', '#111827'],
  ['#7c3aed', '#f8fafc'], ['#0891b2', '#f8fafc'], ['#be123c', '#fde68a'], ['#0f172a', '#f8fafc'],
  ['#ea580c', '#1e293b'], ['#065f46', '#fde68a'],
]

function lowerClubs(rng: Rng, def: LeagueDef): CupEntrant[] {
  const { patterns, places } = def.lower
  return shuffle(places, rng)
    .slice(0, LOWER_CLUBS)
    .map((place, i) => ({
      id: `lo-${i}`,
      name: patterns[Math.floor(rng() * patterns.length)].replace('{c}', place),
      level: Math.round(clamp(60.5 + normal(rng) * 2.5, 54, 67) * 10) / 10,
      colors: LOWER_COLORS[Math.floor(rng() * LOWER_COLORS.length)],
      tier: 3 as const,
    }))
}

function teamEntrant(t: SimTeam, tier: 1 | 2): CupEntrant {
  const user = t.id === USER_ID
  return {
    id: entrantId(t.id),
    name: user ? '' : t.name,
    level: Math.round(t.strength * 10) / 10,
    colors: t.colors ?? LOWER_COLORS[0],
    tier,
    user: user || undefined,
  }
}

function entrantId(teamId: number): string {
  return teamId === USER_ID ? 'user' : `t${teamId}`
}

/* ---------- Copa del Rey ---------- */
// El club de menor categoría juega en casa; entre iguales, el sorteo decide
function orderHome(a: CupEntrant, b: CupEntrant, rng: Rng): [CupEntrant, CupEntrant] {
  if (a.tier !== b.tier) return a.tier > b.tier ? [a, b] : [b, a]
  return rng() < 0.5 ? [a, b] : [b, a]
}

function pairUp(list: CupEntrant[], rng: Rng): [CupEntrant, CupEntrant][] {
  const mixed = shuffle(list, rng)
  const pairs: [CupEntrant, CupEntrant][] = []
  for (let i = 0; i + 1 < mixed.length; i += 2) pairs.push([mixed[i], mixed[i + 1]])
  return pairs
}

// Primera ronda: cada club de 1.ª recibe a un club de categoría inferior; el resto se sortea entre sí
function firstRoundPairs(field: CupEntrant[], rng: Rng): [CupEntrant, CupEntrant][] {
  const top = shuffle(field.filter((e) => e.tier === 1), rng)
  const others = shuffle(field.filter((e) => e.tier !== 1), rng)
  const pairs: [CupEntrant, CupEntrant][] = top.map((t, i) => [t, others[i]])
  return [...pairs, ...pairUp(others.slice(top.length), rng)]
}

export function playCopa(league: LeagueState, rng: Rng, def: LeagueDef = activeLeague()): CupTournament {
  const field: CupEntrant[] = [
    ...league.divisions[1].teams.map((t) => teamEntrant(t, 1)),
    ...league.divisions[2].teams.map((t) => teamEntrant(t, 2)),
    ...lowerClubs(rng, def),
  ]
  const ties: CupTie[] = []
  let alive = field

  COPA_ROUNDS.forEach((round, i) => {
    const neutral = round.id === 'sf' || round.id === 'final'
    const pairs = i === 0 ? firstRoundPairs(alive, rng) : pairUp(alive, rng)
    alive = pairs.map(([x, y]) => {
      const [home, away] = neutral ? [x, y] : orderHome(x, y, rng)
      const tie = playTie(home, away, round.id, neutral, rng)
      ties.push(tie)
      return tie.winner === home.id ? home : away
    })
  })

  const final = ties[ties.length - 1]
  return {
    entrants: field,
    ties,
    champion: final.winner,
    finalist: final.winner === final.home ? final.away : final.home,
  }
}

/* ---------- Supercopa ---------- */
// España: la juegan el campeón y el subcampeón de Liga, y el campeón y el finalista de Copa.
// Si un club ocupa dos plazas, la segunda pasa al siguiente clasificado de Liga.
// Semifinales: campeón de Liga contra finalista de Copa, y campeón de Copa contra subcampeón de Liga. Todo en campo neutral.
// Inglaterra, Italia, Alemania y Francia: un solo partido entre el campeón de Liga y el campeón de Copa.
// Si es el mismo club (doblete), su rival es el subcampeón de Liga (o el finalista de Copa en Italia).
export function playSupercopa(league: LeagueState, copa: CupTournament, rng: Rng, def: LeagueDef = activeLeague()): SupercopaTournament {
  const byId = entrantMap(copa)
  const table = computeTable(league.divisions[1]).map((r) => entrantId(r.id))
  const get = (id: string): CupEntrant => byId.get(id) as CupEntrant

  if (def.superFormat === 'two') return playSupercopaTwo(def, table, copa, get, rng)

  // [rol, club, motivo]: el orden es el de prioridad para repartir las plazas repetidas
  const roles: { slot: number; id: string; reason: string }[] = [
    { slot: 0, id: table[0], reason: 'Campeón de Liga' },
    { slot: 2, id: table[1], reason: 'Subcampeón de Liga' },
    { slot: 1, id: copa.champion, reason: 'Campeón de Copa' },
    { slot: 3, id: copa.finalist, reason: 'Finalista de Copa' },
  ]

  const slots: string[] = []
  const reasons: Record<string, string> = {}
  const taken = new Set<string>()
  roles.forEach((role, k) => {
    let id = role.id
    let reason = role.reason
    if (taken.has(id)) {
      const reserved = new Set(roles.slice(k + 1).map((r) => r.id))
      const pos = table.findIndex((t) => !taken.has(t) && !reserved.has(t))
      id = table[pos]
      reason = `Siguiente clasificado de Liga (${pos + 1}.º)`
    }
    taken.add(id)
    slots[role.slot] = id
    reasons[id] = reason
  })

  const entrants = slots.map(get)
  const ties: CupTie[] = []
  const semis = [
    [get(slots[0]), get(slots[3])],
    [get(slots[1]), get(slots[2])],
  ]
  const finalists = semis.map(([a, b]) => {
    const tie = playTie(a, b, 'sf', true, rng)
    ties.push(tie)
    return tie.winner === a.id ? a : b
  })
  const final = playTie(finalists[0], finalists[1], 'final', true, rng)
  ties.push(final)

  return {
    entrants,
    ties,
    champion: final.winner,
    finalist: final.winner === final.home ? final.away : final.home,
    reasons,
  }
}

// Supercopa de un solo partido (Inglaterra, Italia, Alemania y Francia)
function playSupercopaTwo(
  def: LeagueDef,
  table: string[],
  copa: CupTournament,
  get: (id: string) => CupEntrant,
  rng: Rng,
): SupercopaTournament {
  const leagueChampion = table[0]
  const double = copa.champion === leagueChampion
  let rival = copa.champion
  let rivalReason = 'Campeón de Copa'
  if (double) {
    if (def.superDouble === 'cupFinalist') {
      rival = copa.finalist
      rivalReason = 'Finalista de Copa (el campeón de Liga ganó el doblete)'
    } else {
      rival = table[1]
      rivalReason = 'Subcampeón de Liga (el campeón de Liga ganó el doblete)'
    }
  }
  const reasons: Record<string, string> = { [leagueChampion]: double ? 'Campeón de Liga y de Copa' : 'Campeón de Liga', [rival]: rivalReason }
  const champion = get(leagueChampion)
  const other = get(rival)
  // Alemania: juega en casa el campeón de Copa (o el subcampeón si hubo doblete). En los demás países, campo neutral
  const [home, away] = def.superHostsCupWinner ? [other, champion] : [champion, other]
  const final = playTie(home, away, 'final', !def.superHostsCupWinner, rng)
  return {
    entrants: [champion, other],
    ties: [final],
    champion: final.winner,
    finalist: final.winner === final.home ? final.away : final.home,
    reasons,
  }
}

/* ---------- Temporada completa ---------- */
export function playDomesticSeason(league: LeagueState, seed: number, season: number, def: LeagueDef = activeLeague()): DomesticSeason {
  const rng = createRng(seed)
  const copa = playCopa(league, rng, def)
  const supercopa = playSupercopa(league, copa, rng, def)
  return { season, copa, supercopa }
}

/* ---------- Lo que logró tu club ---------- */
export function userTies(t: CupTournament): CupTie[] {
  return t.ties.filter((x) => x.home === 'user' || x.away === 'user')
}

function recordOf(t: CupTournament): CupRecord | null {
  const mine = userTies(t)
  if (mine.length === 0) return null
  const champion = t.champion === 'user'
  const goals = mine.reduce((sum, x) => sum + (x.home === 'user' ? x.hg : x.ag), 0)
  return { reach: champion ? 'champion' : mine[mine.length - 1].round, champion, goals }
}

export function userCopaRecord(ds: DomesticSeason): CupRecord | null {
  return recordOf(ds.copa)
}

export function userSupercopaRecord(ds: DomesticSeason): CupRecord | null {
  return recordOf(ds.supercopa)
}

/* ---------- Dinero ---------- */
export interface CupIncomeLine {
  label: string
  amount: number
}

const roundK = (n: number) => Math.round(n / 1000) * 1000

// Premios y taquilla de las dos copas. Se suman al balance de la temporada.
export function cupIncome(ds: DomesticSeason, division: 1 | 2): CupIncomeLine[] {
  const lines: CupIncomeLine[] = []

  const copaMine = userTies(ds.copa)
  if (copaMine.length > 0) {
    const prizes = copaMine.filter((x) => x.winner === 'user').reduce((sum, x) => sum + COPA_ROUND_PRIZE[x.round], 0)
    lines.push({ label: `${COPA.name}: premios`, amount: COPA_PARTICIPATION + prizes })

    const byId = entrantMap(ds.copa)
    const gate = copaMine
      .filter((x) => x.home === 'user' && !x.neutral)
      .reduce((sum, x) => sum + COPA_GATE[division] * (byId.get(x.away)?.tier === 1 ? COPA_GATE_VS_PRIMERA : 1), 0)
    if (gate > 0) lines.push({ label: `${COPA.name}: taquilla`, amount: roundK(gate) })
  }

  const rec = userSupercopaRecord(ds)
  if (rec) {
    const reachedFinal = rec.reach === 'final' || rec.champion
    const amount = SUPERCOPA_PARTICIPATION + (reachedFinal ? SUPERCOPA_FINALIST : 0) + (rec.champion ? SUPERCOPA_CHAMPION : 0)
    lines.push({ label: SUPERCOPA.name, amount })
  }
  return lines
}

import { BASE_STOPS, EVENT_STOPS, START_INVESTMENTS, TOTAL_SEASONS } from './config'
import type { BaseStopId, InvestArea, Notice } from './config'
import { buildNotices } from './notices'
import type { ScoutFilter, SimPlayer } from './players'
import {
  LEAGUE_VERSION,
  USER_ID,
  aiWinterWindow,
  createLeague,
  finishSeason,
  getUserTeam,
  normalizeUserLineup,
  setUserTactic,
  simulateLeague,
  userSeasonResult,
} from './engine'
import type { LeagueState, SeasonOutcome, Tactic } from './engine'
import { ageAcademy, generateIntake } from './academy'
import { buildEuropeFromLeague } from './europe'
import { clChampionEntrant, clRecord, playChampionsKnockout, playChampionsLeague, userInChampions } from './champions'
import type { ClState } from './champions'
import type { EuropeId, EuropeSeason } from './europe'
import { euroRecord, playEuropeSeason } from './tournament'
import type { EuroRecord, TournamentSeason } from './tournament'
import { buildOffers } from './market'
import type { MarketOffer } from './market'
import { clamp, createRng, mixSeed, randomSeed } from './rng'
import type { MoveNews } from './aiclubs'
import { PRESTIGE_MAX, PRESTIGE_MIN, START_PRESTIGE, cupPrestigeChange, prestigeChange } from './economy'
import { playDomesticSeason, userCopaRecord, userSupercopaRecord } from './domestic'
import type { CupRecord, DomesticSeason } from './domestic'
import { DEFAULT_LEAGUE, isLeagueId } from './leagues'
import type { LeagueId } from './leagues'
import { setActiveLeague } from './activeLeague'

export const GAME_KEY = 'lifetime-game'

// Lo que le pides a los ojeadores: posición, valoración, potencial y edad
export type ScoutOrder = ScoutFilter

export interface SeasonRecord extends SeasonOutcome {
  season: number
  europe?: EuropeId | null // competición europea a la que clasificó esa temporada
  euro?: EuroRecord | null // cómo le fue en el torneo europeo que jugó esa temporada (Paso 9)
  copa?: CupRecord | null // cómo le fue en la Copa del Rey esa temporada
  supercopa?: CupRecord | null // Supercopa de España, si la jugó
  strength?: number // nivel del once al cerrar la temporada (Paso 10)
  topScorer?: { name: string; goals: number } | null // goleador del club esa temporada
  bestPlayer?: { name: string; pos: string; rating: number } | null // el mejor jugador del club
}

// Jugador que pasó por tu club: se queda en el legado aunque se retire o se vaya (Paso 10)
export interface Legend {
  id: string
  name: string
  pos: string
  nat?: string
  firstSeason: number
  lastSeason: number
  seasons: number
  goals: number
  assists: number
  apps: number // partidos como titular
  titles: number // títulos (liga, copas o torneo europeo) ganados con tu club
  peak: number // mejor valoración
}

export function legendScore(l: Legend): number {
  return l.goals + l.assists * 0.6 + l.apps * 0.15 + l.titles * 12 + l.seasons * 2 + Math.max(0, l.peak - 70) * 1.5
}

// Suma la temporada que acaba de terminar a la historia de cada jugador del club
function updateLegends(
  legends: Record<string, Legend>,
  league: LeagueState,
  season: number,
  titles: number,
): { legends: Record<string, Legend>; topScorer: SeasonRecord['topScorer']; bestPlayer: SeasonRecord['bestPlayer'] } {
  const div = league.divisions[league.userDivision]
  const mine = div.teams.find((t) => t.id === USER_ID)
  const goals = new Map<string, number>()
  const assists = new Map<string, number>()
  for (const m of div.results) {
    for (const e of m.goals) {
      if (e.team !== USER_ID) continue
      goals.set(e.scorer, (goals.get(e.scorer) ?? 0) + 1)
      if (e.assist) assists.set(e.assist, (assists.get(e.assist) ?? 0) + 1)
    }
  }
  const next = { ...legends }
  let topScorer: SeasonRecord['topScorer'] = null
  let bestPlayer: SeasonRecord['bestPlayer'] = null
  for (const p of mine?.squad ?? []) {
    const g = goals.get(p.id) ?? 0
    const prev = next[p.id]
    next[p.id] = {
      id: p.id,
      name: p.name,
      pos: p.pos,
      nat: p.nat,
      firstSeason: prev?.firstSeason ?? season,
      lastSeason: season,
      seasons: (prev?.seasons ?? 0) + 1,
      goals: (prev?.goals ?? 0) + g,
      assists: (prev?.assists ?? 0) + (assists.get(p.id) ?? 0),
      apps: (prev?.apps ?? 0) + (p.starts ?? 0),
      titles: (prev?.titles ?? 0) + titles,
      peak: Math.max(prev?.peak ?? 0, p.rating),
    }
    if (g > 0 && (!topScorer || g > topScorer.goals)) topScorer = { name: p.name, goals: g }
    if (!bestPlayer || p.rating > bestPlayer.rating) bestPlayer = { name: p.name, pos: p.pos, rating: p.rating }
  }
  return { legends: next, topScorer, bestPlayer }
}

export interface GameState {
  leagueId?: LeagueId // la liga en la que juegas (si falta, es España: partidas de antes de tener más ligas)
  seed: number // semilla de la partida: permite repetir la simulación exacta
  season: number
  round: number // jornadas jugadas
  baseStop: BaseStopId // última parada base alcanzada
  eventId: string | null // parada por evento activa, si la hay
  pending: string[] // eventos que faltan por mostrar
  notices: Notice[] // avisos de la parada actual
  answers: Record<string, string> // aviso -> opción elegida
  investments: Record<InvestArea, number> // nivel 0 a 3 de cada inversión
  scoutOrder: ScoutOrder | null // búsqueda en curso
  leaving: string[] // jugadores que se van al terminar la temporada
  academy: SimPlayer[] // juveniles de la cantera del club
  europe: EuropeSeason | null // competiciones europeas de esta temporada (se arman al cerrar la anterior)
  tournament: TournamentSeason | null // torneo europeo ya simulado por el motor (se calcula al abrir la parada 'torneo')
  champions: ClState | null // Lifetime Champions League: fase de liga (parada de inicio) y eliminatorias (parada final)
  domestic: DomesticSeason | null // Copa del Rey y Supercopa de esta temporada (se simulan al llegar al cierre)
  offers: MarketOffer[] // ofertas de otros clubes por tus jugadores (solo con el mercado abierto)
  league: LeagueState // las dos divisiones con sus partidos
  legends: Record<string, Legend> // jugadores que pasaron por tu club y sus números (Paso 10)
  news: MoveNews[] // fichajes y juveniles destacados de los demás clubes en la última ventana (Paso 10)
  tactic: Tactic // táctica del club del jugador
  prestige: number
  history: SeasonRecord[] // resultado de cada temporada terminada
  finished: boolean
}

export function initialGame(rng: () => number = Math.random, leagueId: LeagueId = DEFAULT_LEAGUE): GameState {
  setActiveLeague(leagueId) // todo lo que se genera a partir de aquí (jugadores, clubes, copas) es de esta liga
  const seed = randomSeed()
  const base: GameState = {
    leagueId,
    seed,
    season: 1,
    round: BASE_STOPS[0].round,
    baseStop: BASE_STOPS[0].id,
    eventId: null,
    pending: [],
    notices: [],
    answers: {},
    investments: { ...START_INVESTMENTS },
    scoutOrder: null,
    leaving: [],
    academy: [],
    europe: null,
    tournament: null,
    champions: null,
    domestic: null,
    offers: [],
    league: createLeague(seed, leagueId),
    legends: {},
    news: [],
    tactic: 'equilibrada',
    prestige: START_PRESTIGE,
    history: [],
    finished: false,
  }
  const teamLevel = getUserTeam(base.league)?.strength ?? 65
  const academy = generateIntake([], base.investments.academy, teamLevel, 1, rng)
  const started = { ...base, academy }
  return { ...started, notices: buildNotices(started, rng), offers: buildOffers(started, rng) }
}

// ¿Hay una partida guardada que se puede cargar tal cual? (si no, se empieza de cero)
export function hasCompatibleSave(): boolean {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    if (!raw) return false
    const g = JSON.parse(raw) as Partial<GameState>
    return validSave(g)
  } catch {
    return false
  }
}

function validSave(g: Partial<GameState>): boolean {
  return !(
    typeof g.seed !== 'number' ||
    typeof g.season !== 'number' ||
    typeof g.round !== 'number' ||
    !BASE_STOPS.some((s) => s.id === g.baseStop) ||
    !Array.isArray(g.notices) ||
    typeof g.investments !== 'object' ||
    g.investments === null ||
    !Array.isArray(g.leaving) ||
    !Array.isArray(g.academy) ||
    !Array.isArray(g.offers) ||
    typeof g.league !== 'object' ||
    g.league === null ||
    !('divisions' in g.league) ||
    !('year' in g.league) ||
    (g.league as LeagueState).v !== LEAGUE_VERSION ||
    typeof g.tactic !== 'string' ||
    typeof g.prestige !== 'number' ||
    !Array.isArray(g.history)
  )
}

// Convierte un texto de partida en un estado listo para usar (null si está dañado o es de otra versión)
export function parseGame(raw: unknown): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const g = raw as Partial<GameState>
  if (!validSave(g)) return null
  // La liga se fija antes de generar nada: las partidas de antes de tener más ligas son de España
  const leagueId: LeagueId = isLeagueId(g.leagueId) ? g.leagueId : DEFAULT_LEAGUE
  setActiveLeague(leagueId)
  const loaded = {
    ...initialGame(undefined, leagueId),
    ...g,
    leagueId,
    investments: { ...START_INVESTMENTS, ...g.investments },
    legends: typeof g.legends === 'object' && g.legends !== null ? g.legends : {},
    news: Array.isArray(g.news) ? g.news : [],
  } as GameState
  // Si el once guardado no es un 4-3-3 válido, se corrige al cargar
  return ensureDomestic({ ...loaded, league: normalizeUserLineup(loaded.league) })
}

// Una partida guardada con la liga ya terminada pero sin copas (versión anterior) las recibe al cargar
function ensureDomestic(game: GameState): GameState {
  if (game.finished || game.baseStop !== 'cierre') return game
  if (game.domestic && game.domestic.season === game.season) return game
  return { ...game, domestic: playDomesticSeason(game.league, mixSeed(game.seed, game.season, 4242), game.season) }
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    if (!raw) return initialGame()
    return parseGame(JSON.parse(raw)) ?? initialGame()
  } catch {
    return initialGame()
  }
}

export function saveGame(game: GameState): void {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(game))
  } catch {
    // Si no se puede guardar, la partida sigue en esta sesión
  }
}

// Pasa a la siguiente parada base y simula los partidos del tramo
function nextBase(game: GameState): GameState {
  const idx = BASE_STOPS.findIndex((s) => s.id === game.baseStop)
  const next = BASE_STOPS[idx + 1]

  if (next) {
    let league = simulateLeague(
      setUserTactic(game.league, game.tactic),
      next.round,
      mixSeed(game.seed, game.season, next.round),
    )
    let news = game.news
    // A mitad de temporada los demás clubes también mueven ficha
    if (next.id === 'invierno') {
      league = aiWinterWindow(league, mixSeed(game.seed, game.season, 555))
      news = league.moves ?? []
    }
    // Al llegar al cierre la liga está terminada: es el momento de simular las copas nacionales
    const domestic =
      next.id === 'cierre'
        ? playDomesticSeason(league, mixSeed(game.seed, game.season, 4242), game.season)
        : game.domestic
    return { ...game, league, news, domestic, baseStop: next.id, round: next.round, eventId: null, pending: [] }
  }

  // Fin de la temporada
  const outcome = userSeasonResult(game.league)
  // Quién juega Europa la temporada siguiente, según la posición final en 1.ª división
  const europe = buildEuropeFromLeague(game.league, game.season + 1, mixSeed(game.seed, game.season, 888))
  const euro =
    clRecord(game.champions, game.season) ??
    (game.tournament && game.tournament.season === game.season ? euroRecord(game.tournament) : null)
  const done = game.domestic && game.domestic.season === game.season ? game.domestic : null
  const copa = done ? userCopaRecord(done) : null
  const supercopa = done ? userSupercopaRecord(done) : null
  const titles =
    (outcome.champion && outcome.division === 1 ? 1 : 0) +
    (euro?.champion ? 1 : 0) +
    (copa?.champion ? 1 : 0) +
    (supercopa?.champion ? 1 : 0)
  const closed = updateLegends(game.legends, game.league, game.season, titles)
  const strength = getUserTeam(game.league)?.strength
  const history = [
    ...game.history,
    { season: game.season, ...outcome, europe: europe.user, euro, copa, supercopa, strength, topScorer: closed.topScorer, bestPlayer: closed.bestPlayer },
  ]
  const prestige = clamp(game.prestige + prestigeChange({ ...outcome, prestige: game.prestige }) + cupPrestigeChange(copa, supercopa), PRESTIGE_MIN, PRESTIGE_MAX)

  if (game.season >= TOTAL_SEASONS) {
    return { ...game, history, legends: closed.legends, prestige, finished: true, eventId: null, pending: [], tournament: null, champions: null }
  }
  const league = finishSeason(game.league, mixSeed(game.seed, game.season, 999), {
    academyBonus: (game.investments.academy - 1) * 2.5,
    leaving: game.leaving,
  })

  // La cantera: los juveniles crecen, los que pasan de 19 años se van y llegan otros nuevos
  const rng = createRng(mixSeed(game.seed, game.season, 777))
  const aged = ageAcademy(game.academy, rng, game.investments.academy)
  const teamLevel = getUserTeam(league)?.strength ?? 65
  const intake = generateIntake(aged, game.investments.academy, teamLevel, game.season + 1, rng)

  return {
    ...game,
    season: game.season + 1,
    baseStop: BASE_STOPS[0].id,
    round: BASE_STOPS[0].round,
    eventId: null,
    pending: [],
    league,
    legends: closed.legends,
    news: league.moves ?? [],
    academy: [...aged, ...intake],
    europe,
    tournament: null,
    champions: null,
    domestic: null,
    leaving: [],
    prestige,
    history,
  }
}

// Hay eventos que solo existen si pasa algo concreto en la temporada
function eventApplies(eventId: string, game: GameState): boolean {
  if (eventId === 'torneo') return game.europe !== null && game.europe.season === game.season
  if (eventId === 'champions-liga') return userInChampions(game) // solo si tu club juega la Champions
  return true
}

// Avanza a la siguiente parada (evento o base) y genera sus avisos
export function advance(game: GameState, rng: () => number = Math.random): GameState {
  if (game.finished) return game

  let next: GameState
  if (game.eventId !== null) {
    if (game.pending.length > 0) {
      const [first, ...rest] = game.pending
      next = { ...game, eventId: first, pending: rest }
    } else {
      next = nextBase({ ...game, eventId: null })
    }
  } else {
    const triggered = EVENT_STOPS.filter(
      (e) => e.afterStop === game.baseStop && eventApplies(e.id, game) && rng() < e.chance,
    ).map((e) => e.id)
    if (triggered.length > 0) {
      const [first, ...rest] = triggered
      next = { ...game, eventId: first, pending: rest }
    } else {
      next = nextBase(game)
    }
  }

  if (next.finished) return next
  // Paso 9: el motor calcula TODO el torneo antes de que se abra la pantalla
  // Parada de inicio: la fase de liga de la Champions, con las plantillas de ese momento
  if (next.eventId === 'champions-liga' && (next.champions === null || next.champions.season !== next.season)) {
    next = { ...next, champions: playChampionsLeague(next) }
  }
  // Parada final: las eliminatorias de la Champions (con el mercado de invierno ya hecho) y las demás competiciones
  if (next.eventId === 'torneo' && next.tournament === null) {
    const cl = playChampionsKnockout(next)
    next = { ...next, champions: cl ?? next.champions }
    next = { ...next, tournament: playEuropeSeason({ ...next, clChampion: cl ? clChampionEntrant(cl) : null }) }
  }
  return {
    ...next,
    notices: buildNotices(next, rng),
    offers: buildOffers(next, rng),
    answers: {},
    // La búsqueda se entrega en la próxima parada base, no en un evento
    scoutOrder: next.eventId === null ? null : next.scoutOrder,
  }
}

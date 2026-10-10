import { BASE_STOPS, EVENT_STOPS, START_INVESTMENTS, TOTAL_SEASONS } from './config'
import type { BaseStopId, InvestArea, Notice } from './config'
import { buildNotices } from './notices'
import type { Position } from './sample'
import { createLeague, finishSeason, setUserTactic, simulateLeague, userSeasonResult } from './engine'
import type { LeagueState, SeasonOutcome, Tactic } from './engine'
import { clamp, mixSeed, randomSeed } from './rng'
import { PRESTIGE_MAX, PRESTIGE_MIN, START_PRESTIGE, prestigeChange } from './economy'

export const GAME_KEY = 'lifetime-game'

export interface ScoutOrder {
  pos: Position
  minRating: number
  minPotential: number
}

export interface SeasonRecord extends SeasonOutcome {
  season: number
}

export interface GameState {
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
  salaryExtra: number // cambio acumulado en la masa salarial
  league: LeagueState // las dos divisiones con sus partidos
  tactic: Tactic // táctica del club del jugador
  prestige: number
  history: SeasonRecord[] // resultado de cada temporada terminada
  finished: boolean
}

export function initialGame(rng: () => number = Math.random): GameState {
  const seed = randomSeed()
  const base: GameState = {
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
    salaryExtra: 0,
    league: createLeague(seed),
    tactic: 'equilibrada',
    prestige: START_PRESTIGE,
    history: [],
    finished: false,
  }
  return { ...base, notices: buildNotices(base, rng) }
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    if (!raw) return initialGame()
    const g = JSON.parse(raw) as Partial<GameState>
    if (
      typeof g.seed !== 'number' ||
      typeof g.season !== 'number' ||
      typeof g.round !== 'number' ||
      !BASE_STOPS.some((s) => s.id === g.baseStop) ||
      !Array.isArray(g.notices) ||
      typeof g.investments !== 'object' ||
      g.investments === null ||
      typeof g.salaryExtra !== 'number' ||
      typeof g.league !== 'object' ||
      g.league === null ||
      !('divisions' in g.league) ||
      typeof g.tactic !== 'string' ||
      typeof g.prestige !== 'number' ||
      !Array.isArray(g.history)
    ) {
      return initialGame()
    }
    return {
      ...initialGame(),
      ...g,
      investments: { ...START_INVESTMENTS, ...g.investments },
    }
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
    const league = simulateLeague(
      setUserTactic(game.league, game.tactic),
      next.round,
      mixSeed(game.seed, game.season, next.round),
    )
    return { ...game, league, baseStop: next.id, round: next.round, eventId: null, pending: [] }
  }

  // Fin de la temporada
  const outcome = userSeasonResult(game.league)
  const history = [...game.history, { season: game.season, ...outcome }]
  const prestige = clamp(game.prestige + prestigeChange(outcome), PRESTIGE_MIN, PRESTIGE_MAX)

  if (game.season >= TOTAL_SEASONS) {
    return { ...game, history, prestige, finished: true, eventId: null, pending: [] }
  }
  return {
    ...game,
    season: game.season + 1,
    baseStop: BASE_STOPS[0].id,
    round: BASE_STOPS[0].round,
    eventId: null,
    pending: [],
    league: finishSeason(game.league, mixSeed(game.seed, game.season, 999)),
    prestige,
    history,
  }
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
    const triggered = EVENT_STOPS.filter((e) => e.afterStop === game.baseStop && rng() < e.chance).map((e) => e.id)
    if (triggered.length > 0) {
      const [first, ...rest] = triggered
      next = { ...game, eventId: first, pending: rest }
    } else {
      next = nextBase(game)
    }
  }

  if (next.finished) return next
  return {
    ...next,
    notices: buildNotices(next, rng),
    answers: {},
    // La búsqueda se entrega en la próxima parada base, no en un evento
    scoutOrder: next.eventId === null ? null : next.scoutOrder,
  }
}

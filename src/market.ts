import type { GameState } from './game'
import type { BaseStopId } from './config'
import type { LeagueState, Level, SimTeam } from './engine'
import { USER_ID, getUserSquad } from './engine'
import type { SimPlayer } from './players'
import { marketValue, newSigning } from './players'
import { MAX_SQUAD, FORMATION_COUNT, SQUAD_TEMPLATE, pickStarters, repairStarters, squadStrength } from './squads'
import type { Position } from './sample'
import { createRng, mixSeed, pickOne, shuffle } from './rng'
import type { Rng } from './rng'

/* ---------- Mercado de fichajes ---------- */
// Solo se ficha y se vende en las paradas de Verano e Invierno
export const MARKET_STOPS: BaseStopId[] = ['verano', 'invierno']

// Mínimo de jugadores por posición para poder vender (un suplente por encima del once)
export const MIN_PER_POS: Record<Position, number> = {
  POR: FORMATION_COUNT.POR + 1,
  DEF: FORMATION_COUNT.DEF + 1,
  MED: FORMATION_COUNT.MED + 1,
  DEL: FORMATION_COUNT.DEL + 1,
}

const GIANT_PREMIUM = 1.3 // los gigantes piden más por sus jugadores
const QUICK_SALE = 0.85 // venta directa: se cobra algo menos que el valor de mercado
const MAX_OFFERS = 3

export interface MarketOffer {
  id: string
  playerId: string
  teamId: number
  teamName: string
  amount: number
}

export interface Listing {
  player: SimPlayer
  teamId: number
  teamName: string
  division: Level
  price: number
}

export function marketOpen(game: Pick<GameState, 'eventId' | 'baseStop'>): boolean {
  return game.eventId === null && MARKET_STOPS.includes(game.baseStop)
}

function roundK(n: number): number {
  return Math.round(n / 1000) * 1000
}

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

function rivals(league: LeagueState): { team: SimTeam; division: Level }[] {
  const out: { team: SimTeam; division: Level }[] = []
  for (const division of [1, 2] as Level[]) {
    for (const team of league.divisions[division].teams) if (team.id !== USER_ID) out.push({ team, division })
  }
  return out
}

/* ---------- Comprar ---------- */
export function askingPrice(p: SimPlayer, team: SimTeam): number {
  return roundK(marketValue(p) * (team.anchor ? GIANT_PREMIUM : 1))
}

// Todos los jugadores de los clubes rivales con su precio
export function listMarket(league: LeagueState): Listing[] {
  const list: Listing[] = []
  for (const { team, division } of rivals(league)) {
    for (const player of team.squad) {
      list.push({ player, teamId: team.id, teamName: team.name, division, price: askingPrice(player, team) })
    }
  }
  return list
}

// Devuelve el motivo por el que no se puede fichar, o null si se puede
export function buyBlocker(game: GameState, budget: number, listing: Listing): string | null {
  if (!marketOpen(game)) return 'El mercado está cerrado'
  if (getUserSquad(game.league).length >= MAX_SQUAD) return `Plantilla llena (${MAX_SQUAD})`
  if (budget < listing.price) return 'No alcanza el presupuesto'
  if (!listMarket(game.league).some((l) => l.player.id === listing.player.id)) return 'Ya no está disponible'
  return null
}

function replaceTeam(league: LeagueState, teamId: number, change: (t: SimTeam) => SimTeam): LeagueState {
  const divisions = { ...league.divisions }
  for (const level of [1, 2] as Level[]) {
    const div = divisions[level]
    if (div.teams.some((t) => t.id === teamId)) {
      divisions[level] = { ...div, teams: div.teams.map((t) => (t.id === teamId ? change(t) : t)) }
    }
  }
  return { ...league, divisions }
}

function withSquad(team: SimTeam, squad: SimPlayer[]): SimTeam {
  const lineup = team.autoLineup === false ? repairStarters(squad) : pickStarters(squad)
  return { ...team, squad: lineup, strength: squadStrength(lineup) }
}

// El jugador pasa de su club al tuyo. El club rival repone la plaza con un fichaje de su nivel.
export function buyPlayer(league: LeagueState, listing: Listing, seed: number): LeagueState {
  const { player, teamId } = listing
  const rng = createRng(mixSeed(seed, hash(player.id)))
  let moved: SimPlayer = { ...player, starter: false, starts: 0 }

  let next = replaceTeam(league, teamId, (t) => {
    const rest = t.squad.filter((p) => p.id !== player.id)
    if (rest.filter((p) => p.pos === player.pos).length < SQUAD_TEMPLATE[player.pos]) {
      rest.push(newSigning(`t${t.id}-m${hash(player.id)}`, player.pos, t.level, rng))
    }
    return withSquad(t, rest)
  })

  next = replaceTeam(next, USER_ID, (t) => {
    moved = { ...moved, starter: false }
    return withSquad(t, [...t.squad, moved])
  })
  return next
}

/* ---------- Vender ---------- */
export function quickSalePrice(p: SimPlayer): number {
  return roundK(marketValue(p) * QUICK_SALE)
}

export function sellBlocker(game: GameState, player: SimPlayer): string | null {
  if (!marketOpen(game)) return 'El mercado está cerrado'
  const squad = getUserSquad(game.league)
  if (squad.filter((p) => p.pos === player.pos).length <= MIN_PER_POS[player.pos]) {
    return `Necesitas al menos ${MIN_PER_POS[player.pos]} ${player.pos}`
  }
  return null
}

// El jugador pasa a otro club, que suelta a su peor jugador de esa posición si le sobra gente
export function sellPlayer(league: LeagueState, playerId: string, teamId: number): LeagueState {
  const player = getUserSquad(league).find((p) => p.id === playerId)
  if (!player) return league

  let next = replaceTeam(league, USER_ID, (t) =>
    withSquad(
      t,
      t.squad.filter((p) => p.id !== playerId),
    ),
  )
  next = replaceTeam(next, teamId, (t) => {
    const list = [...t.squad, { ...player, starter: false, starts: 0 }]
    while (list.length > MAX_SQUAD) {
      const worst = list
        .filter((p) => p.id !== player.id && list.filter((q) => q.pos === p.pos).length > SQUAD_TEMPLATE[p.pos])
        .sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id))[0]
      if (!worst) break
      list.splice(list.indexOf(worst), 1)
    }
    return withSquad(t, list)
  })
  return next
}

// Qué club se queda con tu jugador en una venta directa (siempre el mismo para la misma parada)
export function quickBuyer(game: GameState, playerId: string): SimTeam {
  const all = rivals(game.league)
  const rng = createRng(mixSeed(game.seed, game.season, game.round, hash(playerId)))
  return pickOne(all, rng).team
}

/* ---------- Ofertas recibidas ---------- */
// Al llegar a una parada con mercado abierto, otros clubes ofrecen por algunos de tus jugadores
export function buildOffers(game: GameState, rng: Rng): MarketOffer[] {
  if (!marketOpen(game)) return []
  const squad = getUserSquad(game.league)
  const others = rivals(game.league)
  if (others.length === 0 || squad.length === 0) return []

  // Los mejores jugadores atraen más ofertas
  const candidates = shuffle([...squad].sort((a, b) => b.rating - a.rating).slice(0, 12), rng).slice(0, MAX_OFFERS)
  const offers: MarketOffer[] = []
  for (const p of candidates) {
    if (rng() < 0.25) continue
    const { team } = pickOne(others, rng)
    const factor = 0.95 + rng() * 0.4
    offers.push({
      id: `${game.season}-${game.baseStop}-${p.id}`,
      playerId: p.id,
      teamId: team.id,
      teamName: team.name,
      amount: roundK(marketValue(p) * factor),
    })
  }
  return offers
}

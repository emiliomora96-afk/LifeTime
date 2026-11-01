import type { NatPool } from './nations'
import { poolsForNat } from './nations'
import { DEFAULT_LEAGUE, leagueDef } from './leagues'
import type { LeagueDef, LeagueId } from './leagues'

/* ==========================================================================
   La liga de la partida en curso.
   El juego tiene una sola partida abierta a la vez, así que la liga elegida se guarda aquí
   y el resto del código la consulta (nacionalidades de los jugadores, nombres de copas, textos).
   Se fija al crear la partida y al cargarla o importarla (game.ts). Por defecto: España.
   ========================================================================== */
let current: LeagueId = DEFAULT_LEAGUE

export function setActiveLeague(id: LeagueId): void {
  current = id
}

export function activeLeagueId(): LeagueId {
  return current
}

export function activeLeague(): LeagueDef {
  return leagueDef(current)
}

// Nacionalidades de la liga activa
export function homePool(): NatPool {
  return poolsForNat(activeLeague().nat).home
}
export function academyPool(): NatPool {
  return poolsForNat(activeLeague().nat).academy
}
export function giantPool(): NatPool {
  return poolsForNat(activeLeague().nat).giant
}

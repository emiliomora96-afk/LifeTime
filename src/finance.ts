import { INVESTMENTS } from './config'
import type { InvestArea } from './config'
import { ROUNDS, getUserSquad, userPosition } from './engine'
import type { GameState } from './game'
import { playerSalary } from './players'
import { cupIncome } from './domestic'
import { europeIncome } from './euroIncome'
import {
  LEAGUE_TITLE_PRIZE,
  OTHER_INCOME,
  POSITION_PRIZE_STEP,
  STAFF_COST_BY_DIVISION,
  SPONSOR_BASE,
  SPONSOR_PER_PRESTIGE,
  TICKETS_BASE,
  TICKETS_PER_STADIUM_LEVEL,
  TV_RIGHTS,
} from './economy'

export interface Line {
  label: string
  amount: number
}

// Ingresos de la temporada. El premio por posición usa la posición actual (la final, al cerrar).
export function seasonIncome(game: GameState): Line[] {
  const level = game.league.userDivision
  const position = userPosition(game.league)
  const finished = game.league.divisions[level].played >= ROUNDS

  const lines: Line[] = [
    { label: 'Entradas', amount: TICKETS_BASE[level] + TICKETS_PER_STADIUM_LEVEL[level] * game.investments.stadium },
    { label: 'Patrocinios', amount: SPONSOR_BASE[level] + SPONSOR_PER_PRESTIGE * game.prestige },
    { label: 'Derechos de TV', amount: TV_RIGHTS[level] },
    { label: 'Premio por posición', amount: Math.max(0, 21 - position) * POSITION_PRIZE_STEP[level] },
    { label: 'Otros', amount: OTHER_INCOME[level] },
  ]
  if (finished && position === 1) {
    lines.push({ label: 'Premio por título de liga', amount: LEAGUE_TITLE_PRIZE[level] })
  }
  // Copa del Rey y Supercopa: se simulan al llegar al cierre, así que solo hay premios desde entonces
  if (game.domestic && game.domestic.season === game.season) {
    lines.push(...cupIncome(game.domestic, level))
  }
  // Europa: lo que ya se jugó (clasificación y fase de liga al cierre; el resto, al terminar el torneo europeo)
  lines.push(...europeIncome(game).map(({ label, amount }) => ({ label, amount })))
  return lines
}

export function seasonExpenses(game: GameState): Line[] {
  const level = game.league.userDivision
  const areas = Object.keys(INVESTMENTS) as InvestArea[]
  return [
    { label: 'Salarios de jugadores', amount: getUserSquad(game.league).reduce((sum, p) => sum + playerSalary(p), 0) },
    { label: 'Personal del club', amount: STAFF_COST_BY_DIVISION[level] },
    ...areas.map((a) => ({
      label: INVESTMENTS[a].label,
      amount: INVESTMENTS[a].costs[game.investments[a]],
    })),
  ]
}

export function total(lines: Line[]): number {
  return lines.reduce((sum, l) => sum + l.amount, 0)
}

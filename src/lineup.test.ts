import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { createPlayer } from './players'
import { FORMATION_COUNT, pickStarters, squadStrength } from './squads'
import type { Position } from './sample'
import {
  addUserPlayer,
  createLeague,
  finishSeason,
  getUserSquad,
  getUserTeam,
  removeUserPlayer,
  setUserAutoLineup,
  swapUserStarters,
} from './engine'

const POSITIONS: Position[] = ['POR', 'DEF', 'MED', 'DEL']

function shapeOk(league: ReturnType<typeof createLeague>): boolean {
  const squad = getUserSquad(league)
  return (
    squad.filter((p) => p.starter).length === 11 &&
    POSITIONS.every((pos) => squad.filter((p) => p.starter && p.pos === pos).length === FORMATION_COUNT[pos])
  )
}

// El mejor defensa titular y el mejor defensa suplente
function bestDefenders(league: ReturnType<typeof createLeague>) {
  const defenders = getUserSquad(league).filter((p) => p.pos === 'DEF')
  const starter = defenders.filter((p) => p.starter).sort((a, b) => b.rating - a.rating)[0]
  const sub = defenders.filter((p) => !p.starter).sort((a, b) => b.rating - a.rating)[0]
  return { starter, sub }
}

describe('alineación manual', () => {
  it('cambiar un suplente por un titular de la misma posición los intercambia y el once sigue siendo 4-3-3', () => {
    const league = createLeague(31)
    const { starter, sub } = bestDefenders(league)
    const next = swapUserStarters(league, starter.id, sub.id)
    const squad = getUserSquad(next)

    expect(squad.find((p) => p.id === starter.id)?.starter).toBe(false)
    expect(squad.find((p) => p.id === sub.id)?.starter).toBe(true)
    expect(shapeOk(next)).toBe(true)
    expect(getUserTeam(next)?.autoLineup).toBe(false)
    // el once es más débil y el nivel del equipo se recalcula
    expect(getUserTeam(next)?.strength).toBe(squadStrength(squad))
    expect(squadStrength(squad)).toBeLessThan(squadStrength(getUserSquad(league)))
  })

  it('no deja intercambiar jugadores de distinta posición ni a dos titulares', () => {
    const league = createLeague(32)
    const squad = getUserSquad(league)
    const defender = squad.find((p) => p.pos === 'DEF' && p.starter)
    const midSub = squad.find((p) => p.pos === 'MED' && !p.starter)
    const otherDefender = squad.find((p) => p.pos === 'DEF' && p.starter && p.id !== defender?.id)
    if (!defender || !midSub || !otherDefender) throw new Error('faltan jugadores de prueba')

    expect(swapUserStarters(league, defender.id, midSub.id) === league).toBe(true)
    expect(swapUserStarters(league, defender.id, otherDefender.id) === league).toBe(true)
    expect(swapUserStarters(league, defender.id, 'no-existe') === league).toBe(true)
  })

  it('con el once elegido por el jugador, un fichaje nuevo empieza de suplente', () => {
    const rng = createRng(33)
    let league = createLeague(33)
    const { starter, sub } = bestDefenders(league)
    league = swapUserStarters(league, starter.id, sub.id)
    const before = getUserTeam(league)?.strength

    const star = createPlayer({ id: 'u-star', name: 'Estrella', pos: 'DEL', age: 27, peak: 95, starter: false }, rng)
    league = addUserPlayer(league, star)

    expect(getUserSquad(league).find((p) => p.id === 'u-star')?.starter).toBe(false)
    expect(getUserTeam(league)?.strength).toBe(before)
    expect(shapeOk(league)).toBe(true)
  })

  it('si se vende a un titular de una alineación manual, entra el mejor suplente de su posición', () => {
    let league = createLeague(34)
    const { starter, sub } = bestDefenders(league)
    league = swapUserStarters(league, starter.id, sub.id) // ahora starter está de suplente
    const toSell = getUserSquad(league).filter((p) => p.pos === 'DEF' && p.starter)[0]

    league = removeUserPlayer(league, toSell.id)
    expect(getUserSquad(league).some((p) => p.id === toSell.id)).toBe(false)
    expect(shapeOk(league)).toBe(true)
    expect(getUserTeam(league)?.autoLineup).toBe(false)
  })

  it('la alineación manual se respeta al cerrar la temporada', () => {
    let league = createLeague(35)
    const { starter, sub } = bestDefenders(league)
    league = swapUserStarters(league, starter.id, sub.id)

    const next = finishSeason(league, 77, { academyBonus: 0, leaving: [] })
    const squad = getUserSquad(next)
    expect(getUserTeam(next)?.autoLineup).toBe(false)
    expect(shapeOk(next)).toBe(true)
    // el suplente que subió a titular sigue en el once (es joven y no se retira)
    expect(squad.find((p) => p.id === sub.id)?.starter).toBe(true)
  })

  it('volver al automático elige el mejor once posible', () => {
    let league = createLeague(36)
    const { starter, sub } = bestDefenders(league)
    league = swapUserStarters(league, starter.id, sub.id)
    league = setUserAutoLineup(league)
    const squad = getUserSquad(league)

    expect(getUserTeam(league)?.autoLineup).toBe(true)
    expect(squadStrength(squad)).toBe(squadStrength(pickStarters(squad)))
    expect(shapeOk(league)).toBe(true)
    expect(squad.find((p) => p.id === starter.id)?.starter).toBe(true)
  })
})

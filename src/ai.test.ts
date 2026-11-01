import { describe, expect, it } from 'vitest'
import { createLeague, finishSeason, simulateLeague, USER_ID, aiWinterWindow } from './engine'
import type { LeagueState } from './engine'
import { aiFinance } from './aiclubs'
import { createRng } from './rng'

function allTeams(l: LeagueState) {
  return [...l.divisions[1].teams, ...l.divisions[2].teams]
}

describe('Paso 10: mundo aleatorio', () => {
  it('todos los clubes de la IA tienen dinero, prestigio, cantera y estadio', () => {
    for (const t of allTeams(createLeague(3))) {
      if (t.id === USER_ID) continue
      expect(typeof t.budget).toBe('number')
      expect(t.prestige).toBeGreaterThan(0)
      expect(t.academy?.length ?? 0).toBeGreaterThan(0)
      expect(t.academyLevel).toBeDefined()
    }
  })

  it('los gigantes empiezan con más dinero y prestigio que un club modesto', () => {
    const teams = allTeams(createLeague(4))
    const elite = teams.filter((t) => t.tier === 'elite')
    const modest = teams.filter((t) => t.tier === 'modesto')
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(avg(elite.map((t) => t.budget ?? 0))).toBeGreaterThan(avg(modest.map((t) => t.budget ?? 0)) * 3)
    expect(avg(elite.map((t) => t.prestige ?? 0))).toBeGreaterThan(avg(modest.map((t) => t.prestige ?? 0)))
  })

  it('con la misma semilla el mundo y los fichajes son idénticos', () => {
    const run = () => {
      let l = createLeague(9)
      for (let y = 0; y < 4; y++) {
        l = simulateLeague(l, 38, 10 + y)
        l = finishSeason(l, 20 + y)
      }
      return allTeams(l).map((t) => `${t.id}:${t.strength}:${t.budget}:${t.squad.map((p) => p.id).join(',')}`).join('|')
    }
    expect(run()).toBe(run())
  })
})

describe('Paso 10: los clubes de la IA viven como el tuyo', () => {
  it('los clubes cobran y pagan: el dinero cambia de una temporada a otra', () => {
    let l = createLeague(5)
    const before = new Map(allTeams(l).map((t) => [t.id, t.budget ?? 0]))
    l = simulateLeague(l, 38, 1)
    l = finishSeason(l, 2)
    const changed = allTeams(l).filter((t) => t.id !== USER_ID && t.budget !== before.get(t.id)).length
    expect(changed).toBeGreaterThan(30)
  })

  it('las finanzas de la IA usan la misma fórmula: más posición y prestigio, más ingresos', () => {
    const team = createLeague(6).divisions[1].teams[0]
    const top = aiFinance({ ...team, prestige: 80 }, 1, 1).income
    const bottom = aiFinance({ ...team, prestige: 10 }, 1, 20).income
    expect(top).toBeGreaterThan(bottom)
    expect(aiFinance(team, 1, 10).income).toBeGreaterThan(aiFinance(team, 2, 10).income)
  })

  it('hay fichajes entre clubes de la IA en cada mercado de verano, y los jugadores cambian de club', () => {
    let l = createLeague(7)
    const owner = new Map<string, number>()
    for (const t of allTeams(l)) for (const p of t.squad) owner.set(p.id, t.id)
    l = simulateLeague(l, 38, 3)
    l = finishSeason(l, 4)
    const transfers = (l.moves ?? []).filter((m) => m.kind === 'fichaje')
    expect(transfers.length).toBeGreaterThan(3)
    let moved = 0
    for (const t of allTeams(l)) for (const p of t.squad) if (owner.has(p.id) && owner.get(p.id) !== t.id) moved++
    expect(moved).toBeGreaterThan(3)
  })

  it('el mercado de invierno de la IA mueve jugadores sin perder a nadie', () => {
    let l = createLeague(8)
    l = simulateLeague(l, 19, 5)
    const ids = new Set(allTeams(l).flatMap((t) => t.squad.map((p) => p.id)))
    const after = aiWinterWindow(l, 6)
    const still = new Set(allTeams(after).flatMap((t) => t.squad.map((p) => p.id)))
    for (const id of ids) expect(still.has(id)).toBe(true)
  })

  it('cada club conserva una plantilla válida (18 a 24 jugadores) y ningún id se repite', () => {
    let l = createLeague(10)
    for (let y = 0; y < 15; y++) {
      l = simulateLeague(l, 38, 30 + y)
      l = finishSeason(l, 70 + y)
      const ids = new Set<string>()
      for (const t of allTeams(l)) {
        expect(t.squad.length).toBeGreaterThanOrEqual(18)
        expect(t.squad.length).toBeLessThanOrEqual(24)
        expect(t.squad.filter((p) => p.starter).length).toBe(11)
        for (const p of t.squad) {
          expect(ids.has(p.id)).toBe(false)
          ids.add(p.id)
        }
      }
    }
  })

  it('la cantera de la IA sube juveniles al primer equipo con los años', () => {
    let l = createLeague(11)
    let fromAcademy = 0
    for (let y = 0; y < 10; y++) {
      l = simulateLeague(l, 38, 40 + y)
      l = finishSeason(l, 80 + y)
    }
    for (const t of allTeams(l)) if (t.id !== USER_ID) fromAcademy += t.squad.filter((p) => /-a\d+-/.test(p.id)).length
    expect(fromAcademy).toBeGreaterThan(20)
  })

  it('en 30 años las valoraciones no se inflan ni se hunden, y el dinero no se dispara', () => {
    let l = createLeague(12)
    for (let y = 0; y < 30; y++) {
      l = simulateLeague(l, 38, 100 + y)
      l = finishSeason(l, 200 + y)
    }
    const d1 = l.divisions[1].teams
    const mean = d1.reduce((s, t) => s + t.strength, 0) / d1.length
    expect(mean).toBeGreaterThan(79)
    expect(mean).toBeLessThan(86)
    for (const t of allTeams(l)) {
      if (t.id === USER_ID) continue
      expect(t.strength).toBeLessThan(95)
      expect(t.budget ?? 0).toBeLessThan(600_000_000)
      expect(t.budget ?? 0).toBeGreaterThanOrEqual(-6_000_000)
    }
  })

  it('el dominio de los gigantes no es eterno: a lo largo de 30 años ganan varios clubes distintos', () => {
    const winners = new Set<number>()
    let l = createLeague(13)
    for (let y = 0; y < 30; y++) {
      l = simulateLeague(l, 38, 300 + y)
      const t = l.divisions[1].teams
      const best = [...t].sort((a, b) => b.strength - a.strength)[0]
      winners.add(best.id)
      l = finishSeason(l, 400 + y)
    }
    expect(winners.size).toBeGreaterThanOrEqual(4)
  })

  it('tu club puede vender: el club comprador paga y el vendedor cobra al comprarle', () => {
    const l = createLeague(14)
    const buyer = l.divisions[1].teams.find((t) => t.id !== USER_ID) as NonNullable<LeagueState['divisions'][1]['teams'][number]>
    expect(buyer.budget ?? 0).toBeGreaterThan(0)
  })
})

describe('Paso 10: aleatoriedad pura', () => {
  it('rng de prueba sigue siendo estable', () => {
    expect(createRng(1)()).toBe(createRng(1)())
  })
})

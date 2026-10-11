import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { DIV1_CLUBS, DIV2_CLUBS } from './clubs'
import { NATIONS, NAT_IDS, SPAIN_POOL, randomIdentity } from './nations'
import { computeTable, createLeague, finishSeason, simulateLeague, TEAMS_PER_DIVISION } from './engine'
import { nameParts, newSigning, newYouth } from './players'
import { FORMATION_COUNT } from './squads'

describe('nacionalidades', () => {
  it('cada país tiene nombres y apellidos suficientes y sin repetir', () => {
    for (const id of NAT_IDS) {
      const n = NATIONS[id]
      expect(n.first.length).toBeGreaterThanOrEqual(10)
      expect(n.last.length).toBeGreaterThanOrEqual(10)
      expect(new Set(n.first).size).toBe(n.first.length)
      expect(new Set(n.last).size).toBe(n.last.length)
    }
  })

  it('en la liga española la mayoría es española y hay mucha variedad', () => {
    const rng = createRng(5)
    const count: Record<string, number> = {}
    for (let i = 0; i < 4000; i++) {
      const who = randomIdentity(rng, SPAIN_POOL)
      count[who.nat] = (count[who.nat] ?? 0) + 1
      expect(who.name).toBe(`${who.first} ${who.last}`)
    }
    expect(count.ESP / 4000).toBeGreaterThan(0.5)
    expect(count.ESP / 4000).toBeLessThan(0.7)
    for (const nat of ['ARG', 'BRA', 'FRA', 'POR', 'ING', 'ITA', 'ALE', 'COL', 'MEX']) expect(count[nat]).toBeGreaterThan(20)
  })

  it('la cantera propia es casi toda española; los fichajes, más variados', () => {
    const rng = createRng(6)
    let youthEsp = 0
    let signEsp = 0
    for (let i = 0; i < 600; i++) {
      if (newYouth(`y${i}`, 'MED', 70, 0, rng).nat === 'ESP') youthEsp++
      if (newSigning(`s${i}`, 'MED', 70, rng).nat === 'ESP') signEsp++
    }
    expect(youthEsp).toBeGreaterThan(signEsp)
    expect(youthEsp / 600).toBeGreaterThan(0.7)
  })

  it('nameParts separa nombre y apellido también en jugadores antiguos', () => {
    expect(nameParts({ name: 'Hugo Lasarte' })).toEqual({ first: 'Hugo', last: 'Lasarte' })
    expect(nameParts({ name: 'Daan De Vries' })).toEqual({ first: 'Daan', last: 'De Vries' })
    expect(nameParts({ name: 'x', first: 'A', last: 'B' })).toEqual({ first: 'A', last: 'B' })
  })
})

describe('clubes de España', () => {
  it('hay 7 gigantes con un once completo 4-3-3 hecho a mano', () => {
    const giants = DIV1_CLUBS.filter((c) => c.core)
    expect(giants).toHaveLength(7)
    for (const g of giants) {
      expect(g.core).toHaveLength(11)
      for (const pos of ['POR', 'DEF', 'MED', 'DEL'] as const) {
        expect(g.core?.filter((p) => p.pos === pos).length).toBe(FORMATION_COUNT[pos])
      }
    }
  })

  it('1.ª tiene 20 clubes y 2.ª tiene 19 (el club del jugador es el 20), sin nombres repetidos', () => {
    expect(DIV1_CLUBS).toHaveLength(20)
    expect(DIV2_CLUBS).toHaveLength(19)
    const names = [...DIV1_CLUBS, ...DIV2_CLUBS].map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
    for (const c of [...DIV1_CLUBS, ...DIV2_CLUBS]) {
      expect(c.city.length).toBeGreaterThan(0)
      expect(c.colors[0]).toMatch(/^#[0-9a-f]{6}$/)
      expect(c.colors[1]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('la liga creada trae gigantes arriba, ciudad y colores, y todos los jugadores con nacionalidad', () => {
    const league = createLeague(11)
    const first = league.divisions[1].teams
    const second = league.divisions[2].teams
    expect(first).toHaveLength(TEAMS_PER_DIVISION)
    expect(second).toHaveLength(TEAMS_PER_DIVISION)

    const best = [...first].sort((a, b) => b.strength - a.strength)[0]
    expect(best.tier).toBe('elite')
    expect(first.filter((t) => t.tier === 'elite' || t.tier === 'grande')).toHaveLength(7)

    const ids = new Set<string>()
    for (const t of [...first, ...second]) {
      if (t.id !== 0) {
        expect(t.city).toBeTruthy()
        expect(t.colors).toHaveLength(2)
      }
      expect(t.squad.length).toBeGreaterThanOrEqual(18)
      for (const p of t.squad) {
        if (t.id !== 0) expect(p.nat).toBeTruthy()
        expect(p.first && p.last).toBeTruthy()
        expect(ids.has(p.id + t.id)).toBe(false)
        ids.add(p.id + t.id)
      }
    }
  })

  it('en promedio, cada nivel de club es más fuerte que el siguiente', () => {
    const order = ['elite', 'grande', 'aspirante', 'media', 'modesto', 'ascendido']
    const sums: Record<string, number[]> = {}
    for (let seed = 1; seed <= 5; seed++) {
      for (const t of createLeague(seed).divisions[1].teams) (sums[t.tier ?? '?'] ??= []).push(t.strength)
    }
    const avg = order.map((k) => sums[k].reduce((a, b) => a + b, 0) / sums[k].length)
    for (let i = 1; i < avg.length; i++) expect(avg[i - 1]).toBeGreaterThan(avg[i])
  })

  it('los gigantes ganan más títulos, pero no siempre', () => {
    let elite = 0
    let other = 0
    let seasons = 0
    for (let seed = 1; seed <= 6; seed++) {
      let league = createLeague(seed)
      for (let y = 0; y < 12; y++) {
        league = simulateLeague(league, 38, seed * 100 + y)
        const table = computeTable(league.divisions[1])
        const champ = league.divisions[1].teams.find((t) => t.id === table[0].id)
        if (champ?.tier === 'elite') elite++
        else other++
        seasons++
        league = finishSeason(league, seed * 1000 + y)
      }
    }
    expect(elite / seasons).toBeGreaterThan(0.45) // 3 de 20 clubes ganarían ~15% si todo fuera igual
    expect(other).toBeGreaterThan(seasons * 0.1) // y los demás también ganan
  })

  it('un gigante que desciende sigue siendo fuerte y puede volver', () => {
    let league = createLeague(21)
    for (let y = 0; y < 20; y++) {
      league = simulateLeague(league, 38, 50 + y)
      league = finishSeason(league, 90 + y)
    }
    const all = [...league.divisions[1].teams, ...league.divisions[2].teams]
    const giants = all.filter((t) => t.anchor !== undefined)
    expect(giants).toHaveLength(7)
    for (const g of giants) expect(g.strength).toBeGreaterThan(70)
  })
})

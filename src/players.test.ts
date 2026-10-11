import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import {
  createPlayer,
  generateScoutTarget,
  marketValue,
  newYouth,
  playerSalary,
  potentialLabel,
  potentialRange,
  progressPlayer,
  retireChance,
} from './players'
import type { SimPlayer } from './players'
import type { Position } from './sample'
import { FORMATION_COUNT, placeholderSquad, squadStrength, userSquad } from './squads'
import { addUserPlayer, createLeague, finishSeason, getUserSquad, removeUserPlayer } from './engine'

const N = 300

// Carrera completa de N jugadores titulares fijos con pico 88 que empiezan a los 17 años
function careers(pos: Position, seed: number) {
  const rng = createRng(seed)
  const rating: Record<number, number[]> = {}
  const width: Record<number, number[]> = {}
  let inside = 0
  let checked = 0
  let oldest = 0
  let lowestLo = 0

  for (let i = 0; i < N; i++) {
    let p: SimPlayer = createPlayer({ id: 'x', name: 'x', pos, age: 17, peak: 88, starter: false }, rng)
    for (let age = 17; age <= 45; age++) {
      ;(rating[age] ??= []).push(p.rating)
      const [lo, hi] = potentialRange(p)
      ;(width[age] ??= []).push(hi - lo)
      if (lo < p.rating) lowestLo++
      if (p.age <= 25) {
        checked++
        if (lo <= 88 && 88 <= hi) inside++
      }
      oldest = Math.max(oldest, p.age)
      if (rng() < retireChance(p.age, p.pos)) break
      p = progressPlayer({ ...p, starts: 38 }, rng) // titular fijo: sigue la curva normal
    }
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  return { avg: (age: number) => avg(rating[age]), width: (age: number) => avg(width[age]), inside: inside / checked, oldest, lowestLo }
}

describe('curva de edad', () => {
  const fw = careers('DEL', 1)
  const gk = careers('POR', 2)

  it('crece de los 17 a los 27 hasta llegar cerca de su pico', () => {
    expect(fw.avg(17)).toBeLessThan(66)
    expect(fw.avg(22)).toBeGreaterThan(fw.avg(17) + 10)
    expect(fw.avg(27)).toBeGreaterThan(85.5)
    expect(fw.avg(27)).toBeLessThan(89)
  })

  it('se mantiene en su pico entre los 27 y los 30', () => {
    expect(Math.abs(fw.avg(30) - fw.avg(27))).toBeLessThan(2)
  })

  it('baja desde los 31 y claramente desde los 35', () => {
    expect(fw.avg(31)).toBeLessThan(fw.avg(30) + 0.01)
    expect(fw.avg(35)).toBeLessThan(fw.avg(30) - 5)
    expect(fw.avg(37)).toBeLessThan(fw.avg(35) - 4)
  })

  it('los porteros maduran y envejecen más tarde', () => {
    expect(gk.avg(27)).toBeLessThan(fw.avg(27) - 1)
    expect(gk.avg(35)).toBeGreaterThan(fw.avg(35) + 3)
  })

  it('todos se retiran antes de los 44 años', () => {
    expect(fw.oldest).toBeLessThan(44)
    expect(gk.oldest).toBeLessThan(44)
  })
})

describe('potencial visible', () => {
  const fw = careers('DEL', 3)

  it('a los 17 años el rango mide entre 18 y 28 puntos', () => {
    expect(fw.width(17)).toBeGreaterThan(18)
    expect(fw.width(17)).toBeLessThan(28)
  })

  it('el rango se va cerrando con la edad y desaparece a los 27', () => {
    expect(fw.width(18)).toBeGreaterThan(fw.width(22))
    expect(fw.width(22)).toBeGreaterThan(fw.width(25))
    expect(fw.width(27)).toBe(0)
    expect(fw.width(33)).toBe(0)
  })

  it('el pico real casi siempre queda dentro del rango', () => {
    expect(fw.inside).toBeGreaterThan(0.97)
  })

  it('el mínimo del rango nunca es menor que la valoración actual', () => {
    expect(fw.lowestLo).toBe(0)
  })

  it('un jugador en su pico muestra un solo número, un juvenil muestra un rango', () => {
    const rng = createRng(4)
    const vet = createPlayer({ id: 'v', name: 'v', pos: 'MED', age: 30, peak: 80, starter: false }, rng)
    const kid = createPlayer({ id: 'k', name: 'k', pos: 'MED', age: 17, peak: 85, starter: false }, rng)
    expect(potentialLabel(vet).includes('–')).toBe(false)
    expect(potentialLabel(kid).includes('–')).toBe(true)
  })
})

describe('cazatalentos', () => {
  it('respeta el filtro de posición, edad, valoración y potencial', () => {
    const rng = createRng(5)
    let found = 0
    for (let i = 0; i < 200; i++) {
      const t = generateScoutTarget({ pos: 'DEF', minRating: 68, minPotential: 78, ageMin: 19, ageMax: 24 }, 's', rng)
      if (!t) continue
      found++
      expect(t.pos).toBe('DEF')
      expect(t.age).toBeGreaterThanOrEqual(19)
      expect(t.age).toBeLessThanOrEqual(24)
      expect(t.rating).toBeGreaterThanOrEqual(68)
      expect(potentialRange(t)[1]).toBeGreaterThanOrEqual(78)
    }
    expect(found).toBeGreaterThan(150)
  })

  it('encuentra veteranos cuando se piden veteranos', () => {
    const rng = createRng(6)
    const t = generateScoutTarget({ pos: 'MED', minRating: 75, minPotential: 75, ageMin: 32, ageMax: 36 }, 's', rng)
    expect(t === null).toBe(false)
    expect(t?.age).toBeGreaterThanOrEqual(32)
  })

  it('no devuelve nada si lo que se pide es imposible', () => {
    const rng = createRng(7)
    for (let i = 0; i < 50; i++) {
      expect(generateScoutTarget({ pos: 'DEL', minRating: 95, minPotential: 99, ageMin: 16, ageMax: 17 }, 's', rng) === null).toBe(true)
    }
  })
})

describe('plantillas', () => {
  it('una plantilla generada tiene el once 4-3-3 y el nivel de su club', () => {
    const rng = createRng(8)
    for (const level of [62, 70, 78]) {
      const squad = placeholderSquad(1, level, rng)
      expect(squad.filter((p) => p.starter).length).toBe(11)
      for (const pos of ['POR', 'DEF', 'MED', 'DEL'] as Position[]) {
        expect(squad.filter((p) => p.starter && p.pos === pos).length).toBe(FORMATION_COUNT[pos])
      }
      expect(Math.abs(squadStrength(squad) - level)).toBeLessThan(1.1)
    }
  })

  it('la plantilla del jugador tiene 18 jugadores con edad y potencial', () => {
    const squad = userSquad(createRng(9))
    expect(squad.length).toBe(18)
    expect(squadStrength(squad)).toBe(69.5)
    for (const p of squad) {
      expect(p.age).toBeGreaterThan(15)
      expect(p.peak).toBeGreaterThanOrEqual(p.rating)
    }
  })

  it('una cantera mejor da juveniles con más potencial', () => {
    const rng = createRng(10)
    let good = 0
    let poor = 0
    for (let i = 0; i < N; i++) {
      good += newYouth('a', 'MED', 70, 5, rng).peak
      poor += newYouth('b', 'MED', 70, -2.5, rng).peak
    }
    expect(good / N).toBeGreaterThan(poor / N + 5)
  })
})

describe('año a año en el club del jugador', () => {
  it('fichar y vender cambia la plantilla y el nivel del equipo', () => {
    const rng = createRng(11)
    let league = createLeague(21)
    const before = getUserSquad(league)
    const strengthBefore = squadStrength(before)

    const star = createPlayer({ id: 'u-star', name: 'Estrella', pos: 'DEL', age: 27, peak: 95, starter: false }, rng)
    league = addUserPlayer(league, star)
    const withStar = getUserSquad(league)
    expect(withStar.length).toBe(before.length + 1)
    expect(squadStrength(withStar)).toBeGreaterThan(strengthBefore)
    expect(withStar.find((p) => p.id === 'u-star')?.starter).toBe(true)

    league = removeUserPlayer(league, 'u-star')
    expect(getUserSquad(league).length).toBe(before.length)
    expect(squadStrength(getUserSquad(league))).toBe(strengthBefore)
  })

  it('al cerrar la temporada todos envejecen un año y se van los que debían irse', () => {
    const league = createLeague(22)
    const before = getUserSquad(league)
    const leaver = before[0]
    const next = finishSeason(league, 99, { academyBonus: 0, leaving: [leaver.id] })
    const after = getUserSquad(next)

    expect(after.some((p) => p.id === leaver.id)).toBe(false)
    for (const p of after) {
      const old = before.find((q) => q.id === p.id)
      if (old) expect(p.age).toBe(old.age + 1)
    }
  })

  it('en 30 años la plantilla se renueva sin quedarse corta', () => {
    let league = createLeague(23)
    for (let year = 0; year < 30; year++) {
      league = finishSeason(league, 1000 + year, { academyBonus: 0, leaving: [] })
      const squad = getUserSquad(league)
      expect(squad.length).toBeGreaterThanOrEqual(18)
      expect(squad.filter((p) => p.starter).length).toBe(11)
      expect(new Set(squad.map((p) => p.id)).size).toBe(squad.length)
    }
  })
})

describe('dinero de los jugadores', () => {
  const rng = createRng(12)
  const make = (age: number, peak: number, pos: Position = 'MED') =>
    createPlayer({ id: 'm', name: 'm', pos, age, peak, starter: false }, rng)

  it('el sueldo y el precio suben con la valoración', () => {
    const low = make(28, 62)
    const high = make(28, 82)
    expect(playerSalary(high)).toBeGreaterThan(playerSalary(low))
    expect(marketValue(high)).toBeGreaterThan(marketValue(low))
  })

  it('un juvenil con mucho potencial vale mucho más que uno con poco', () => {
    const star = make(18, 95)
    const normal = make(18, 70)
    expect(marketValue(star)).toBeGreaterThan(marketValue(normal) * 2)
  })

  it('un veterano vale menos que un jugador igual de bueno en su pico', () => {
    const prime = make(28, 80)
    const old = make(35, 90)
    // el veterano de 35 ya bajó: su valoración actual es parecida, pero vale bastante menos
    expect(marketValue(old)).toBeLessThan(marketValue(prime))
  })

  it('la nómina inicial del club ronda entre 1,4 y 1,9 millones', () => {
    const payroll = userSquad(createRng(13)).reduce((sum, p) => sum + playerSalary(p), 0)
    expect(payroll).toBeGreaterThan(1_400_000)
    expect(payroll).toBeLessThan(1_900_000)
  })

  it('si un jugador se va, la nómina baja', () => {
    const squad = userSquad(createRng(14))
    const full = squad.reduce((sum, p) => sum + playerSalary(p), 0)
    const without = squad.slice(1).reduce((sum, p) => sum + playerSalary(p), 0)
    expect(without).toBeLessThan(full)
  })
})

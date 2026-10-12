import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { createPlayer, progressPlayer, rollProdigy } from './players'
import type { SimPlayer } from './players'
import { createLeague, finishSeason, getUserSquad, simulateLeague, swapUserStarters } from './engine'

const N = 400

// Valoración media de N jugadores con pico 88 que empiezan a los 17, según las jornadas que juegan cada año
function career(starts: number, seed: number): (age: number) => number {
  const rng = createRng(seed)
  const byAge: Record<number, number[]> = {}
  for (let i = 0; i < N; i++) {
    let p: SimPlayer = createPlayer({ id: 'x', name: 'x', pos: 'MED', age: 17, peak: 88, starter: false }, rng)
    for (let age = 17; age <= 31; age++) {
      ;(byAge[age] ??= []).push(p.rating)
      p = progressPlayer({ ...p, starts }, rng)
    }
  }
  return (age) => byAge[age].reduce((a, b) => a + b, 0) / byAge[age].length
}

describe('minutos y crecimiento', () => {
  const starter = career(38, 1)
  const half = career(19, 1)
  const bench = career(0, 1)

  it('un titular crece más rápido que un suplente', () => {
    expect(starter(21)).toBeGreaterThan(bench(21) + 2.5)
    expect(starter(23)).toBeGreaterThan(bench(23) + 3.5)
  })

  it('los suplentes no se quedan demasiado atrás', () => {
    expect(starter(23) - bench(23)).toBeLessThan(7) // los de potencial alto que juegan se despegan más
  })

  it('jugar la mitad da un crecimiento intermedio', () => {
    expect(half(21)).toBeGreaterThan(bench(21))
    expect(half(21)).toBeLessThan(starter(21))
  })

  it('el suplente también llega a su potencial, pero más tarde', () => {
    expect(bench(25)).toBeLessThan(starter(25) - 2)
    expect(Math.abs(bench(29) - starter(29))).toBeLessThan(2)
  })
})

describe('minutos en la liga', () => {
  it('los titulares suman jornadas y el contador se reinicia al cerrar la temporada', () => {
    let league = createLeague(41)
    league = simulateLeague(league, 19, 1)
    for (const p of getUserSquad(league)) expect(p.starts ?? 0).toBe(p.starter ? 19 : 0)

    league = simulateLeague(league, 38, 2)
    for (const p of getUserSquad(league)) expect(p.starts ?? 0).toBe(p.starter ? 38 : 0)

    league = finishSeason(league, 3, { academyBonus: 0, leaving: [] })
    for (const p of getUserSquad(league)) expect(p.starts ?? 0).toBe(0)
  })

  it('un joven que juega crece más que el mismo joven en el banco', () => {
    let asStarter = 0
    let onBench = 0
    const SEEDS = 30

    for (let s = 0; s < SEEDS; s++) {
      const base = createLeague(60 + s)
      const squad = getUserSquad(base)
      const youth = squad.find((p) => p.id === 'u-18')
      const rival = squad.filter((p) => p.pos === youth?.pos && p.starter).sort((a, b) => a.rating - b.rating)[0]
      if (!youth || !rival) throw new Error('faltan jugadores de prueba')

      const benched = finishSeason(simulateLeague(base, 38, 500 + s), 900 + s, { academyBonus: 0, leaving: [] })
      const playing = finishSeason(
        simulateLeague(swapUserStarters(base, rival.id, youth.id), 38, 500 + s),
        900 + s,
        { academyBonus: 0, leaving: [] },
      )
      onBench += getUserSquad(benched).find((p) => p.id === 'u-18')?.rating ?? 0
      asStarter += getUserSquad(playing).find((p) => p.id === 'u-18')?.rating ?? 0
    }
    expect(asStarter / SEEDS).toBeGreaterThan(onBench / SEEDS + 0.8)
  })
})

describe('topes de crecimiento por temporada', () => {
  // Mayor subida en una temporada y subida media a los 17-20, para jugadores con pico 88
  function gains(starts: number, prodigy: boolean, seed: number, peak = 88, lastAge = 25) {
    const rng = createRng(seed)
    let max = 0
    const young: number[] = []
    for (let i = 0; i < N; i++) {
      let p: SimPlayer = createPlayer({ id: 'g', name: 'g', pos: 'MED', age: 17, peak, starter: false, prodigy }, rng)
      for (let age = 17; age <= lastAge; age++) {
        const next = progressPlayer({ ...p, starts }, rng)
        max = Math.max(max, next.rating - p.rating)
        if (age <= 20) young.push(next.rating - p.rating)
        p = next
      }
    }
    return { max, avgYoung: young.reduce((a, b) => a + b, 0) / young.length }
  }

  const sub = gains(0, false, 5)
  const starter = gains(38, false, 5)
  const prodigyStarter = gains(38, true, 5)
  const prodigySub = gains(0, true, 5)

  it('un suplente sube como mucho 3 puntos por temporada', () => {
    expect(sub.max).toBeLessThanOrEqual(3)
    expect(sub.avgYoung).toBeGreaterThan(2.3)
  })

  it('un titular con potencial alto sube como mucho 5 puntos por temporada', () => {
    expect(starter.max).toBeLessThanOrEqual(5)
    expect(starter.max).toBeGreaterThanOrEqual(5)
    expect(starter.avgYoung).toBeGreaterThan(3.8)
  })

  it('un titular de potencial medio sigue con tope de 4 puntos', () => {
    const medium = gains(38, false, 5, 80)
    expect(medium.max).toBeLessThanOrEqual(4)
    expect(medium.avgYoung).toBeLessThan(starter.avgYoung)
  })

  it('un suplente nunca sube más de 3 por temporada, tampoco al llegar a su pico (27 a 30 años)', () => {
    expect(gains(0, false, 6, 88, 30).max).toBeLessThanOrEqual(3)
    expect(gains(0, true, 6, 88, 30).max).toBeLessThanOrEqual(3)
  })

  it('un prodigio titular puede subir hasta 6 puntos por temporada, y nunca más', () => {
    expect(prodigyStarter.max).toBeLessThanOrEqual(6)
    expect(prodigyStarter.max).toBeGreaterThanOrEqual(5)
    expect(prodigyStarter.avgYoung).toBeGreaterThan(starter.avgYoung + 0.7)
  })

  it('un prodigio que no juega sube como un suplente normal', () => {
    expect(prodigySub.max).toBeLessThanOrEqual(3)
  })
})

describe('prodigios', () => {
  it('son raros entre los jóvenes de la liga', () => {
    let young = 0
    let prodigies = 0
    for (let s = 0; s < 20; s++) {
      const league = createLeague(700 + s)
      for (const level of [1, 2] as const) {
        for (const team of league.divisions[level].teams) {
          for (const p of team.squad) {
            if (p.age <= 21) {
              young++
              if (p.prodigy) prodigies++
            }
          }
        }
      }
    }
    expect(prodigies / young).toBeGreaterThan(0.01)
    expect(prodigies / young).toBeLessThan(0.07)
  })

  it('todo prodigio tiene un pico de 90 o más, y algunos llegan a 94 o 95', () => {
    const rng = createRng(21)
    const peaks: number[] = []
    for (let i = 0; i < 400; i++) {
      peaks.push(createPlayer({ id: 'p', name: 'p', pos: 'DEL', age: 17, peak: 70, starter: false, prodigy: true }, rng).peak)
    }
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(90)
    expect(Math.max(...peaks)).toBeGreaterThanOrEqual(94)
  })

  it('solo los jóvenes pueden ser prodigios', () => {
    const rng = createRng(8)
    for (let i = 0; i < 400; i++) {
      expect(rollProdigy(22 + (i % 10), 1, rng)).toBe(false)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { BOARD_SIZE, buildBoard, nextMatch, windowAround } from './miniBoardLogic'
import { createLeague, simulateLeague } from './engine'
import { auraOf, AURA_TIERS } from './aura'

describe('windowAround', () => {
  it('centra el club con 1 arriba y 1 abajo', () => {
    expect(windowAround(20, 10)).toEqual([9, 12])
  })
  it('cerca del primero o del último sigue mostrando 3 filas', () => {
    expect(windowAround(20, 0)).toEqual([0, 3])
    expect(windowAround(20, 1)).toEqual([0, 3])
    expect(windowAround(20, 19)).toEqual([17, 20])
    expect(windowAround(20, 18)).toEqual([17, 20])
  })
  it('con pocos equipos muestra todos', () => {
    expect(windowAround(5, 2)).toEqual([0, 5])
  })
})

describe('buildBoard', () => {
  const club = { name: 'Mi Club', primaryColor: '#111', secondaryColor: '#eee' }
  it('siempre 3 filas, con el club incluido y flechas coherentes', () => {
    let league = createLeague(7)
    for (const r of [0, 1, 5, 12, 38]) {
      league = simulateLeague(league, r, 7)
      const b = buildBoard(league, club)
      expect(b.rows).toHaveLength(BOARD_SIZE)
      expect(b.rows.filter((x) => x.isMe)).toHaveLength(1)
      const pos = b.rows.map((x) => x.pos)
      expect(pos).toEqual([...pos].sort((a, c) => a - c))
    }
  })
  it('sin jornada anterior no hay flechas', () => {
    const b = buildBoard(simulateLeague(createLeague(3), 1, 3), club)
    expect(b.rows.every((x) => x.move === 0)).toBe(true)
  })
  it('próximo partido', () => {
    const l = simulateLeague(createLeague(3), 4, 3)
    expect(nextMatch(l)?.round).toBe(5)
    expect(nextMatch(simulateLeague(l, 38, 3))).toBeNull()
  })
})

describe('aura por Val', () => {
  it('7 tramos', () => {
    const t = (v: number) => auraOf(v).tier
    expect([64, 65, 74, 75, 79, 80, 84, 85, 89, 90, 94, 95].map(t)).toEqual([
      'none', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'amethyst', 'amethyst', 'fire', 'fire', 'storm',
    ])
    expect(AURA_TIERS.filter((x) => x.animated).map((x) => x.min)).toEqual([95, 90])
  })
})

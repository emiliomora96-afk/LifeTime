import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { newCanterano, progressPlayer, marketValue, playerSalary } from './players'
import type { SimPlayer } from './players'
import { ACADEMY_TIERS, CANTERANO_EVENTS, DECLINE, VAL_LIMITS, VAL_TARGETS } from './lifetimeConfig'
import { runLifetimeSim } from './lifetimeSim'

const N = 6000
function sample(level: number, seed: number): SimPlayer[] {
  const rng = createRng(seed)
  return Array.from({ length: N }, (_, i) => newCanterano(`c${i}`, 'MED', level, rng))
}
const share = (xs: SimPlayer[], f: (p: SimPlayer) => boolean) => xs.filter(f).length / xs.length

describe('cantera por inversión', () => {
  it('los niveles se solapan y respetan sus rangos', () => {
    for (let level = 1; level <= 3; level++) {
      const t = ACADEMY_TIERS[level]
      const xs = sample(level, level)
      const mean = xs.reduce((s, p) => s + (p.pot ?? 0), 0) / N
      expect(Math.abs(mean - t.mean)).toBeLessThan(2.5) // los eventos raros bajan un poco la media
      for (const p of xs) {
        expect(p.pot!).toBeLessThanOrEqual(Math.max(t.max, t.gemCap)) // la joya puede pasar el rango hasta su tope
        expect(p.pot!).toBeGreaterThanOrEqual(Math.min(t.min, t.min - CANTERANO_EVENTS.failDrop[1]) - 1)
      }
    }
    const basic = sample(1, 1)
    const max = sample(3, 3)
    expect(share(basic, (p) => p.pot! >= 85)).toBeGreaterThan(0)
    expect(share(max, (p) => p.pot! < 85)).toBeGreaterThan(0.1) // invertir sube el promedio, no garantiza
  })

  it('referencias: básica ~40 % 75+ y ~10 % 80+; máxima ~40 % 90+ y ~10 % 95+', () => {
    const basic = sample(1, 5)
    expect(share(basic, (p) => p.pot! >= 75)).toBeGreaterThan(0.3)
    expect(share(basic, (p) => p.pot! >= 80)).toBeGreaterThan(0.06)
    expect(share(basic, (p) => p.pot! >= 80)).toBeLessThan(0.15)
    const max = sample(3, 6)
    expect(share(max, (p) => p.pot! >= 90)).toBeGreaterThan(0.35)
    expect(share(max, (p) => p.pot! >= 95)).toBeGreaterThan(0.06)
    expect(share(max, (p) => p.pot! >= 95)).toBeLessThan(0.16)
  })

  it('llega 10-20 puntos por debajo de su potencial y su pico es 85-100 % del potencial', () => {
    for (const p of sample(2, 7)) {
      expect(p.age).toBeGreaterThanOrEqual(16)
      expect(p.age).toBeLessThanOrEqual(18)
      expect(p.peak).toBeLessThanOrEqual(p.pot!)
      expect(p.peak).toBeGreaterThanOrEqual(Math.round(p.pot! * 0.85))
      expect(p.peakAge!).toBeGreaterThanOrEqual(22)
      expect(p.peakAge!).toBeLessThanOrEqual(26)
      expect(p.rating).toBeLessThanOrEqual(p.peak)
    }
  })

  it('crece de +3 a +5 por año y alcanza su pico antes de los 27', () => {
    const rng = createRng(9)
    let gains = 0
    let n = 0
    for (let i = 0; i < 400; i++) {
      let p = newCanterano('g', 'DEL', 3, rng)
      const start = p.age
      for (let a = start; a < 27; a++) {
        const next = progressPlayer({ ...p, starts: 38 }, rng)
        if (a <= 20 && next.rating < p.peak) {
          gains += next.rating - p.rating
          n++
        }
        p = next
      }
      expect(p.rating).toBeGreaterThanOrEqual(p.peak - 2)
    }
    expect(gains / n).toBeGreaterThan(2.5)
    expect(gains / n).toBeLessThan(5.2)
  })
})

describe('declive por posición', () => {
  const avgAt = (pos: 'POR' | 'DEF' | 'MED' | 'DEL', age: number) => {
    const rng = createRng(11)
    let total = 0
    for (let i = 0; i < 500; i++) {
      const base: SimPlayer = { id: 'x', name: 'x', pos, age: age - 1, rating: 85, peak: 85, potBias: 0, starter: true, starts: 38 }
      total += progressPlayer(base, rng).rating - 85
    }
    return total / 500
  }
  it('cada posición baja desde su edad y las caídas son de -1 a -3', () => {
    for (const pos of ['POR', 'DEF', 'MED', 'DEL'] as const) {
      const [first, sure] = DECLINE.start[pos]
      expect(avgAt(pos, first - 4)).toBeGreaterThan(-0.05)
      expect(avgAt(pos, sure + 1)).toBeLessThan(-0.9)
      expect(avgAt(pos, sure + 1)).toBeGreaterThan(-3.05)
    }
    expect(avgAt('DEL', 34)).toBeLessThan(avgAt('DEF', 34))
    expect(avgAt('POR', 36)).toBeGreaterThan(-0.3)
  })
})

describe('mercado y sueldos', () => {
  const mk = (age: number, rating: number, peak: number, pos: 'DEL' | 'POR' = 'DEL'): SimPlayer => ({ id: 'm', name: 'm', pos, age, rating, peak, pot: peak, potBias: 0, starter: false })
  it('el valor depende de potencial, edad y Val actual', () => {
    expect(marketValue(mk(18, 70, 92))).toBeGreaterThan(marketValue(mk(18, 70, 76)) * 1.5)
    expect(marketValue(mk(31, 85, 85))).toBeLessThan(marketValue(mk(26, 85, 85)))
    expect(marketValue(mk(36, 85, 85, 'POR'))).toBeGreaterThan(marketValue(mk(36, 85, 85, 'DEL')))
    expect(marketValue(mk(26, 90, 90))).toBeGreaterThan(marketValue(mk(26, 82, 82)) * 1.6)
  })
  it('las estrellas cuestan mucho más de sueldo', () => {
    expect(playerSalary(mk(27, 92, 92))).toBeGreaterThan(playerSalary(mk(27, 80, 80)) * 2.2)
  })
})

describe('superestrellas (sin tope por club, pero más caras)', () => {
  const mk = (rating: number, peak = rating): SimPlayer => ({ id: 'x', name: 'x', pos: 'DEL', age: 27, rating, peak, potBias: 0, starter: true })
  it('un club puede tener más de dos jugadores de 95+ (sin tope)', () => {
    expect('maxTopStarsPerClub' in VAL_LIMITS).toBe(false)
  })
  it('a partir de 95 el precio de mercado sube un 30 %', () => {
    const base = marketValue(mk(94)) // sin sobrecosto
    const star = marketValue(mk(95))
    const noPremium = Math.round((star / VAL_LIMITS.topStarPremium) / 10_000) * 10_000
    expect(VAL_LIMITS.topStarPremium).toBe(1.3)
    expect(star).toBeGreaterThan(base * 1.3)
    expect(Math.abs(noPremium * VAL_LIMITS.topStarPremium - star)).toBeLessThanOrEqual(10_000)
  })
})

describe('simulación de validación (30 temporadas)', () => {
  it('se mantiene dentro de los rangos', () => {
    const r = runLifetimeSim({ seasons: 30, seed: 5, checkpoints: [1, 20, 30] })
    expect(r.checkpoints.map((c) => c.season)).toEqual([1, 20, 30])
    for (const c of r.checkpoints) {
      expect(c.div1Mean).toBeGreaterThanOrEqual(VAL_TARGETS.div1StartersMean[0])
      expect(c.div1Mean).toBeLessThanOrEqual(VAL_TARGETS.div1StartersMean[1])
      expect(c.div2Mean).toBeGreaterThanOrEqual(VAL_TARGETS.div2StartersMean[0])
      expect(c.div2Mean).toBeLessThanOrEqual(VAL_TARGETS.div2StartersMean[1])
    }
    const last = r.checkpoints[2]
    expect(last.budgetEliteStart).toBeGreaterThan(last.budgetRest) // el élite sigue por delante en dinero
  })
})

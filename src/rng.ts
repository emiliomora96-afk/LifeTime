export type Rng = () => number

// Generador aleatorio con semilla (mulberry32): misma semilla, mismos números
export function createRng(seed: number): Rng {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Mezcla varios números en una sola semilla
export function mixSeed(...parts: number[]): number {
  let h = 2166136261
  for (const p of parts) {
    h ^= p | 0
    h = Math.imul(h, 16777619)
    h ^= h >>> 13
  }
  return h >>> 0
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Número de sucesos aleatorios con media lambda (goles, corners, tarjetas...)
export function poisson(lambda: number, rng: Rng): number {
  const limit = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > limit)
  return k - 1
}

// Número aleatorio con campana de Gauss (media 0, desviación 1)
export function normal(rng: Rng): number {
  const u = Math.max(rng(), 1e-9)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function pickOne<T>(list: T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)]
}

export function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: Rng): T | undefined {
  let total = 0
  for (const item of items) total += Math.max(0, weight(item))
  if (total <= 0) return undefined
  let r = rng() * total
  for (const item of items) {
    r -= Math.max(0, weight(item))
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

export function shuffle<T>(list: T[], rng: Rng): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

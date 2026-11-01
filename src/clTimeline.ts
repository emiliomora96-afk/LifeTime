import type { MatchStats } from './engine'
import type { Rng } from './rng'
import { clamp, normal, poisson } from './rng'
import type { TGoal } from './tournament'

/* ==========================================================================
   Lifetime Champions League: línea de tiempo de un partido.
   El motor (champions.ts) genera esta línea de tiempo (dominio por tramos, tiros, goles
   y contraataques) y la animación (MatchPlayer.tsx) solo la reproduce.
   ========================================================================== */

/* ---------- Qué lleva animación (CONFIGURACIÓN) ---------- */
// Competiciones/fases con animación gráfica del campo (colores, tiros, goles y contraataques).
// Por ahora solo la Supercopa. El código de la animación sigue completo: para volver a animar
// una fase de la Champions basta pasarla de QUICK_STAGES a esta lista.
export const ANIMATED_STAGES: string[] = ['supercopa']
// Fases con simulación rápida, sin animación del campo: suspenso breve y luego el resultado,
// con los goles cayendo uno a uno, las estadísticas y el botón Continuar.
// Por ahora, todas las fases de la Lifetime Champions League.
export const QUICK_STAGES: string[] = ['liga', 'playoff', 'octavos', 'cuartos', 'semi', 'final']
// Ritmo de la simulación rápida
export const QUICK_SUSPENSE_SECONDS = 2 // suspenso antes del resultado
export const QUICK_GOAL_MS = 300 // cada cuánto cae un gol en el resultado

// Una fase se anima solo si está en ANIMATED_STAGES (cualquier otra usa la simulación rápida)
export function isAnimated(stage: string): boolean {
  return ANIMATED_STAGES.includes(stage)
}

/* ---------- Tiempos de la animación (de las fases animadas) ---------- */
export type ClSpeed = 'completo'

export interface SpeedConfig {
  halfSeconds: number // cada tiempo de los 90 minutos
  extraSeconds: number // cada tramo de la prórroga
  goalPause: number // pausa fija por gol, sin importar cuántos haya
  breakSeconds: number // descanso entre tiempos, con el marcador
  extraIntro: number // cartel de “Prórroga”
  extraBreak: number // entre los dos tramos de la prórroga: sin descanso largo
  pensIntro: number // cartel de “Penales”
  kickSeconds: number // cada lanzamiento de la tanda
  suspense: number // suspenso antes del partido
  maxCounters: number // contraataques visibles por tiempo (solo los más peligrosos)
}

export const SPEED: Record<ClSpeed, SpeedConfig> = {
  completo: { halfSeconds: 10, extraSeconds: 5, goalPause: 3, breakSeconds: 3, extraIntro: 1.2, extraBreak: 0.6, pensIntro: 1.2, kickSeconds: 1, suspense: 2, maxCounters: 3 },
}

// Valores de la animación (se mantienen estos nombres)
export const HALF_SECONDS = SPEED.completo.halfSeconds
export const EXTRA_SECONDS = SPEED.completo.extraSeconds
export const GOAL_PAUSE_SECONDS = SPEED.completo.goalPause
export const BREAK_SECONDS = SPEED.completo.breakSeconds
export const EXTRA_INTRO_SECONDS = SPEED.completo.extraIntro
export const EXTRA_BREAK_SECONDS = SPEED.completo.extraBreak
export const PENS_INTRO_SECONDS = SPEED.completo.pensIntro
export const KICK_SECONDS = SPEED.completo.kickSeconds
export const SUSPENSE_SECONDS = SPEED.completo.suspense

/* ---------- Contraataques ---------- */
export const MAX_COUNTERS = SPEED.completo.maxCounters // visibles por tiempo
export const COUNTER_MIN_SECONDS = 0.5 // la cuña cruza el campo en 0,5 a 1 s
export const COUNTER_MAX_SECONDS = 1
export const PRE_TREMBLE_SECONDS = 0.45 // el frente del dominante tiembla antes de la cuña
export const REBOUND_SECONDS = 1 // el frente rebota como una goma
const COUNTER_GOAL_CHANCE = 0.45 // probabilidad de que un gol nazca de un contraataque
const COUNTER_SHOT_CHANCE = 0.3

/* ---------- Tipos ---------- */
export type HalfId = 'h1' | 'h2' | 'e1' | 'e2'
export type Lane = 'left' | 'center' | 'right'
export type CounterResult = 'shot' | 'goal' | 'fail'
export type FailKind = 'atajada' | 'fuera-de-juego' | 'defensa'

export const LANES: Lane[] = ['left', 'center', 'right']
export const FAIL_KINDS: FailKind[] = ['atajada', 'fuera-de-juego', 'defensa']

// Contraataque: carril, velocidad y resultado (tiro, gol o fallo)
export interface Counter {
  side: 0 | 1 // 0 = local, 1 = visitante: quien contraataca
  t: number // inicio, como fracción del tiempo (0 a 1)
  lane: Lane
  speed: number // campos por segundo (1 a 2): cruza el campo en 1/speed segundos
  result: CounterResult
  fail: FailKind | null // cómo se apaga si falla
  goal: number | null // índice del gol del partido si termina en gol
}

export interface ShotMark {
  t: number
  side: 0 | 1
}

export interface GoalMark {
  t: number
  side: 0 | 1
  goal: number // índice en la lista de goles del partido
}

export interface HalfTimeline {
  id: HalfId
  seconds: number // duración en pantalla
  dominance: number[] // de -1 (domina el visitante) a 1 (domina el local), por tramos de tiempo
  shots: ShotMark[] // tiros al arco que no son gol
  goals: GoalMark[]
  counters: Counter[]
}

export interface PenKick {
  side: 0 | 1
  scored: boolean
  how: 'gol' | 'atajado' | 'fuera'
  dir: -1 | 0 | 1 // esquina a la que va el tiro (izquierda, centro, derecha)
  high: boolean
}

export interface MatchTimeline {
  mode?: ClSpeed // modo de tiempos con el que se armó (si falta, completo)
  halves: HalfTimeline[] // 2 (90 minutos) o 4 (con prórroga)
  kicks: PenKick[] // tanda de penales (vacía si no hubo)
}

export interface TimelineInput {
  goals: TGoal[]
  stats: MatchStats
  extraTime: boolean
  kicks: PenKick[] | null
  strengthDiff: number // nivel del local menos nivel del visitante
}

const HALF_ORDER: HalfId[] = ['h1', 'h2', 'e1', 'e2']
const HALF_MINUTES: Record<HalfId, [number, number]> = { h1: [0, 45], h2: [45, 90], e1: [90, 105], e2: [105, 120] }

export const HALF_LABEL: Record<HalfId, string> = {
  h1: '1.er tiempo',
  h2: '2.º tiempo',
  e1: 'Prórroga · 1.ª parte',
  e2: 'Prórroga · 2.ª parte',
}

/* ---------- Goles: en qué tiempo y en qué momento caen ---------- */
function placeGoal(minute: number): { half: HalfId; t: number } {
  const half: HalfId = minute <= 45 ? 'h1' : minute <= 90 ? 'h2' : minute <= 105 ? 'e1' : 'e2'
  const [a, b] = HALF_MINUTES[half]
  return { half, t: clamp((minute - a - 0.5) / (b - a), 0.04, 0.96) }
}

// Los goles de un mismo tiempo no pueden caer pegados: se separan lo justo
function spreadGoals(marks: GoalMark[]): void {
  const gap = 0.06
  marks.sort((x, y) => x.t - y.t || x.goal - y.goal)
  for (let i = 1; i < marks.length; i++) marks[i].t = Math.max(marks[i].t, marks[i - 1].t + gap)
  for (let i = marks.length - 1; i >= 0; i--) {
    const cap = i === marks.length - 1 ? 0.96 : marks[i + 1].t - gap
    marks[i].t = Math.max(0.04, Math.min(marks[i].t, cap))
  }
}

/* ---------- Dominio ---------- */
const sign = (side: 0 | 1): number => (side === 0 ? 1 : -1)

function baseDominance(chunks: number, bias: number, goals: GoalMark[], rng: Rng): number[] {
  const out: number[] = []
  let drift = 0
  for (let k = 0; k < chunks; k++) {
    drift = drift * 0.5 + normal(rng) * 0.38
    out.push(bias + drift)
  }
  // Quien anota empuja un poco antes y un poco después
  for (const g of goals) {
    const c = clamp(Math.floor(g.t * chunks), 0, chunks - 1)
    out[c] += 0.28 * sign(g.side)
    if (c > 0) out[c - 1] += 0.2 * sign(g.side)
  }
  return out.map((v) => clamp(v, -1, 1))
}

function weightedChunk(chunks: number, side: 0 | 1, dom: number[], rng: Rng): number {
  const w = dom.map((d) => 0.25 + Math.max(0, d * sign(side)))
  let r = rng() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < chunks; i++) {
    r -= w[i]
    if (r <= 0) return i
  }
  return chunks - 1
}

/* ---------- Contraataques ---------- */
interface Candidate {
  c: Counter
  danger: number
  mark?: GoalMark
  shot?: ShotMark
}

function pick<T>(list: T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)]
}

// Elige los contraataques más peligrosos del tiempo (hasta MAX_COUNTERS), sin que se pisen entre sí
function planCounters(h: HalfTimeline, limit: number, rng: Rng): void {
  const sec = h.seconds
  const chunks = h.dominance.length
  const cands: Candidate[] = []

  const make = (side: 0 | 1, tEnd: number, result: CounterResult, goal: number | null): Counter | null => {
    const speed = 1 + rng() // 1 a 2 campos por segundo: cruza en 0,5 a 1 s
    const t = tEnd - 1 / speed / sec
    if (t * sec < PRE_TREMBLE_SECONDS + 0.1) return null // no cabe el temblor previo dentro del tiempo
    return { side, t, lane: pick(LANES, rng), speed, result, fail: result === 'fail' ? pick(FAIL_KINDS, rng) : null, goal }
  }

  for (const g of h.goals) {
    if (rng() >= COUNTER_GOAL_CHANCE) continue
    const c = make(g.side, g.t, 'goal', g.goal)
    if (c) cands.push({ c, mark: g, danger: 3 + c.speed * 0.2 + rng() * 0.1 })
  }
  for (const s of h.shots) {
    if (rng() >= COUNTER_SHOT_CHANCE) continue
    const c = make(s.side, s.t, 'shot', null)
    if (c) cands.push({ c, shot: s, danger: 2 + c.speed * 0.2 + rng() * 0.1 })
  }
  const fails = Math.min(3, poisson(1.1, rng))
  for (let i = 0; i < fails; i++) {
    const c = make(rng() < 0.5 ? 0 : 1, 0.2 + rng() * 0.75, 'fail', null)
    if (c) cands.push({ c, danger: 1 + c.speed * 0.2 + rng() * 0.1 })
  }

  cands.sort((a, b) => b.danger - a.danger)
  const accepted: Candidate[] = []
  for (const cand of cands) {
    if (accepted.length >= limit) break
    const start = cand.c.t * sec
    const end = start + 1 / cand.c.speed
    const lo = start - PRE_TREMBLE_SECONDS - 0.2
    const hi = end + REBOUND_SECONDS
    const clash = accepted.some((a) => {
      const aStart = a.c.t * sec
      return lo < aStart + 1 / a.c.speed + REBOUND_SECONDS && hi > aStart - PRE_TREMBLE_SECONDS - 0.2
    })
    if (clash) continue
    // El juego se detiene en cada gol: ningún otro gol puede caer en medio de la jugada
    const crossesGoal = h.goals.some((g) => g !== cand.mark && g.t * sec > start - PRE_TREMBLE_SECONDS && g.t * sec < end + 0.05)
    if (crossesGoal) continue
    accepted.push(cand)
  }

  accepted.sort((a, b) => a.c.t - b.c.t)
  h.counters = accepted.map((a) => a.c)
  // El tiro que cierra una cuña lo cuenta la propia cuña
  const used = new Set(accepted.flatMap((a) => (a.shot ? [a.shot] : [])))
  h.shots = h.shots.filter((s) => !used.has(s))

  // El equipo que contraataca no es el que domina en ese momento: es el dominante quien pierde el balón
  for (const a of accepted) {
    const defender = -sign(a.c.side)
    const from = clamp(Math.floor(a.c.t * chunks), 0, chunks - 1)
    for (const k of [from - 1, from]) {
      if (k < 0) continue
      if (Math.sign(h.dominance[k]) !== defender) h.dominance[k] = defender * 0.4
      else h.dominance[k] = defender * clamp(Math.abs(h.dominance[k]), 0.4, 0.9)
    }
  }
}

/* ---------- Línea de tiempo de un partido ---------- */
export function buildTimeline(input: TimelineInput, rng: Rng, mode: ClSpeed = 'completo'): MatchTimeline {
  const { goals, stats } = input
  const sp = SPEED[mode]
  const ids = HALF_ORDER.slice(0, input.extraTime ? 4 : 2)

  const marks = new Map<HalfId, GoalMark[]>(ids.map((id) => [id, []]))
  goals.forEach((g, i) => {
    const p = placeGoal(g.minute)
    marks.get(p.half)?.push({ t: p.t, side: g.side, goal: i })
  })

  // Tiros al arco que no acabaron en gol (en los 90 minutos)
  const regular = (side: 0 | 1) => goals.filter((g) => g.side === side && g.minute <= 90).length
  const saved = [0, 1].map((s) => clamp(stats.onTarget[s] - regular(s as 0 | 1), 0, 7))

  const bias = clamp((stats.poss - 50) / 40 + clamp(input.strengthDiff, -12, 12) * 0.015, -0.6, 0.6)
  const halves: HalfTimeline[] = ids.map((id) => {
    const seconds = id === 'h1' || id === 'h2' ? sp.halfSeconds : sp.extraSeconds
    const chunks = id === 'h1' || id === 'h2' ? 8 : 4
    const g = marks.get(id) ?? []
    spreadGoals(g)
    const h: HalfTimeline = { id, seconds, dominance: baseDominance(chunks, bias, g, rng), shots: [], goals: g, counters: [] }
    return h
  })

  // Reparte los tiros entre los dos tiempos, más cerca de donde domina cada equipo
  for (const side of [0, 1] as const) {
    for (let i = 0; i < saved[side]; i++) {
      const h = halves[rng() < 0.5 ? 0 : 1]
      const c = weightedChunk(h.dominance.length, side, h.dominance, rng)
      h.shots.push({ t: (c + 0.1 + rng() * 0.8) / h.dominance.length, side })
    }
    for (const h of halves.slice(2)) {
      const n = Math.min(2, poisson(0.6, rng))
      for (let i = 0; i < n; i++) h.shots.push({ t: 0.1 + rng() * 0.8, side })
    }
  }
  for (const h of halves) {
    h.shots.sort((a, b) => a.t - b.t)
    planCounters(h, h.id === 'h1' || h.id === 'h2' ? sp.maxCounters : Math.min(2, sp.maxCounters), rng) // la prórroga dura la mitad
    for (let k = 0; k < h.dominance.length; k++) h.dominance[k] = Math.round(h.dominance[k] * 100) / 100
  }
  return { mode, halves, kicks: input.kicks ?? [] }
}

// Dominio en un momento del tiempo (t de 0 a 1), suavizado entre tramos
export function dominanceAt(h: HalfTimeline, t: number): number {
  const n = h.dominance.length
  const x = clamp(t, 0, 1) * n - 0.5
  const i = Math.floor(x)
  const f = x - i
  const a = h.dominance[clamp(i, 0, n - 1)]
  const b = h.dominance[clamp(i + 1, 0, n - 1)]
  return a + (b - a) * f * f * (3 - 2 * f)
}

/* ---------- Guion: la línea de tiempo convertida en milisegundos ---------- */
export interface ScriptSeg {
  kind: 'play' | 'goal' | 'break' | 'kick'
  start: number // ms
  end: number
  half: number // índice en timeline.halves (en un descanso, el tiempo que acaba de terminar)
  t0: number // fracción del tiempo (play y goal)
  t1: number
  goal: number // índice del gol del partido (goal), -1 en los demás
  label: string // cartel del descanso
  kick: number // índice del lanzamiento (kick), -1 en los demás
  score: [number, number] // marcador durante el tramo (en un gol ya incluye ese gol)
  pens: [number, number] // tanda antes del lanzamiento
}

// Golpe que hace vibrar la cancha: un tiro (temblor corto) o un gol (temblor fuerte)
export interface Impact {
  ms: number
  kind: 'shot' | 'goal'
  side: 0 | 1
}

export interface Script {
  segs: ScriptSeg[]
  total: number // ms
  impacts: Impact[]
  pause: number // pausa por gol, en segundos (los efectos del gol se ajustan a ella)
}

export function buildScript(tl: MatchTimeline): Script {
  const sp = SPEED[tl.mode ?? 'completo'] ?? SPEED.completo
  const segs: ScriptSeg[] = []
  const impacts: Impact[] = []
  let ms = 0
  const score: [number, number] = [0, 0]
  const pens: [number, number] = [0, 0]

  const push = (kind: ScriptSeg['kind'], half: number, durMs: number, extra: Partial<ScriptSeg> = {}): ScriptSeg => {
    const seg: ScriptSeg = {
      kind,
      start: ms,
      end: ms + durMs,
      half,
      t0: 0,
      t1: 0,
      goal: -1,
      label: '',
      kick: -1,
      score: [score[0], score[1]],
      pens: [pens[0], pens[1]],
      ...extra,
    }
    segs.push(seg)
    ms += durMs
    return seg
  }

  tl.halves.forEach((h, hi) => {
    let cursor = 0
    const playTo = (to: number) => {
      const dur = (to - cursor) * h.seconds * 1000
      if (dur >= 1) push('play', hi, dur, { t0: cursor, t1: to })
      cursor = Math.max(cursor, to)
    }
    for (const g of [...h.goals].sort((a, b) => a.t - b.t)) {
      playTo(g.t)
      score[g.side]++
      const seg = push('goal', hi, sp.goalPause * 1000, { t0: g.t, t1: g.t, goal: g.goal })
      impacts.push({ ms: seg.start, kind: 'goal', side: g.side })
    }
    playTo(1)

    const last = hi === tl.halves.length - 1
    if (!last) {
      if (h.id === 'h1') push('break', hi, sp.breakSeconds * 1000, { label: 'Descanso' })
      else if (h.id === 'h2') push('break', hi, sp.extraIntro * 1000, { label: 'Prórroga' })
      else push('break', hi, sp.extraBreak * 1000, { label: 'Segunda parte de la prórroga' })
    }
  })

  if (tl.kicks.length > 0) {
    push('break', tl.halves.length - 1, sp.pensIntro * 1000, { label: 'Penales' })
    tl.kicks.forEach((k, i) => {
      push('kick', tl.halves.length - 1, sp.kickSeconds * 1000, { kick: i })
      if (k.scored) pens[k.side]++
    })
  }

  // Momento (en ms) en que cae un instante del juego
  const msAt = (half: number, t: number): number => {
    const seg = segs.find((s) => s.kind === 'play' && s.half === half && t >= s.t0 - 1e-9 && t <= s.t1 + 1e-9)
    return seg ? seg.start + (t - seg.t0) * tl.halves[half].seconds * 1000 : -1
  }
  tl.halves.forEach((h, hi) => {
    for (const s of h.shots) {
      const at = msAt(hi, s.t)
      if (at >= 0) impacts.push({ ms: at, kind: 'shot', side: s.side })
    }
    for (const c of h.counters) {
      if (c.result !== 'shot') continue
      const at = msAt(hi, Math.min(0.999, c.t + 1 / c.speed / h.seconds))
      if (at >= 0) impacts.push({ ms: at, kind: 'shot', side: c.side })
    }
  })
  impacts.sort((a, b) => a.ms - b.ms)
  return { segs, total: ms, impacts, pause: sp.goalPause }
}

// Segundos que dura un partido (sin el suspenso previo)
export function matchSeconds(tl: MatchTimeline): number {
  return buildScript(tl).total / 1000
}

/* ---------- Penales: tanda lanzamiento a lanzamiento ---------- */
// Cinco tiros cada uno (con final anticipado si ya no se puede alcanzar) y después muerte súbita
export function shootoutKicks(pHome: number, pAway: number, rng: Rng): { kicks: PenKick[]; tally: [number, number] } {
  const kicks: PenKick[] = []
  const tally: [number, number] = [0, 0]
  const taken: [number, number] = [0, 0]
  const p: [number, number] = [pHome, pAway]

  const kick = (side: 0 | 1) => {
    const scored = rng() < p[side]
    const dir = (Math.floor(rng() * 3) - 1) as -1 | 0 | 1
    const high = rng() < 0.4
    const how: PenKick['how'] = scored ? 'gol' : rng() < 0.65 ? 'atajado' : 'fuera'
    kicks.push({ side, scored, how, dir, high })
    taken[side]++
    if (scored) tally[side]++
  }
  const decided = (): boolean => {
    if (taken[0] > 5 || taken[1] > 5) return taken[0] === taken[1] && tally[0] !== tally[1]
    const leftH = 5 - taken[0]
    const leftA = 5 - taken[1]
    return tally[0] > tally[1] + leftA || tally[1] > tally[0] + leftH
  }

  for (let i = 0; i < 5 && !decided(); i++) {
    kick(0)
    if (decided()) break
    kick(1)
  }
  let guard = 0
  while (!decided() && guard++ < 40) {
    kick(0)
    kick(1)
  }
  if (tally[0] === tally[1]) {
    // No debería pasar nunca: se desempata con un último lanzamiento local
    kicks.push({ side: 0, scored: true, how: 'gol', dir: 0, high: false })
    tally[0]++
  }
  return { kicks, tally }
}

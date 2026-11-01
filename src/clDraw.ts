import type { CounterResult, FailKind, Lane, PenKick } from './clTimeline'
import { REBOUND_SECONDS } from './clTimeline'

/* ==========================================================================
   Lifetime Champions League: dibujo en <canvas>.
   Solo dibuja: todo lo que pasa en el partido viene de la línea de tiempo del motor.
   ========================================================================== */

/* ---------- Colores ---------- */
function parseHex(c: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function rgba(c: string, a: number): string {
  const rgb = parseHex(c)
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : c
}

function mix(a: string, b: string, k: number): string {
  const x = parseHex(a)
  const y = parseHex(b)
  if (!x || !y) return k < 0.5 ? a : b
  const m = (i: number) => Math.round(x[i] + (y[i] - x[i]) * k)
  return `rgb(${m(0)},${m(1)},${m(2)})`
}

function distance(a: string, b: string): number {
  const x = parseHex(a)
  const y = parseHex(b)
  if (!x || !y) return 999
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

// Que los dos equipos se distingan en el campo: si sus colores se parecen, el visitante usa el secundario
export function fieldColors(home: [string, string], away: [string, string]): [string, string] {
  const candidates = [away[0], away[1], '#e5e7eb', '#111827']
  const pick = candidates.find((c) => distance(home[0], c) > 90) ?? away[0]
  return [home[0], pick]
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
const smooth = (u: number) => u * u * (3 - 2 * u)
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/* ---------- Tamaño del lienzo ---------- */
// Resolución interna fija (se multiplica por devicePixelRatio); la página solo lo escala con CSS.
// El campo es vertical: se dibuja en horizontal (largo = w) y se gira 90° al pintarlo.
export const FIELD_W = 340
export const FIELD_H = 420
export const INTRO_W = 320
export const INTRO_H = 427 // proporción 3:4

/* ---------- Estado de un fotograma ---------- */
export interface WedgeState {
  attacker: 0 | 1
  lane: Lane
  result: CounterResult
  fail: FailKind | null
  phase: 'pre' | 'run' | 'post'
  pre: number // intensidad del temblor previo del frente dominante (0 a 1)
  u: number // avance de la cuña por el campo (0 a 1)
  tau: number // segundos desde que llegó (fase post)
  seed: number
}

export interface Frame {
  w: number
  h: number
  colors: [string, string] // local, visitante
  dom: number // dominio suavizado, de -1 (visitante) a 1 (local)
  time: number // segundos reales, para el ondeo del frente
  wedges: WedgeState[]
  shake: [number, number] // temblor de la cancha, en píxeles
  flash: number // destello de gol (0 a 1)
  flashSide: 0 | 1 | null // quien marcó
  mood: number // 0 a 1: emoción del estadio (luces)
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function pitchRect(w: number, h: number): Rect {
  const m = Math.round(w * 0.034)
  return { x: m, y: m, w: w - m * 2, h: h - m * 2 }
}

/* ---------- Contraataque: geometría ---------- */
// Carril como fracción de la altura del campo, visto desde quien ataca (izquierda, centro o derecha)
function laneY(attacker: 0 | 1, lane: Lane): number {
  const up = attacker === 0 ? 0.2 : 0.8
  const down = 1 - up
  return lane === 'left' ? up : lane === 'right' ? down : 0.5
}

// Hasta dónde llega la cuña (fracción del campo desde la portería de quien ataca)
function reach(result: CounterResult, fail: FailKind | null): number {
  if (result === 'goal') return 1
  if (result === 'shot') return 0.96
  return fail === 'atajada' ? 0.93 : fail === 'fuera-de-juego' ? 0.6 : 0.74
}

function tipFrac(wd: WedgeState): number {
  const dir = wd.attacker === 0 ? 1 : -1
  const from = wd.attacker === 0 ? -0.06 : 1.06
  const to = wd.attacker === 0 ? reach(wd.result, wd.fail) : 1 - reach(wd.result, wd.fail)
  const e = wd.phase === 'run' ? 1 - (1 - wd.u) * (1 - wd.u) : 1 // sale disparada y frena al llegar
  return from + (to - from) * e + 0 * dir
}

function wedgeAlpha(wd: WedgeState): number {
  if (wd.phase !== 'post') return 1
  return clamp(1 - wd.tau / (wd.result === 'fail' ? 0.45 : 0.35), 0, 1)
}

// Cuánto estira la cuña el frente (fracción del campo) y cómo rebota como una goma al terminar
function stretch(wd: WedgeState, base: number): number {
  const dir = wd.attacker === 0 ? 1 : -1
  const reached = Math.max(0, (tipFrac(wd) - base) * dir) * 0.92
  if (wd.phase === 'run') return reached
  if (wd.phase === 'pre') return 0
  const k = wd.tau / REBOUND_SECONDS
  if (k >= 1) return 0
  return reached * Math.exp(-4.2 * wd.tau) * Math.cos(15 * wd.tau) * (1 - k * k * 0.2)
}

// Con dominio máximo (|d| = 1) el frente llega justo al borde del área grande rival:
// frente = centro + d · (medio campo − profundidad del área)
const AREA_DEPTH = 16.5 / 105 // profundidad del área grande (fracción del largo del campo)
const AREA_WIDTH = 40.3 / 68 // ancho del área grande (fracción del ancho del campo)
const POCKET_FROM = 0.7 // desde este dominio el color rival empieza a recogerse

function baseFront(dom: number): number {
  return 0.5 + dom * (0.5 - AREA_DEPTH)
}

// Posición del frente de color (fracción del largo del campo) en la altura y (0 a 1)
function frontAt(f: Frame, y: number): number {
  const base = baseFront(f.dom)
  let x = base + Math.sin(y * 7 + f.time * 1.4) * 0.005 + Math.sin(y * 3.1 - f.time * 0.9) * 0.009
  for (const wd of f.wedges) {
    if (wd.phase === 'pre') {
      // El equipo dominante pierde el balón: su frente tiembla un instante
      x += 0.016 * wd.pre * Math.sin(f.time * 75 + y * 28)
      continue
    }
    const dir = wd.attacker === 0 ? 1 : -1
    const g = Math.exp(-(((y - laneY(wd.attacker, wd.lane)) / 0.11) ** 2))
    x += dir * stretch(wd, base) * g
  }
  // Entre |d| = 0,7 y 1 la zona del rival pasa (suavemente) del ancho completo al ancho del área grande:
  // fuera de ese ancho, el color dominante cubre hasta la portería. Si el rival recupera terreno, se vuelve a abrir.
  const k = smooth(clamp((Math.abs(f.dom) - POCKET_FROM) / (1 - POCKET_FROM), 0, 1))
  const width = 1 + (AREA_WIDTH - 1) * k
  const outside = smooth(clamp((Math.abs(y - 0.5) - width / 2) / 0.03, 0, 1))
  return x + ((f.dom >= 0 ? 1 : 0) - x) * outside
}

/* ---------- Estadio y campo ---------- */
function drawStands(ctx: CanvasRenderingContext2D, f: Frame): void {
  const { w, h } = f
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0a1030')
  bg.addColorStop(1, '#050816')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Afición: puntos de luz en las gradas (más vivos cuanto más emoción)
  const m = Math.round(w * 0.034)
  const dots = Math.round(w / 5)
  for (let i = 0; i < dots; i++) {
    const x = hash(i + 1) * w
    const top = hash(i + 91) < 0.5
    const y = top ? hash(i + 7) * (m - 3) + 1 : h - m + hash(i + 7) * (m - 3) + 2
    const flicker = 0.5 + 0.5 * Math.sin(f.time * (2 + hash(i + 3) * 5) + i)
    const a = 0.14 + 0.2 * hash(i + 13) + f.mood * 0.45 * flicker
    ctx.fillStyle = hash(i + 29) < 0.3 ? `rgba(255,236,170,${a})` : `rgba(180,200,255,${a * 0.8})`
    ctx.fillRect(x, y, 2, 2)
  }

  // Focos en las esquinas
  for (const [cx, cy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ]) {
    const r = w * 0.34
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(255,244,214,${0.22 + f.mood * 0.5})`)
    g.addColorStop(1, 'rgba(255,244,214,0)')
    ctx.fillStyle = g
    ctx.fillRect(Math.min(cx, cx - r), Math.min(cy, cy - r), r * 2, r * 2)
  }
}

function drawPitchBase(ctx: CanvasRenderingContext2D, p: Rect): void {
  ctx.fillStyle = '#0c3b29'
  ctx.fillRect(p.x, p.y, p.w, p.h)
  const stripes = 14
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    ctx.fillRect(p.x + (p.w * i) / stripes, p.y, p.w / stripes, p.h)
  }
}

// Cada equipo tiene su color en su mitad; el que domina avanza y empuja al rival hacia su portería
function drawTeams(ctx: CanvasRenderingContext2D, p: Rect, f: Frame): void {
  const rows = Math.max(48, Math.round(p.h / 4))
  const soft = p.w * 0.055
  ctx.save()
  ctx.beginPath()
  ctx.rect(p.x, p.y, p.w, p.h)
  ctx.clip()
  for (let r = 0; r < rows; r++) {
    const y = (r + 0.5) / rows
    const fx = p.x + frontAt(f, y) * p.w
    const g = ctx.createLinearGradient(fx - soft, 0, fx + soft, 0)
    g.addColorStop(0, f.colors[0])
    g.addColorStop(1, f.colors[1])
    ctx.fillStyle = g
    ctx.fillRect(p.x, p.y + (r * p.h) / rows, p.w, p.h / rows + 0.8)
  }
  // El césped se transparenta sobre los colores (las franjas van encima)
  const stripes = 14
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.07)'
    ctx.fillRect(p.x + (p.w * i) / stripes, p.y, p.w / stripes, p.h)
  }

  // Luz del frente
  ctx.beginPath()
  for (let r = 0; r <= rows; r++) {
    const y = r / rows
    const x = p.x + frontAt(f, y) * p.w
    if (r === 0) ctx.moveTo(x, p.y)
    else ctx.lineTo(x, p.y + y * p.h)
  }
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

function drawWedge(ctx: CanvasRenderingContext2D, p: Rect, f: Frame, wd: WedgeState): void {
  const dir = wd.attacker === 0 ? 1 : -1
  const color = f.colors[wd.attacker]
  const alpha = wedgeAlpha(wd)
  if (alpha <= 0) return
  const base = baseFront(f.dom)
  const tip = tipFrac(wd)
  const tipX = p.x + tip * p.w
  const cy = p.y + laneY(wd.attacker, wd.lane) * p.h
  const len = p.w * 0.34
  const hw = p.h * 0.15

  ctx.save()
  ctx.beginPath()
  ctx.rect(p.x, p.y, p.w, p.h)
  ctx.clip()

  // Fragmentos del color del dominante que se parten donde pasa la cuña
  const beyond = Math.max(0, (tip - base) * dir)
  if (beyond > 0) {
    const age = wd.phase === 'post' ? 1 + wd.tau / 0.7 : clamp(beyond / 0.3, 0, 1)
    if (age < 2) {
      const fade = clamp(2 - age, 0, 1)
      ctx.fillStyle = rgba(f.colors[1 - wd.attacker], 0.85 * fade)
      for (let i = 0; i < 8; i++) {
        const r1 = hash(wd.seed + i * 3.1)
        const r2 = hash(wd.seed + i * 7.7 + 1)
        const ease = smooth(clamp(age, 0, 1))
        const sx = p.x + base * p.w + dir * p.w * (0.02 + 0.14 * r1) * ease
        const sy = cy + (r2 - 0.5) * p.h * 0.75 * ease
        const sz = 3 + 6 * r1
        const rot = r2 * 6 + age * 4
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(rot)
        ctx.beginPath()
        ctx.moveTo(0, -sz)
        ctx.lineTo(sz * 0.8, sz * 0.7)
        ctx.lineTo(-sz * 0.8, sz * 0.7)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }
  }

  // Estela brillante detrás de la punta
  const tailX = tipX - dir * len * 1.7
  const trail = ctx.createLinearGradient(tipX, 0, tailX, 0)
  trail.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`)
  trail.addColorStop(0.3, rgba(color, 0.7 * alpha))
  trail.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = trail
  const x0 = Math.min(tipX, tailX)
  const wTrail = Math.abs(tipX - tailX)
  ctx.fillRect(x0, cy - p.h * 0.02, wTrail, p.h * 0.04)
  ctx.globalAlpha = 0.45 * alpha
  ctx.fillRect(x0 + (dir > 0 ? wTrail * 0.25 : 0), cy - p.h * 0.075, wTrail * 0.75, p.h * 0.012)
  ctx.fillRect(x0 + (dir > 0 ? wTrail * 0.25 : 0), cy + p.h * 0.063, wTrail * 0.75, p.h * 0.012)
  ctx.globalAlpha = 1

  // La cuña: un pico del color del equipo, con borde nítido
  ctx.beginPath()
  ctx.moveTo(tipX - dir * len, cy - hw)
  ctx.quadraticCurveTo(tipX - dir * len * 0.45, cy - hw * 0.12, tipX, cy)
  ctx.quadraticCurveTo(tipX - dir * len * 0.45, cy + hw * 0.12, tipX - dir * len, cy + hw)
  ctx.closePath()
  ctx.fillStyle = rgba(color, alpha)
  ctx.fill()
  ctx.lineJoin = 'miter'
  ctx.lineWidth = 2.2
  ctx.strokeStyle = `rgba(255,255,255,${0.95 * alpha})`
  ctx.shadowColor = color
  ctx.shadowBlur = 16 * alpha
  ctx.stroke()
  ctx.restore()
}

function drawLines(ctx: CanvasRenderingContext2D, p: Rect): void {
  const sx = p.w / 105
  const sy = p.h / 68
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.6
  ctx.strokeRect(p.x, p.y, p.w, p.h)
  ctx.beginPath()
  ctx.moveTo(p.x + p.w / 2, p.y)
  ctx.lineTo(p.x + p.w / 2, p.y + p.h)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 9.15 * sy, 0, Math.PI * 2)
  ctx.stroke()
  for (const side of [0, 1]) {
    const x = side === 0 ? p.x : p.x + p.w
    const d = side === 0 ? 1 : -1
    ctx.strokeRect(side === 0 ? x : x - 16.5 * sx, p.y + p.h / 2 - 20.15 * sy, 16.5 * sx, 40.3 * sy)
    ctx.strokeRect(side === 0 ? x : x - 5.5 * sx, p.y + p.h / 2 - 9.16 * sy, 5.5 * sx, 18.32 * sy)
    // Portería
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(side === 0 ? x - 3 * sx : x, p.y + p.h / 2 - 3.66 * sy, 3 * sx, 7.32 * sy)
    ctx.beginPath()
    ctx.arc(x + d * 11 * sx, p.y + p.h / 2, 0.5 * sy + 1, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fill()
  }
  ctx.restore()
}

/* ---------- Partido completo ---------- */
// f.w es el largo del campo y f.h su ancho (cuadro lógico horizontal); en pantalla queda vertical:
// el local defiende abajo y ataca hacia arriba, y el carril “izquierda” de quien ataca sigue siendo la izquierda
export function drawMatch(ctx: CanvasRenderingContext2D, f: Frame): void {
  ctx.save()
  ctx.translate(0, f.w)
  ctx.rotate(-Math.PI / 2)
  drawMatchLogical(ctx, f)
  ctx.restore()
}

function drawMatchLogical(ctx: CanvasRenderingContext2D, f: Frame): void {
  const { w, h } = f
  ctx.clearRect(0, 0, w, h)
  drawStands(ctx, f)
  const p = pitchRect(w, h)
  ctx.save()
  ctx.translate(f.shake[0], f.shake[1])
  drawPitchBase(ctx, p)
  drawTeams(ctx, p, f)
  for (const wd of f.wedges) if (wd.phase !== 'pre') drawWedge(ctx, p, f, wd)
  drawLines(ctx, p)
  ctx.restore()

  if (f.flash > 0.01) {
    // Destello de gol: sale de la portería donde cayó y llena el estadio
    const gx = f.flashSide === 0 ? w : f.flashSide === 1 ? 0 : w / 2
    const burst = ctx.createRadialGradient(gx, h / 2, 0, gx, h / 2, w * 0.75)
    burst.addColorStop(0, `rgba(255,250,230,${0.9 * f.flash})`)
    burst.addColorStop(1, 'rgba(255,250,230,0)')
    ctx.fillStyle = burst
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = `rgba(255,248,220,${0.22 * f.flash})`
    ctx.fillRect(0, 0, w, h)
  }
}

// Fondo del estadio sin partido (descansos y carteles)
export function drawPitchOnly(ctx: CanvasRenderingContext2D, f: Frame): void {
  drawMatch(ctx, { ...f, wedges: [] })
}

/* ---------- Penales ---------- */
export interface KickScene {
  w: number
  h: number
  kick: PenKick
  p: number // avance del lanzamiento (0 a 1)
  colors: [string, string]
  time: number
  shake: [number, number]
}

export function drawPenalty(ctx: CanvasRenderingContext2D, s: KickScene): void {
  const { w, h, kick, p } = s
  const shooter = s.colors[kick.side]
  const keeperColor = s.colors[1 - kick.side]
  ctx.clearRect(0, 0, w, h)
  drawStands(ctx, { w, h, colors: s.colors, dom: 0, time: s.time, wedges: [], shake: [0, 0], flash: 0, flashSide: null, mood: 0.5 })
  ctx.save()
  ctx.translate(s.shake[0], s.shake[1])
  const m = Math.round(w * 0.034)
  ctx.fillStyle = '#0c3b29'
  ctx.fillRect(m, m, w - m * 2, h - m * 2)
  for (let i = 0; i < 10; i += 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    ctx.fillRect(m + ((w - m * 2) * i) / 10, m, (w - m * 2) / 10, h - m * 2)
  }

  // Portería con red
  const gx0 = w * 0.27
  const gx1 = w * 0.73
  const gy0 = h * 0.12
  const gy1 = h * 0.44
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0)
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  for (let x = gx0; x <= gx1; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x, gy0)
    ctx.lineTo(x, gy1)
    ctx.stroke()
  }
  for (let y = gy0; y <= gy1; y += 14) {
    ctx.beginPath()
    ctx.moveTo(gx0, y)
    ctx.lineTo(gx1, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(gx0, gy1)
  ctx.lineTo(gx0, gy0)
  ctx.lineTo(gx1, gy0)
  ctx.lineTo(gx1, gy1)
  ctx.stroke()

  // Portero: se lanza al lado contrario si hay gol, al correcto si ataja
  const keeperDir = kick.how === 'atajado' ? kick.dir : kick.dir === 0 ? 1 : (-kick.dir as -1 | 1)
  const dive = smooth(clamp((p - 0.3) / 0.28, 0, 1))
  const sway = Math.sin(s.time * 9) * 6 * (1 - dive)
  const kx = w * 0.5 + keeperDir * w * 0.15 * dive + sway
  const ky = gy1 - (gy1 - gy0) * 0.28 - (kick.high && keeperDir !== 0 ? dive * 14 : 0)
  ctx.save()
  ctx.translate(kx, ky)
  ctx.rotate(keeperDir * dive * 0.9)
  ctx.fillStyle = keeperColor
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, 0, 11, 24, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -29, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  // Balón: del punto de penal a una esquina (o fuera)
  const spotX = w * 0.5
  const spotY = h * 0.8
  const side = kick.dir
  let tx = w * 0.5 + side * (w * 0.17)
  let ty = kick.high ? gy0 + (gy1 - gy0) * 0.22 : gy0 + (gy1 - gy0) * 0.72
  if (kick.how === 'fuera') {
    if (kick.dir === 0) ty = gy0 - h * 0.1
    else tx = w * 0.5 + side * (w * 0.27)
  }
  if (kick.how === 'atajado') {
    tx = w * 0.5 + side * (w * 0.12)
  }
  const fly = smooth(clamp((p - 0.25) / 0.37, 0, 1))
  const bx = spotX + (tx - spotX) * fly
  const by = spotY + (ty - spotY) * fly - Math.sin(fly * Math.PI) * h * 0.04
  const br = 11 - fly * 4
  ctx.fillStyle = `rgba(0,0,0,0.3)`
  ctx.beginPath()
  ctx.ellipse(bx, spotY + 12 - fly * 6, br, br * 0.35, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f8fafc'
  ctx.beginPath()
  ctx.arc(bx, by, br, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(bx, by, br * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = '#111827'
  ctx.fill()

  // Resultado: red que se agita con gol, mano del portero con atajada, “fuera” con tiro desviado
  if (p >= 0.62) {
    const k = clamp((p - 0.62) / 0.38, 0, 1)
    if (kick.how === 'gol') {
      ctx.fillStyle = rgba(shooter, 0.35 * (1 - k))
      ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0)
    }
    ctx.textAlign = 'center'
    ctx.font = `800 ${Math.round(w * 0.07)}px system-ui, sans-serif`
    ctx.fillStyle = kick.how === 'gol' ? '#86efac' : kick.how === 'atajado' ? '#fde68a' : '#fca5a5'
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 12
    ctx.fillText(kick.how === 'gol' ? '¡GOL!' : kick.how === 'atajado' ? '¡ATAJADO!' : 'FUERA', w / 2, h * 0.64)
  }
  ctx.restore()
}

/* ---------- Animación de inicio (5 s) ---------- */
export const INTRO_MS = 5000

// Copa original: un cáliz facetado con asas angulares y una estrella en órbita (no es una réplica de ninguna copa real)
function drawCup(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, lit: number, t: number): void {
  const s = size / 190
  const base = mix('#05070d', '#d9a93a', lit)
  const dark = mix('#05070d', '#7a4e12', lit)
  const light = mix('#05070d', '#fff1b3', lit)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(s, s)
  ctx.lineJoin = 'round'

  const body = ctx.createLinearGradient(-50, 0, 50, 0)
  body.addColorStop(0, dark)
  body.addColorStop(0.35, light)
  body.addColorStop(0.65, base)
  body.addColorStop(1, dark)

  const rim = `rgba(255,236,170,${0.3 + 0.6 * lit})`
  const part = (draw: () => void, fill: string | CanvasGradient) => {
    ctx.beginPath()
    draw()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  // Asas
  for (const d of [-1, 1]) {
    part(() => {
      ctx.moveTo(d * 35, -46)
      ctx.bezierCurveTo(d * 68, -50, d * 72, -4, d * 40, 2)
      ctx.bezierCurveTo(d * 58, -10, d * 56, -36, d * 35, -37)
      ctx.closePath()
    }, body)
  }
  // Pie y plinto
  part(() => {
    ctx.moveTo(-5, 50)
    ctx.lineTo(5, 50)
    ctx.lineTo(14, 62)
    ctx.lineTo(30, 70)
    ctx.lineTo(30, 80)
    ctx.lineTo(-30, 80)
    ctx.lineTo(-30, 70)
    ctx.lineTo(-14, 62)
    ctx.closePath()
  }, body)
  part(() => ctx.rect(-40, 80, 80, 11), body)
  // Tallo y nudo en rombo
  part(() => {
    ctx.moveTo(-7, 12)
    ctx.lineTo(7, 12)
    ctx.lineTo(4.5, 52)
    ctx.lineTo(-4.5, 52)
    ctx.closePath()
  }, body)
  part(() => {
    ctx.moveTo(0, 20)
    ctx.lineTo(11, 32)
    ctx.lineTo(0, 44)
    ctx.lineTo(-11, 32)
    ctx.closePath()
  }, body)
  // Copa
  part(() => {
    ctx.moveTo(-37, -52)
    ctx.bezierCurveTo(-39, -20, -25, 6, -8, 14)
    ctx.lineTo(8, 14)
    ctx.bezierCurveTo(25, 6, 39, -20, 37, -52)
    ctx.closePath()
  }, body)
  // Facetas
  if (lit > 0.02) {
    const facets: [number, number, number, number, number][] = [
      [-37, -18, -4, 14, 0.0],
      [-18, 0, -4, 14, 0.26],
      [0, 18, 4, 14, 0.06],
      [18, 37, 4, 14, 0.3],
    ]
    for (const [xa, xb, xe, ye, a] of facets) {
      ctx.beginPath()
      ctx.moveTo(xa, -52)
      ctx.lineTo(xb, -52)
      ctx.lineTo(xe > 0 ? 8 : -8 + (xb === 0 ? 8 : 0), ye)
      ctx.lineTo(xe > 0 ? 4 : -4, ye)
      ctx.closePath()
      ctx.fillStyle = `rgba(255,250,225,${a * lit})`
      ctx.fill()
    }
    // Brillo que recorre la copa
    const sweep = ((t * 0.55) % 1.6) - 0.3
    const g = ctx.createLinearGradient(-40 + sweep * 80, -52, -10 + sweep * 80, 14)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, `rgba(255,255,255,${0.5 * lit})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-37, -52)
    ctx.bezierCurveTo(-39, -20, -25, 6, -8, 14)
    ctx.lineTo(8, 14)
    ctx.bezierCurveTo(25, 6, 39, -20, 37, -52)
    ctx.closePath()
    ctx.fill()
  }
  // Aro de la boca
  part(() => ctx.rect(-39, -56, 78, 7), body)

  // Estrella en órbita
  ctx.strokeStyle = rgba('#fff1b3', 0.25 + 0.5 * lit)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(0, -80, 26, 8, -0.15, 0, Math.PI * 2)
  ctx.stroke()
  part(() => {
    for (let i = 0; i < 16; i++) {
      const r = i % 2 === 0 ? 14 : 5.4
      const a = (Math.PI * i) / 8 - Math.PI / 2
      if (i === 0) ctx.moveTo(Math.cos(a) * r, -80 + Math.sin(a) * r)
      else ctx.lineTo(Math.cos(a) * r, -80 + Math.sin(a) * r)
    }
    ctx.closePath()
  }, body)
  ctx.restore()
}

function drawGlint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number): void {
  if (a <= 0.01) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(255,255,255,${a})`)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${a})`
  ctx.beginPath()
  ctx.moveTo(x - r * 2.4, y)
  ctx.lineTo(x, y - r * 0.12)
  ctx.lineTo(x + r * 2.4, y)
  ctx.lineTo(x, y + r * 0.12)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x, y - r * 2.4)
  ctx.lineTo(x + r * 0.12, y)
  ctx.lineTo(x, y + r * 2.4)
  ctx.lineTo(x - r * 0.12, y)
  ctx.closePath()
  ctx.fill()
}

// 0-1,5 s: oscuro, focos que se encienden y copa en silueta. 1,5-4 s: zoom lento con destellos.
// 4-5 s: aparece el nombre con un pulso de luz.
export function drawIntro(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number, title: string): void {
  const t = clamp(ms, 0, INTRO_MS) / 1000
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#02030a'
  ctx.fillRect(0, 0, w, h)

  const zoomK = smooth(clamp((t - 1.5) / 2.5, 0, 1))
  const zoom = 1 + zoomK * 0.74 // la copa empieza al 46 % del alto y termina cerca del 80 %, siempre entera
  const cupSize = h * 0.46
  const fx = w / 2
  const fy = h * 0.5
  const lit = smooth(clamp((t - 1.3) / 2.3, 0, 1))

  ctx.save()
  ctx.translate(fx, fy)
  ctx.scale(zoom, zoom)
  ctx.translate(-fx, -fy)

  // Resplandor detrás de la copa (la silueta se recorta contra la luz)
  const lamps = 6
  let on = 0
  for (let i = 0; i < lamps; i++) on += clamp((t - (0.15 + i * 0.17)) / 0.35, 0, 1)
  on /= lamps
  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, w * 0.5)
  glow.addColorStop(0, `rgba(255,236,170,${0.5 * on})`)
  glow.addColorStop(0.5, `rgba(70,90,190,${0.28 * on})`)
  glow.addColorStop(1, 'rgba(2,3,10,0)')
  ctx.fillStyle = glow
  ctx.fillRect(-w, -h, w * 3, h * 3)

  // Focos del estadio que se van encendiendo (con parpadeo)
  for (let i = 0; i < lamps; i++) {
    const lx = w * (0.1 + i * 0.16)
    const ly = h * (0.1 - 0.035 * Math.sin((Math.PI * i) / (lamps - 1)))
    const k = clamp((t - (0.15 + i * 0.17)) / 0.35, 0, 1)
    if (k <= 0) continue
    const power = k < 1 ? k * (0.5 + 0.5 * Math.pow(Math.sin(t * 70 + i * 9), 2)) : 1
    const cone = ctx.createLinearGradient(lx, ly, fx, fy + h * 0.3)
    cone.addColorStop(0, `rgba(255,244,214,${0.2 * power})`)
    cone.addColorStop(1, 'rgba(255,244,214,0)')
    ctx.fillStyle = cone
    ctx.beginPath()
    ctx.moveTo(lx - 6, ly)
    ctx.lineTo(lx + 6, ly)
    ctx.lineTo(fx + w * 0.22 * (i < lamps / 2 ? -1 : 1) + (fx - lx) * 0.6, fy + h * 0.45)
    ctx.lineTo(fx - w * 0.22 * (i < lamps / 2 ? -1 : 1) + (fx - lx) * 0.6, fy + h * 0.45)
    ctx.closePath()
    ctx.fill()
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.06)
    g.addColorStop(0, `rgba(255,255,255,${power})`)
    g.addColorStop(0.35, `rgba(255,240,200,${0.55 * power})`)
    g.addColorStop(1, 'rgba(255,240,200,0)')
    ctx.fillStyle = g
    ctx.fillRect(lx - w * 0.06, ly - w * 0.06, w * 0.12, w * 0.12)
  }

  drawCup(ctx, fx, fy, cupSize, lit, t)

  // Destellos de luz sobre la copa (durante el zoom)
  const glints: [number, number][] = [
    [-26, -40],
    [24, -28],
    [0, -80],
    [-58, -22],
    [12, 42],
  ]
  const gs = cupSize / 190
  glints.forEach(([gx, gy], i) => {
    const ph = Math.sin(t * 3.1 + i * 1.7)
    const a = Math.pow(Math.max(0, ph), 6) * clamp((t - 1.6) / 0.6, 0, 1)
    drawGlint(ctx, fx + gx * gs, fy + gy * gs, 6 * gs + 2, a)
  })
  ctx.restore()

  // Viñeta
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)

  // 4-5 s: el nombre del torneo con un pulso de luz
  if (t >= 4) {
    const k = clamp((t - 4) / 0.4, 0, 1)
    const veil = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6)
    veil.addColorStop(0, `rgba(2,3,10,${0.7 * k})`)
    veil.addColorStop(1, 'rgba(2,3,10,0)')
    ctx.fillStyle = veil
    ctx.fillRect(0, 0, w, h)

    const pulse = clamp((t - 4) / 0.55, 0, 1)
    if (pulse < 1) {
      const pr = ctx.createRadialGradient(w / 2, h / 2, w * 0.05 * pulse, w / 2, h / 2, w * (0.12 + 0.8 * pulse))
      pr.addColorStop(0, `rgba(255,248,220,${0.85 * (1 - pulse)})`)
      pr.addColorStop(1, 'rgba(255,248,220,0)')
      ctx.fillStyle = pr
      ctx.fillRect(0, 0, w, h)
    }
    const shine = 0.55 + 0.45 * Math.sin((t - 4) * 7)
    const words = title.split(' ')
    const lines = [words[0], ...words.slice(1)].map((x) => x.toUpperCase())
    ctx.save()
    ctx.globalAlpha = k
    ctx.translate(w / 2, h / 2)
    ctx.scale(1 + (1 - k) * 0.06, 1 + (1 - k) * 0.06)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const serif = 'Optima, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif'
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(w * 0.01)}px`
    ctx.shadowColor = `rgba(255,224,140,${0.9 * shine})`
    ctx.shadowBlur = 22
    // Una palabra por línea; la primera, más pequeña. Cada línea se ajusta al ancho del marco.
    let big = w * 0.105
    ctx.font = `700 ${Math.round(big)}px ${serif}`
    for (const l of lines.slice(1)) {
      while (ctx.measureText(l).width > w * 0.84 && big > 8) {
        big *= 0.94
        ctx.font = `700 ${Math.round(big)}px ${serif}`
      }
    }
    const small = Math.min(w * 0.05, big * 0.5)
    const g = ctx.createLinearGradient(0, -big, 0, big)
    g.addColorStop(0, '#fff6d6')
    g.addColorStop(0.55, '#f1c453')
    g.addColorStop(1, '#a8741a')
    const top = -big * 0.55 * (lines.length - 1)
    ctx.font = `600 ${Math.round(small)}px ${serif}`
    ctx.fillStyle = '#fff4cf'
    ctx.fillText(lines[0], 0, top)
    ctx.font = `700 ${Math.round(big)}px ${serif}`
    ctx.fillStyle = g
    lines.slice(1).forEach((l, i) => ctx.fillText(l, 0, top + small * 1.5 + i * big * 1.1))
    ctx.restore()
  }
}

// Nivel de aura según la VALORACIÓN (Val) del jugador.
//
// >>> PARA AJUSTAR TRAMOS Y COLORES, SOLO TOCA ESTA TABLA <<<
//   min       → Val mínimo del tramo (el tramo llega hasta el siguiente `min`)
//   color     → color base del aura (el aro, el brillo y el número usan este color)
//   animated  → true = el aura se mueve (gasta batería). Solo los tramos altos.
//
// Tramos:  <65 · 65-74 · 75-79 · 80-84 · 85-89 · 90-94 · 95+
export type AuraTier = 'none' | 'bronze' | 'silver' | 'gold' | 'amethyst' | 'fire' | 'storm'

export interface AuraTierDef {
  tier: AuraTier
  min: number
  label: string
  color: string
  animated: boolean
}

// De mayor a menor (el primero que cumple gana)
export const AURA_TIERS: AuraTierDef[] = [
  { tier: 'storm', min: 95, label: 'Rayo', color: '#38bdf8', animated: true },
  { tier: 'fire', min: 90, label: 'Fuego', color: '#ff5a1f', animated: true },
  { tier: 'amethyst', min: 85, label: 'Amatista', color: '#a855f7', animated: false }, // NUEVO
  { tier: 'gold', min: 80, label: 'Oro', color: '#fbbf24', animated: false },
  { tier: 'silver', min: 75, label: 'Plata', color: '#cbd5e1', animated: false }, // NUEVO
  { tier: 'bronze', min: 65, label: 'Bronce', color: '#c8843c', animated: false },
]

// Menos de 65: aro gris sencillo, sin brillo
export const AURA_NONE: AuraTierDef = { tier: 'none', min: 0, label: 'Base', color: '#94a3b8', animated: false }

export function auraOf(rating: number): AuraTierDef {
  return AURA_TIERS.find((t) => rating >= t.min) ?? AURA_NONE
}

export function auraTier(rating: number): AuraTier {
  return auraOf(rating).tier
}

// true si en la última temporada el jugador cruzó un umbral (ej. de 79 a 80)
export function crossedTier(rating: number, lastGain: number | undefined): boolean {
  if (!lastGain || lastGain <= 0) return false
  return auraTier(rating) !== auraTier(rating - lastGain)
}

/* ---------- Utilidades de color (para derivar el aro a partir de un solo color) ---------- */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Mezcla `hex` con `target` (0 = igual, 1 = target). */
export function mixColor(hex: string, target: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  const [tr, tg, tb] = parseHex(target)
  return toHex(r + (tr - r) * amount, g + (tg - g) * amount, b + (tb - b) * amount)
}

/** Color de texto legible (oscuro o blanco) sobre un fondo `hex`. */
export function inkOn(hex: string): string {
  const [r, g, b] = parseHex(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#0b1220' : '#ffffff'
}

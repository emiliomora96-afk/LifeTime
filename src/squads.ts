import type { Position } from './sample'
import { STARTERS, SUBS } from './sample'
import type { Rng } from './rng'
import { clamp, normal, pickOne, round1 } from './rng'

export interface SimPlayer {
  id: string
  name: string
  pos: Position
  rating: number
  starter: boolean
}

const FIRST_NAMES = [
  'Adrián', 'Bruno', 'Carlos', 'Darío', 'Emilio', 'Félix', 'Gonzalo', 'Héctor', 'Íñigo', 'Julio',
  'Kiko', 'Lucas', 'Marco', 'Néstor', 'Óscar', 'Pedro', 'Quique', 'Rodrigo', 'Sergio', 'Teo',
  'Unai', 'Víctor', 'Xavi', 'Yago', 'Zacarías', 'Aitor', 'Borja', 'Cayetano', 'Damián', 'Eloy',
  'Fran', 'Gerard', 'Hugo', 'Iker', 'Jon', 'Koldo', 'Luis', 'Mikel', 'Nacho', 'Omar',
]

const LAST_NAMES = [
  'Arteaga', 'Bermejo', 'Cabrera', 'Duarte', 'Escalante', 'Fontán', 'Galindo', 'Heredia', 'Iglesias', 'Jaramillo',
  'Lozano', 'Navarrete', 'Ordóñez', 'Palacios', 'Quintero', 'Ramos', 'Salvatierra', 'Urrutia', 'Vallejo', 'Zamora',
  'Alcázar', 'Barrios', 'Calleja', 'Domínguez', 'Esteban', 'Ferrer', 'Gallardo', 'Huerta', 'Ibáñez', 'Juárez',
  'Lara', 'Montero', 'Nieto', 'Olmos', 'Peña', 'Revilla', 'Sandoval', 'Tapia', 'Uribe', 'Vega',
]

const STARTER_POSITIONS: Position[] = ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL']
const SUB_POSITIONS: Position[] = ['POR', 'DEF', 'DEF', 'MED', 'MED', 'DEL', 'DEL']

// Plantilla provisoria para los clubes rivales. En el Paso 6 se reemplaza por plantillas reales.
export function placeholderSquad(teamId: number, strength: number, rng: Rng): SimPlayer[] {
  const slots = [
    ...STARTER_POSITIONS.map((pos) => ({ pos, starter: true })),
    ...SUB_POSITIONS.map((pos) => ({ pos, starter: false })),
  ]
  return slots.map((slot, i) => ({
    id: `t${teamId}-${i}`,
    name: `${pickOne(FIRST_NAMES, rng)} ${pickOne(LAST_NAMES, rng)}`,
    pos: slot.pos,
    rating: clamp(Math.round(strength + normal(rng) * 2.5 - (slot.starter ? 0 : 6)), 40, 95),
    starter: slot.starter,
  }))
}

// Plantilla del club del jugador (por ahora, la de ejemplo)
export function userSquad(): SimPlayer[] {
  return [
    ...STARTERS.map((p) => ({ id: `u-${p.id}`, name: p.name, pos: p.pos, rating: p.rating, starter: true })),
    ...SUBS.map((p) => ({ id: `u-${p.id}`, name: p.name, pos: p.pos, rating: p.rating, starter: false })),
  ]
}

// Nivel del equipo: promedio de valoración del once inicial
export function squadStrength(squad: SimPlayer[]): number {
  const starters = squad.filter((p) => p.starter)
  if (starters.length === 0) return 60
  return round1(starters.reduce((sum, p) => sum + p.rating, 0) / starters.length)
}

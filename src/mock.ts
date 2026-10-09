import type { Club } from './types'

export const TOTAL_SEASONS = 30
export const START_PRESTIGE = 10

export interface Stop {
  id: string
  name: string
  when: string
  actions: string
  duration: string
}

// Las 3 paradas base. En el Paso 4 esto pasa a ser la configuración real de la temporada.
export const STOPS: Stop[] = [
  {
    id: 'verano',
    name: 'Verano',
    when: 'Antes de empezar la temporada',
    actions: 'Mercado, cantera, ojeadores y formación',
    duration: '60 a 90 s',
  },
  {
    id: 'invierno',
    name: 'Invierno',
    when: 'A mitad de temporada',
    actions: 'Ajustes rápidos de plantilla y táctica',
    duration: '15 a 25 s',
  },
  {
    id: 'cierre',
    name: 'Cierre',
    when: 'Al terminar la temporada',
    actions: 'Resumen, ascensos y descensos, premios y clasificación a Europa',
    duration: '30 a 45 s',
  },
]

export interface StandingRow {
  name: string | null // null = tu club
  played: number
  points: number
}

export const STANDINGS_SAMPLE: StandingRow[] = [
  { name: 'CD Atalaya', played: 10, points: 22 },
  { name: 'Real Montaña', played: 10, points: 20 },
  { name: 'UD Costa Brava', played: 10, points: 19 },
  { name: 'Racing Ribera', played: 10, points: 17 },
  { name: 'Atlético Meseta', played: 10, points: 16 },
  { name: null, played: 10, points: 15 },
  { name: 'SD Marisma', played: 10, points: 13 },
  { name: 'Deportivo Sierra Alta', played: 10, points: 12 },
]

export const OBJECTIVE = {
  text: 'Terminar en la mitad alta de la tabla',
  confidence: 60,
}

export interface Message {
  id: number
  from: string
  subject: string
  preview: string
  unread: boolean
}

export function buildInbox(club: Club): Message[] {
  return [
    {
      id: 1,
      from: 'Directiva',
      subject: `Bienvenido a ${club.name}`,
      preview: 'Confiamos en ti para empezar este proyecto desde abajo.',
      unread: true,
    },
    {
      id: 2,
      from: 'Finanzas',
      subject: 'Presupuesto ajustado',
      preview: 'Los fondos son limitados: cada fichaje cuenta.',
      unread: true,
    },
    {
      id: 3,
      from: 'Cantera',
      subject: 'Primeros informes de juveniles',
      preview: 'Hay algunos nombres interesantes para seguir de cerca.',
      unread: false,
    },
  ]
}
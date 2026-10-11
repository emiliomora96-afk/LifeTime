import type { SimPlayer } from './players'

export const ROUNDS_PER_SEASON = 38
export const TOTAL_SEASONS = 30

export type BaseStopId = 'verano' | 'invierno' | 'cierre'

export interface BaseStop {
  id: BaseStopId
  name: string
  when: string
  actions: string
  duration: string
  round: number // jornada en la que ocurre la parada
}

// Las 3 paradas base, en orden
export const BASE_STOPS: BaseStop[] = [
  {
    id: 'verano',
    name: 'Verano',
    when: 'Antes de empezar la temporada',
    actions: 'Táctica, inversiones, ojeadores, cantera y mercado',
    duration: '60 a 90 s',
    round: 0,
  },
  {
    id: 'invierno',
    name: 'Invierno',
    when: 'A mitad de temporada',
    actions: 'Táctica, lesiones, contratos y ajustes de plantilla',
    duration: '15 a 25 s',
    round: ROUNDS_PER_SEASON / 2,
  },
  {
    id: 'cierre',
    name: 'Cierre',
    when: 'Al terminar la temporada',
    actions: 'Resumen, balance, ascensos y descensos, premios y clasificación a Europa',
    duration: '30 a 45 s',
    round: ROUNDS_PER_SEASON,
  },
]

/* ---------- Avisos ---------- */
export type NoticeKind = 'cantera' | 'lesion' | 'contrato' | 'salida' | 'ojeadores' | 'oferta' | 'evento'

export interface NoticeOption {
  id: string
  label: string
  detail?: string
  budget?: number // pago o ingreso único
  addPlayer?: SimPlayer // el jugador se une al primer equipo
  removePlayerId?: string // el jugador sale del club ahora
  leaveAtEndId?: string // el jugador se va cuando termine la temporada
}

export interface Notice {
  id: string
  kind: NoticeKind
  icon: string
  title: string
  text: string
  required: boolean // si es true, no se puede continuar sin responder
  options: NoticeOption[]
}

export interface EventStop {
  id: string
  name: string
  icon: string
  afterStop: BaseStopId // se evalúa al salir de esta parada base
  chance: number // 0 a 1. Provisorio: con el motor dependerá de lo que pase en el tramo
  intro: string
  notices: Notice[]
}

export const EVENT_STOPS: EventStop[] = [
  {
    id: 'oferta-record',
    name: 'Oferta récord',
    icon: '💸',
    afterStop: 'invierno',
    chance: 0.25,
    intro: 'Un club grande quiere a tu mejor jugador.',
    // El aviso real se arma con tu mejor jugador (ver notices.ts)
    notices: [
      {
        id: 'oferta-record',
        kind: 'oferta',
        icon: '💸',
        title: 'Oferta récord por tu estrella',
        text: 'Un club grande ofrece 1.500.000 € por tu mejor jugador.',
        required: true,
        options: [
          { id: 'aceptar', label: 'Aceptar la oferta', detail: 'Vendes y refuerzas las arcas', budget: 1_500_000 },
          { id: 'rechazar', label: 'Rechazar', detail: 'Tu estrella se queda' },
        ],
      },
    ],
  },
  {
    id: 'gala',
    name: 'Gala de premios',
    icon: '🏆',
    afterStop: 'cierre',
    chance: 1,
    intro: 'La liga entrega los premios de la temporada.',
    notices: [
      {
        id: 'gala',
        kind: 'evento',
        icon: '🏆',
        title: 'Gala de premios',
        text: 'La liga entrega los premios de la temporada. ¿Celebras con la afición?',
        required: false,
        options: [
          { id: 'fiesta', label: 'Celebrar con la afición', detail: 'Gasto único', budget: -50_000 },
          { id: 'sencilla', label: 'Gala sencilla', detail: 'Sin gastos extra' },
        ],
      },
    ],
  },
]

/* ---------- Inversiones ---------- */
export type InvestArea = 'scouts' | 'academy' | 'stadium'

export const LEVEL_NAMES = ['Mínimo', 'Básico', 'Alto', 'Máximo']

export const INVESTMENTS: Record<
  InvestArea,
  { label: string; icon: string; effect: string; costs: number[] }
> = {
  scouts: {
    label: 'Ojeadores',
    icon: '🔭',
    effect: 'Más probabilidad de encontrar al jugador que pides.',
    costs: [0, 100_000, 250_000, 500_000],
  },
  academy: {
    label: 'Cantera',
    icon: '🌱',
    effect: 'Juveniles con más potencial y más juveniles destacados cada año.',
    costs: [100_000, 250_000, 500_000, 900_000],
  },
  stadium: {
    label: 'Mantenimiento del estadio',
    icon: '🏟️',
    effect: 'Más ingresos por entradas.',
    costs: [100_000, 250_000, 400_000, 700_000],
  },
}

export const START_INVESTMENTS: Record<InvestArea, number> = { scouts: 1, academy: 1, stadium: 1 }

export const MISSION_COST = 60_000 // costo de enviar a los ojeadores

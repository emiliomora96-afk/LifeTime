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
    actions: 'Inversiones, ojeadores, cantera y mercado',
    duration: '60 a 90 s',
    round: 0,
  },
  {
    id: 'invierno',
    name: 'Invierno',
    when: 'A mitad de temporada',
    actions: 'Lesiones, contratos y ajustes de plantilla',
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
  salary?: number // cambio anual en la masa salarial
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
    notices: [
      {
        id: 'oferta-record',
        kind: 'oferta',
        icon: '💸',
        title: 'Oferta récord por tu estrella',
        text: 'CD Atalaya ofrece 1.500.000 € por tu mejor jugador.',
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

/* ---------- Inversiones y finanzas ---------- */
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
    effect: 'Más juveniles destacados cada año.',
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

// Cifras provisorias: se ajustan en el balance (Paso 11)
export const SALARY_BASE = 1_900_000
export const OTHER_INCOME = [
  { label: 'Patrocinios', amount: 1_100_000 },
  { label: 'Derechos de TV', amount: 700_000 },
  { label: 'Otros', amount: 200_000 },
]
export const TICKET_INCOME_BASE = 700_000
export const TICKET_INCOME_PER_LEVEL = 100_000

export const MISSION_COST = 60_000 // costo de enviar a los ojeadores
export const RENEWAL_RAISE = 40_000 // aumento anual al renovar
export const YOUTH_SALARY = 30_000 // salario anual de un juvenil promovido
export const NEW_SIGNING_SALARY = 50_000 // salario anual de un fichaje
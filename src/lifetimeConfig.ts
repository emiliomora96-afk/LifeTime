/* ==========================================================================
   LIFETIME · configuración de balance
   Todo lo que afecta al Val, la cantera, el desarrollo, el declive y el mercado vive aquí.
   Para ajustar el juego se toca SOLO este archivo (no hace falta entrar en la lógica).
   No importa nada del resto del proyecto: así cualquier módulo puede leerlo sin ciclos.
   ========================================================================== */

/* ---------- 0. Duración de la partida ---------- */
export const SEASON_OPTIONS = [30, 50, 100] as const
export type SeasonOption = (typeof SEASON_OPTIONS)[number]

/* ---------- 1. Distribución general de Val ---------- */
export const VAL_LIMITS = {
  maxRating: 99, // Val máximo posible
  topStarRating: 95, // desde este Val un jugador cuenta como "superestrella" (ya no hay tope por club)
  topStarPremium: 1.3, // las superestrellas cuestan un 30 % más (precio de mercado). 1 = sin sobrecosto
}

// Rangos objetivo (los usa la validación para avisar si algo se sale)
export const VAL_TARGETS = {
  div1StartersMean: [80, 85] as [number, number], // media de Val de los titulares de 1.ª
  div2StartersMean: [70, 78] as [number, number], // 2.ª y siguientes: bajan progresivamente
  // "poco comunes / muy raros", como porcentaje de los jugadores de plantilla de 1.ª división
  share85: [0.04, 0.25] as [number, number], // 85+ poco comunes
  share90: [0, 0.04] as [number, number], // 90+ muy raros
  share95: [0, 0.05] as [number, number], // 95+ rarísimos (hasta 5 % de 1.ª)
}

/* ---------- 1b. Punto de partida de los clubes ---------- */
export const START = {
  // Cuántos clubes por liga arrancan como ÉLITE (los N mejores de 1.ª). Solo define el punto de partida.
  eliteClubsPerLeague: 4,
  // Tamaño del "grupo de los mejores" que se usa para medir si un club pequeño llegó a gigante
  topGroupSize: 6,

  // Val medio de los titulares de cada división al empezar, y cuánto se separan los clubes entre sí
  // (1 = las diferencias del diseño original de clubs.ts; menos = clubes más parecidos).
  div1: { mean: 81.5, spread: 0.6 },
  div2: { mean: 73.5, spread: 0.6 },
  clubNoise: 0.8, // variación aleatoria del nivel de cada club al empezar
  starterSpread: 2.6, // dispersión del Val entre los titulares de un mismo club (antes 3)

  // Nivel con el que arranca el club del jugador (2.ª división, media-alta)
  userStartLevel: [72, 75] as [number, number],

  // Presupuesto, prestigio y cantera/estadio iniciales según el tipo de club.
  // elite = categoría de partida (gigantes). El resto son clubes normales: dinero moderado o bajo.
  profiles: {
    elite: { budget: 150_000_000, prestige: 70, academy: 3, stadium: 3 },
    grande: { budget: 30_000_000, prestige: 45, academy: 2, stadium: 2 },
    aspirante: { budget: 13_500_000, prestige: 30, academy: 2, stadium: 1 },
    media: { budget: 9_000_000, prestige: 20, academy: 1, stadium: 1 },
    modesto: { budget: 6_000_000, prestige: 12, academy: 1, stadium: 1 },
    ascendido: { budget: 4_500_000, prestige: 10, academy: 1, stadium: 1 },
  },
}

/* ---------- 2. Cantera según inversión ---------- */
// El índice es el nivel de inversión que ya usa el juego (0 Mínimo, 1 Básico, 2 Alto, 3 Máximo).
// Las tres inversiones del diseño son basica / alta / maxima. 'minima' es el nivel 0 que ya existía en la interfaz:
// no es una categoría nueva de diseño, solo evita romper el selector. La IA no la usa (salvo que el usuario la elija).
export interface AcademyTier {
  id: 'minima' | 'basica' | 'alta' | 'maxima'
  label: string
  mean: number // media del potencial sorteado
  sd: number // desviación típica
  min: number // rango permitido (mínimo)
  max: number // rango permitido (máximo)
  intake: [number, number] // canteranos nuevos por año (mínimo, máximo)
  cost: number // costo anual real que se descuenta del presupuesto
  gemCap: number // tope del potencial de una "joya inesperada"
}

export const ACADEMY_TIERS: AcademyTier[] = [
  { id: 'minima', label: 'Mínima', mean: 66, sd: 5, min: 50, max: 82, intake: [0, 1], cost: 300_000, gemCap: 90 },
  { id: 'basica', label: 'Básica', mean: 73, sd: 5, min: 55, max: 88, intake: [1, 2], cost: 750_000, gemCap: 95 },
  { id: 'alta', label: 'Alta', mean: 81, sd: 5, min: 60, max: 93, intake: [2, 3], cost: 2_500_000, gemCap: 95 },
  { id: 'maxima', label: 'Máxima', mean: 89, sd: 5, min: 70, max: 98, intake: [3, 4], cost: 6_000_000, gemCap: 98 },
]
export const ACADEMY_COSTS = ACADEMY_TIERS.map((t) => t.cost)

// Eventos raros por canterano (en cualquier nivel). Se sortean con una sola tirada: fracaso, joya o nada.
export const CANTERANO_EVENTS = {
  failChance: 0.065, // fracaso: 5-8 %
  failDrop: [10, 15] as [number, number], // puntos que baja el potencial
  gemChance: 0.03, // joya inesperada: 2-4 %
  gemBoost: [5, 8] as [number, number], // puntos que sube el potencial (con tope gemCap del nivel)
}

// Cuántos juveniles caben según el nivel de inversión (si hay plazas libres, llegan los del año)
export const ACADEMY_CAPACITY = [4, 7, 10, 14]
export const ACADEMY_MAX_AGE = 19 // a esta edad es su último año en la cantera
export const ACADEMY_ENTRY_AGE: [number, number] = [16, 18]

/* ---------- 3. Val inicial y desarrollo ---------- */
export const DEVELOPMENT = {
  entryGap: [10, 20] as [number, number], // el canterano llega entre 10 y 20 puntos por debajo de su potencial
  peakFactor: [0.85, 1.0] as [number, number], // fracción del potencial que acaba alcanzando (con azar)
  // Edad del pico (22 a 26) con pesos: lo más habitual es 24
  peakAgeWeights: { 22: 1, 23: 2, 24: 3, 25: 2, 26: 1 } as Record<number, number>,
  growthRate: [3, 5] as [number, number], // puntos por año mientras crece (con azar)
  growthEndAge: 24, // hasta los 22-24 (según su pico) crece a ritmo completo
  lateGrowth: 0.4, // entre esa edad y su pico crece más despacio
}

/* ---------- 4. Declive por edad (por posición) ---------- */
// [primera edad en que puede bajar, edad desde la que baja siempre]. Entre las dos, baja a veces.
export const DECLINE = {
  start: {
    DEL: [33, 34], // delanteros y extremos
    MED: [34, 34],
    DEF: [34, 35],
    POR: [37, 38],
  } as Record<'POR' | 'DEF' | 'MED' | 'DEL', [number, number]>,
  firstDrop: 1, // caída a la edad de inicio
  dropPerYear: 0.3, // cuánto crece la caída cada año de edad
  maxDrop: 3, // de -1 a -3 por año
  earlyChance: 0.12, // algunos bajan antes: probabilidad anual de caer 1 punto en los 2 años previos
  halfChance: 0.5, // entre la primera edad y la de caída segura
}

/* ---------- 5. Mercado y dinero ---------- */
export const MARKET = {
  // Valor de mercado = scale * (valor efectivo - ref) ^ exponent * factor de edad
  // valor efectivo = Val actual + peso(edad) * (potencial - Val actual)
  scale: 182,
  ref: 50,
  exponent: 3.2,
  minValue: 450_000,
  // cuánto pesa el potencial según la edad (a partir de 26 solo cuenta el Val actual)
  potentialWeight: { 16: 0.7, 17: 0.7, 18: 0.65, 19: 0.6, 20: 0.55, 21: 0.5, 22: 0.4, 23: 0.3, 24: 0.2, 25: 0.1 } as Record<number, number>,
  // el valor cae desde (edad de inicio del declive - ageGrace); cada año restante resta ageSlope
  ageGrace: 3,
  ageSlope: 0.14,
  ageFloor: 0.15,
  giantPrestige: 55, // un club con este prestigio o más pide más por sus jugadores (ya no depende de la etiqueta de élite)
  giantPremium: 1.3,
  quickSale: 0.85,
}

export const SALARY = {
  // sueldo anual = scale * (Val - base) ^ exponent. Curva empinada: las estrellas cuestan de retener.
  scale: 0.6,
  base: 45,
  exponent: 4,
  floor: 45_000,
  youth: { under20: 0.5, under23: 0.8 },
}

// Fichajes y juveniles de relleno de la IA: se calibran a la media actual de la liga (evita la inflación de Val)
export const SIGNING = {
  peakOffset: 1, // el pico de un fichaje nuevo = media de la liga + esto
  fillBelowClub: 3, // un relleno nace como mucho a (Val del once del club - esto)
  fillFloor: 58,
  yearlyBelowClub: 2,
}

// Cómo elige la IA su nivel de cantera según presupuesto (de arriba abajo; se toma el primero que cumpla)
export const AI_ACADEMY = {
  rules: [
    { level: 3, minBudget: 40_000_000, minPrestige: 45 },
    { level: 2, minBudget: 14_000_000, minPrestige: 20 },
    { level: 1, minBudget: -Infinity, minPrestige: 0 },
  ],
  keepFactor: 0.65, // si ya está en un nivel, lo conserva mientras tenga este % del mínimo (evita idas y vueltas)
}

// Mercado de la IA
export const AI_MARKET = {
  prospectWeight: 0.35, // cuánto vale para un club rico un joven con potencial por encima de su peor titular
  prospectMaxAge: 21,
  insolvency: -3_000_000, // por debajo de esto el club vende incluso titulares (el sueldo y el presupuesto frenan a las estrellas)
  surplusFrom: 50_000_000,
  surplusRate: 0.25,
  keepBenchValue: 0.4, // al recortar la plantilla pesa el potencial de los jóvenes
  wageShare: 0.8, // un club no ficha si su masa salarial pasaría de este % de sus ingresos (los sueldos frenan a las estrellas)
  forcedSaleShare: 0.4, // de lo que vale, un club solo cobra esta parte cuando vende a la fuerza (sueldos o deudas): evita que el dinero se dispare
  wageTolerance: 1.15, // si la masa salarial supera el límite en este factor, el club vende a su jugador mejor pagado
  stressSell: 0.8, // probabilidad de aceptar una oferta por un jugador cuando el club ya paga más sueldos de los que aguanta
  reserve: 1_800_000, // dinero que un club nunca gasta en fichajes...
  reservePerPrestige: 400_000, // ...más esto por cada punto de prestigio: los clubes grandes guardan un colchón para sostener su cantera y sus sueldos
}

// El prestigio de un club grande se va apagando si deja de estar arriba (así un gigante mal gestionado decae).
// Cada temporada que termina por debajo de afterPosition pierde round((prestigio - from) / divisor) puntos.
export const PRESTIGE_FADE = { from: 40, afterPosition: 7, divisor: 25 }

/* ---------- 6. Validación (simulación sin interfaz) ---------- */
export const SIM = {
  checkpoints: [1, 20, 50, 100],
  seed: 20260101,
  // una cohorte de canteranos cuenta como "terminada" si tiene 26 años o más, o ya salió del juego
  matureAge: 26,
  // un club no élite "llegó a gigante" de forma sostenida si estuvo al menos estas temporadas en el grupo de los mejores
  sustainedSeasons: 5,
}

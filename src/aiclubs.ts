import { INVESTMENTS } from './config'
import type { Level, SimTeam } from './engine'
import {
  LEAGUE_TITLE_PRIZE,
  OTHER_INCOME,
  POSITION_PRIZE_STEP,
  PRESTIGE_MAX,
  PRESTIGE_MIN,
  SPONSOR_BASE,
  SPONSOR_PER_PRESTIGE,
  STAFF_COST_BY_DIVISION,
  TICKETS_BASE,
  TICKETS_PER_STADIUM_LEVEL,
  TV_RIGHTS,
  prestigeChange,
} from './economy'
import { ACADEMY_MAX_AGE, ageAcademy, generateIntake } from './academy'
import type { SimPlayer } from './players'
import { marketValue, newSigning, playerSalary, potentialRange } from './players'
import { AI_ACADEMY, AI_MARKET, MARKET, SIGNING } from './lifetimeConfig'
import type { Rng } from './rng'
import { clamp, round1, shuffle } from './rng'
import type { Position } from './sample'
import {
  FORMATION_COUNT,
  MAX_SQUAD,
  POSITION_ORDER,
  SQUAD_TEMPLATE,
  pickStarters,
  progressSquad,
  squadStrength,
} from './squads'

/* ==========================================================================
   Paso 10: los clubes de la IA viven con las mismas reglas que el tuyo.
   Cobran, pagan sueldos, invierten en cantera, suben juveniles, fichan y venden.
   Todas las cifras de comportamiento están en este bloque.
   ========================================================================== */

/* ---------- Ajustes (todo configurable aquí) ---------- */
export const GIANT_PREMIUM = MARKET.giantPremium // los clubes con mucho prestigio piden más por sus jugadores
const RESERVE = AI_MARKET.reserve // dinero mínimo que un club nunca gasta en fichajes (crece con su prestigio, ver reserveOf)
const MIN_GAIN = 2 // un fichaje debe mejorar al menos 2 puntos a su peor titular de esa posición
const SELL_STARTER = 0.3 // probabilidad de que un club venda a uno de sus titulares si le pagan lo que pide
const SELL_BENCH = 0.9 // probabilidad de que venda a un suplente
const MAX_BUYS_SUMMER = 4
const MAX_BUYS_WINTER = 1
const SPEND_SUMMER = 0.55 // parte del dinero disponible que se puede gastar en el mercado de verano
const SPEND_WINTER = 0.35
// Los clubes con mucho dinero guardado lo destinan a infraestructura y dividendos: no acumulan sin límite
const SURPLUS_FROM = AI_MARKET.surplusFrom
const SURPLUS_RATE = AI_MARKET.surplusRate
const DEBT_FLOOR = -6_000_000 // un club en números rojos vende; nunca baja de esto
const QUICK_SALE = MARKET.quickSale
// Los fichajes baratos de relleno de la IA se calibran a la MEDIA ACTUAL de la liga (no a un número fijo ni al nivel
// de su propio equipo): así las valoraciones no se inflan ni se hunden con los años.
export function leagueMean(teams: Pick<SimTeam, 'strength'>[]): number {
  return teams.length === 0 ? 70 : teams.reduce((sum, t) => sum + t.strength, 0) / teams.length
}

// Nivel al que nace un fichaje de relleno de un club: cerca de su once, sin pasar de la media de la liga
export function fillLevel(team: Pick<SimTeam, 'strength'>, ref: number, below: number = SIGNING.fillBelowClub): number {
  return clamp(team.strength - below, SIGNING.fillFloor, Math.max(SIGNING.fillFloor, ref))
}
const BEST_PROSPECT_NEWS = 84 // potencial a partir del cual una promoción de cantera sale en las noticias
const SELL_PROSPECT_VALUE = 1_200_000 // un canterano de 19 años que vale al menos esto sube al primer equipo para poder venderlo

export interface MoveNews {
  kind: 'fichaje' | 'cantera'
  window: 'verano' | 'invierno'
  season: number // temporada en la que ocurre
  player: string
  pos: Position
  age: number
  rating: number
  to: string
  from?: string // solo en fichajes
  fee?: number // solo en fichajes
}

// Colchón que el club no toca al fichar: los clubes con prestigio guardan más (sueldos y cantera dependen de él)
function reserveOf(team: Pick<SimTeam, 'prestige'>): number {
  return RESERVE + (team.prestige ?? 0) * AI_MARKET.reservePerPrestige
}

function roundK(n: number): number {
  return Math.round(n / 1000) * 1000
}

// Pide más el club con prestigio (no la etiqueta de "élite" del inicio: un gigante venido a menos ya no cobra de más)
export function askingPriceFor(p: SimPlayer, seller: Pick<SimTeam, 'prestige'>): number {
  return roundK(marketValue(p) * ((seller.prestige ?? 0) >= MARKET.giantPrestige ? GIANT_PREMIUM : 1))
}

/* ---------- Finanzas (las mismas fórmulas que el club del jugador) ---------- */
export function aiFinance(team: SimTeam, division: Level, position: number): { income: number; expenses: number } {
  const stadium = team.stadiumLevel ?? 1
  const academy = team.academyLevel ?? 1
  const prestige = team.prestige ?? 10
  let income =
    TICKETS_BASE[division] +
    TICKETS_PER_STADIUM_LEVEL[division] * stadium +
    SPONSOR_BASE[division] +
    SPONSOR_PER_PRESTIGE * prestige +
    TV_RIGHTS[division] +
    Math.max(0, 21 - position) * POSITION_PRIZE_STEP[division] +
    OTHER_INCOME[division]
  if (position === 1) income += LEAGUE_TITLE_PRIZE[division]
  const expenses =
    team.squad.reduce((sum, p) => sum + playerSalary(p), 0) +
    STAFF_COST_BY_DIVISION[division] +
    INVESTMENTS.academy.costs[academy] +
    INVESTMENTS.stadium.costs[stadium] +
    Math.max(0, (team.budget ?? 0) - SURPLUS_FROM) * SURPLUS_RATE
  return { income, expenses }
}

// Un club elige su nivel de cantera según su presupuesto y su prestigio: los pobres no pueden estar en Máxima.
// Si ya está en un nivel lo conserva mientras no se quede muy por debajo del mínimo (evita idas y vueltas).
export function desiredAcademy(prestige: number, budget: number, current: number = 1): number {
  const fits = (r: { minBudget: number; minPrestige: number }, k: number) =>
    budget >= r.minBudget * k && prestige >= r.minPrestige * k
  for (const r of AI_ACADEMY.rules) {
    if (fits(r, 1) || (r.level <= current && r.level > 0 && fits(r, AI_ACADEMY.keepFactor))) return r.level
  }
  return 1
}

/* ---------- Un año más para un club de la IA ---------- */
export interface AiYearInfo {
  ref?: number // media actual de la liga (Val del once): a ella se calibran los fichajes de relleno
  division: Level // división en la que jugó la temporada que acaba de terminar
  position: number
  promoted: boolean
  relegated: boolean
  newDivision: Level
  year: number // temporada que empieza
}

function weakestStarter(squad: SimPlayer[], pos: Position): number {
  const sorted = squad
    .filter((p) => p.pos === pos)
    .map((p) => p.rating)
    .sort((a, b) => b - a)
  return sorted[FORMATION_COUNT[pos] - 1] ?? 40
}

export function evolveAiTeam(team: SimTeam, info: AiYearInfo, rng: Rng, news: MoveNews[]): SimTeam {
  // 1. Dinero y prestigio de la temporada que termina
  const { income, expenses } = aiFinance(team, info.division, info.position)
  const budget = Math.max(DEBT_FLOOR, Math.round((team.budget ?? 0) + income - expenses))
  const prestige = clamp(
    (team.prestige ?? 10) +
      prestigeChange({
        promoted: info.promoted,
        relegated: info.relegated,
        champion: info.position === 1,
        position: info.position,
        prestige: team.prestige ?? 10,
      }),
    PRESTIGE_MIN,
    PRESTIGE_MAX,
  )
  const academyLevel = desiredAcademy(prestige, budget, team.academyLevel ?? 1)

  // 2. La cantera: suben al primer equipo los que pueden llegar a titulares; los de 19 años que no valen se van
  const strength = team.strength
  const promoted: SimPlayer[] = []
  let youths = team.academy ?? []
  for (const y of [...youths].sort((a, b) => potentialRange(b)[1] - potentialRange(a)[1])) {
    const [lo, hi] = potentialRange(y)
    const expected = (lo + hi) / 2
    const canStart = y.rating >= weakestStarter(team.squad, y.pos) - 3
    const promising = expected >= strength - 2.5
    const lastYear = y.age >= ACADEMY_MAX_AGE
    // También suben los que valen dinero aunque aún no sean titulares: así el club puede venderlos (la cantera da beneficio)
    const sellable = lastYear && marketValue(y) >= SELL_PROSPECT_VALUE
    if ((promising && (y.age >= 18 || canStart)) || (lastYear && expected >= strength - 6) || sellable) {
      promoted.push({ ...y, starter: false })
      if (hi >= BEST_PROSPECT_NEWS) {
        news.push({ kind: 'cantera', window: 'verano', season: info.year, player: y.name, pos: y.pos, age: y.age, rating: y.rating, to: team.name })
      }
    }
  }
  youths = youths.filter((y) => !promoted.some((p) => p.id === y.id))

  // 3. Un año más para la plantilla (los clubes de la IA reponen huecos con fichajes baratos)
  const squad = progressSquad(
    [...team.squad, ...promoted],
    {
      level: fillLevel(team, info.ref ?? team.strength, SIGNING.yearlyBelowClub),
      youthBonus: 0,
      useYouth: false,
      removeIds: [],
      idPrefix: `t${team.id}-y${info.year}`,
    },
    rng,
  )

  // 4. La cantera crece y llegan juveniles nuevos
  const aged = ageAcademy(youths, rng, academyLevel)
  const intake = generateIntake(aged, academyLevel, strength, info.year, rng, `t${team.id}`)
  const newStrength = squadStrength(squad)

  return {
    ...team,
    squad,
    strength: newStrength,
    level: round1(newStrength),
    form: 0,
    tactic: 'equilibrada',
    budget,
    prestige,
    academyLevel,
    academy: [...aged, ...intake],
  }
}

/* ---------- Mercado de la IA ---------- */
function refresh(team: SimTeam): void {
  team.squad = pickStarters(team.squad)
  team.strength = squadStrength(team.squad)
  team.level = round1(team.strength)
}

// Si el club queda corto en una posición, ficha un reemplazo barato
function refill(team: SimTeam, pos: Position, rng: Rng, tag: string, n: number, ref: number): void {
  while (team.squad.filter((p) => p.pos === pos).length < SQUAD_TEMPLATE[pos]) {
    team.squad.push(newSigning(`t${team.id}-w${tag}-${n++}`, pos, fillLevel(team, ref), rng))
  }
}

function releaseWorst(team: SimTeam): void {
  while (team.squad.length > MAX_SQUAD) {
    const out = team.squad
      .filter((p) => !p.starter && team.squad.filter((q) => q.pos === p.pos).length > SQUAD_TEMPLATE[p.pos])
      .sort(
        (a, b) =>
          a.rating + (a.peak - a.rating) * AI_MARKET.keepBenchValue - (b.rating + (b.peak - b.rating) * AI_MARKET.keepBenchValue) ||
          a.id.localeCompare(b.id),
      )[0]
    if (!out) break
    team.squad = team.squad.filter((p) => p.id !== out.id)
  }
}

export interface WindowOptions {
  window: 'verano' | 'invierno'
  season: number
  tag: string
  divisionOf?: Record<number, Level> // división de cada club: con ella la IA vigila que los sueldos no superen sus ingresos
}

export interface WindowResult {
  teams: SimTeam[]
  news: MoveNews[]
}

// Una ventana de fichajes entre los clubes de la IA (el club del jugador no entra: él negocia por su cuenta)
export function aiTransferWindow(input: SimTeam[], rng: Rng, o: WindowOptions): WindowResult {
  const summer = o.window === 'verano'
  const teams = input.map((t) => ({ ...t, squad: [...t.squad] }))
  const news: MoveNews[] = []
  const moved = new Set<string>()
  let counter = 0
  const ref = leagueMean(teams) // media actual de la liga: a ella se calibran los fichajes de relleno

  // Sueldos: cada club aguanta una masa salarial de un % de sus ingresos. Fichar por encima no se puede,
  // y un club que ya se pasa acepta con más facilidad las ofertas por sus jugadores caros.
  const payroll = (t: SimTeam) => t.squad.reduce((sum, p) => sum + playerSalary(p), 0)
  const wageCap = new Map<number, number>()
  if (o.divisionOf) {
    for (const t of teams) wageCap.set(t.id, aiFinance(t, o.divisionOf[t.id] ?? 1, 10).income * AI_MARKET.wageShare)
  }
  const stressed = new Set<number>()
  const restress = (t: SimTeam) => {
    const cap = wageCap.get(t.id)
    if (cap !== undefined && payroll(t) > cap) stressed.add(t.id)
    else stressed.delete(t.id)
  }
  for (const t of teams) restress(t)
  // Un club que no puede pagar sus sueldos vende a su jugador mejor pagado (freno natural a las estrellas)
  for (const t of teams) {
    const cap = wageCap.get(t.id)
    if (cap === undefined) continue
    while (payroll(t) > cap * AI_MARKET.wageTolerance) {
      const sale = t.squad
        .filter((p) => t.squad.filter((q) => q.pos === p.pos).length > FORMATION_COUNT[p.pos] + 1)
        .sort((a, b) => playerSalary(b) - playerSalary(a))[0]
      if (!sale) break
      t.budget = (t.budget ?? 0) + roundK(marketValue(sale) * QUICK_SALE * AI_MARKET.forcedSaleShare)
      t.squad = t.squad.filter((p) => p.id !== sale.id)
      refill(t, sale.pos, rng, o.tag, counter++, ref)
      refresh(t)
    }
    restress(t)
  }

  // Los clubes en números rojos venden a sus suplentes más valiosos
  for (const t of teams) {
    while ((t.budget ?? 0) < 0) {
      const sale = t.squad
        .filter((p) => !p.starter && t.squad.filter((q) => q.pos === p.pos).length > SQUAD_TEMPLATE[p.pos])
        .sort((a, b) => marketValue(b) - marketValue(a))[0]
      if (!sale) break
      t.budget = (t.budget ?? 0) + roundK(marketValue(sale) * QUICK_SALE * AI_MARKET.forcedSaleShare)
      t.squad = t.squad.filter((p) => p.id !== sale.id)
    }
    // Freno natural a las estrellas: si el club está arruinado y ya no le quedan suplentes que vender, vende a su jugador más caro
    // (los sueldos y el presupuesto mandan, no un tope fijo por categoría)
    while ((t.budget ?? 0) < AI_MARKET.insolvency) {
      const sale = t.squad
        .filter((p) => t.squad.filter((q) => q.pos === p.pos).length > FORMATION_COUNT[p.pos] + 1)
        .sort((a, b) => marketValue(b) - marketValue(a))[0]
      if (!sale) break
      t.budget = (t.budget ?? 0) + roundK(marketValue(sale) * QUICK_SALE * AI_MARKET.forcedSaleShare)
      t.squad = t.squad.filter((p) => p.id !== sale.id)
      refill(t, sale.pos, rng, o.tag, counter++, ref)
      refresh(t)
    }
  }

  const maxCap = summer ? MAX_BUYS_SUMMER : MAX_BUYS_WINTER
  const share = summer ? SPEND_SUMMER : SPEND_WINTER

  for (const buyer of shuffle(teams, rng)) {
    const buys = Math.min(maxCap, 1 + Math.floor(Math.max(0, buyer.budget ?? 0) / 18_000_000))
    for (let k = 0; k < buys; k++) {
      if (!summer && buyer.squad.length >= MAX_SQUAD) break
      const spendable = ((buyer.budget ?? 0) - reserveOf(buyer)) * share
      if (spendable < 450_000) break

      const cap = wageCap.get(buyer.id)
      const wages = cap === undefined ? 0 : payroll(buyer)
      const weak = {} as Record<Position, number>
      for (const pos of POSITION_ORDER) weak[pos] = weakestStarter(buyer.squad, pos)

      let best: { seller: SimTeam; player: SimPlayer; price: number; score: number } | null = null
      for (const seller of teams) {
        if (seller.id === buyer.id) continue
        for (const p of seller.squad) {
          if (p.age >= 33 || moved.has(p.id)) continue
          const price = askingPriceFor(p, seller)
          if (price > spendable) continue
          if (cap !== undefined && wages + playerSalary(p) > cap) continue // sus sueldos no lo aguantan
          let gain = p.rating - weak[p.pos]
          if (p.age <= 22) {
            const hi = potentialRange(p)[1]
            const mid = (p.rating + hi) / 2
            gain = Math.max(gain, 0.5 * (mid - weak[p.pos]))
            // Los clubes con dinero también compran promesas: el talento de los clubes pequeños se vende bien
            if (p.age <= AI_MARKET.prospectMaxAge) gain = Math.max(gain, AI_MARKET.prospectWeight * (hi - weak[p.pos]))
          }
          if (gain < MIN_GAIN) continue
          const score = gain - (price / spendable) * 1.5
          if (best && score <= best.score) continue
          // El vendedor solo acepta a veces: los titulares cuestan más de convencer
          const starterThere = seller.squad
            .filter((q) => q.pos === p.pos)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, FORMATION_COUNT[p.pos])
            .some((q) => q.id === p.id)
          const accept = starterThere ? SELL_STARTER : SELL_BENCH
          if (rng() >= (stressed.has(seller.id) ? Math.max(accept, AI_MARKET.stressSell) : accept)) continue
          best = { seller, player: p, price, score }
        }
      }
      if (!best) break

      const { seller, player, price } = best
      seller.squad = seller.squad.filter((p) => p.id !== player.id)
      seller.budget = (seller.budget ?? 0) + price
      refill(seller, player.pos, rng, o.tag, counter++, ref)
      refresh(seller)
      buyer.squad.push({ ...player, starter: false, starts: 0 })
      buyer.budget = (buyer.budget ?? 0) - price
      if (summer) releaseWorst(buyer)
      refresh(buyer)
      moved.add(player.id)
      restress(seller)
      restress(buyer)
      news.push({
        kind: 'fichaje',
        window: o.window,
        season: o.season,
        player: player.name,
        pos: player.pos,
        age: player.age,
        rating: player.rating,
        from: seller.name,
        to: buyer.name,
        fee: price,
      })
    }
  }

  news.sort((a, b) => (b.fee ?? 0) - (a.fee ?? 0))
  return { teams, news: news.slice(0, 12) }
}

import { EVENT_STOPS } from './config'
import type { Notice, NoticeOption } from './config'
import { formatMoney } from './data'
import { getUserSquad } from './engine'
import type { SimPlayer } from './players'
import { generateScoutTarget, marketValue, playerSalary, potentialLabel } from './players'
import { clamp } from './rng'
import type { GameState, ScoutOrder } from './game'

function tag(game: GameState): string {
  return `${game.season}-${game.eventId ?? game.baseStop}`
}

function describe(p: SimPlayer): string {
  return `${p.pos}, ${p.age} años, valoración ${p.rating}, potencial ${potentialLabel(p)}`
}

// Prima de renovación: medio sueldo anual
function bonus(p: SimPlayer): number {
  return Math.round((playerSalary(p) * 0.5) / 1000) * 1000
}

// Elige un jugador al azar entre los que aún no aparecen en otro aviso
function pickFrom(pool: SimPlayer[], used: Set<string>, rng: () => number): SimPlayer | undefined {
  const free = pool.filter((p) => !used.has(p.id))
  if (free.length === 0) return undefined
  const chosen = free[Math.floor(rng() * free.length)]
  used.add(chosen.id)
  return chosen
}

// Probabilidad de que los ojeadores encuentren lo que pides
export function scoutChance(level: number, order: ScoutOrder): number {
  const width = order.ageMax - order.ageMin
  let chance =
    0.55 + 0.1 * level - (order.minRating - 60) * 0.012 - (order.minPotential - 65) * 0.008
  if (width <= 2) chance -= 0.15
  else if (width <= 5) chance -= 0.07
  return clamp(chance, 0.1, 0.9)
}

function injuryNotice(game: GameState, squad: SimPlayer[], used: Set<string>, rng: () => number): Notice | null {
  if (rng() >= 0.5) return null
  const p = pickFrom(squad.filter((q) => q.starter), used, rng)
  if (!p) return null
  const rounds = 3 + Math.floor(rng() * 10)
  const options: NoticeOption[] = squad
    .filter((s) => !s.starter && s.pos === p.pos)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2)
    .map((s) => ({
      id: `sub-${s.id}`,
      label: `Sustituirlo por ${s.name}`,
      detail: `${s.pos}, ${s.age} años, valoración ${s.rating}`,
    }))
  options.push({ id: 'auto', label: 'Que decida el entrenador', detail: 'Elige al mejor suplente disponible' })
  return {
    id: `${tag(game)}-lesion-${p.id}`,
    kind: 'lesion',
    icon: '🤕',
    title: `${p.name} se lesionó`,
    text: `${describe(p)}. Estará fuera unas ${rounds} jornadas. ¿Quién lo sustituye?`,
    required: true,
    options,
  }
}

function contractNotices(game: GameState, squad: SimPlayer[], used: Set<string>, rng: () => number): Notice[] {
  const notices: Notice[] = []
  for (let i = 0; i < 2; i++) {
    const p = pickFrom(squad, used, rng)
    if (!p) break
    notices.push({
      id: `${tag(game)}-contrato-${p.id}`,
      kind: 'contrato',
      icon: '📝',
      title: `${p.name}: su contrato termina esta temporada`,
      text: `${describe(p)}. Decide ahora si se queda o se va cuando acabe la temporada.`,
      required: true,
      options: [
        {
          id: 'renovar',
          label: 'Renovar el contrato',
          detail: `Prima de renovación de ${formatMoney(bonus(p))} (cobra ${formatMoney(playerSalary(p))} al año)`,
          budget: -bonus(p),
        },
        {
          id: 'dejar',
          label: 'Dejar que se vaya al terminar',
          detail: 'Tendrás que buscar reemplazo',
          leaveAtEndId: p.id,
        },
      ],
    })
  }
  return notices
}

function leaveNotice(game: GameState, squad: SimPlayer[], used: Set<string>, rng: () => number): Notice | null {
  if (rng() >= 0.25) return null
  const p = pickFrom(squad.filter((q) => q.starter), used, rng)
  if (!p) return null
  const fee = Math.round((marketValue(p) * 0.7) / 10_000) * 10_000
  return {
    id: `${tag(game)}-salida-${p.id}`,
    kind: 'salida',
    icon: '🚪',
    title: `${p.name} quiere irse del club`,
    text: `${describe(p)}. Dice que busca un nuevo reto.`,
    required: true,
    options: [
      {
        id: 'convencer',
        label: 'Convencerlo con un mejor contrato',
        detail: `Prima de ${formatMoney(bonus(p) * 2)}`,
        budget: -bonus(p) * 2,
      },
      {
        id: 'vender',
        label: 'Venderlo ahora',
        detail: `Ingresas ${formatMoney(fee)}`,
        budget: fee,
        removePlayerId: p.id,
      },
      {
        id: 'dejar',
        label: 'Dejarlo marchar al final de la temporada',
        detail: 'Sin ingreso',
        leaveAtEndId: p.id,
      },
    ],
  }
}

function scoutNotice(game: GameState, rng: () => number): Notice | null {
  const order = game.scoutOrder
  if (!order) return null
  const id = `${tag(game)}-ojeadores`
  const ages = `${order.ageMin} a ${order.ageMax} años`
  const target = rng() < scoutChance(game.investments.scouts, order)
    ? generateScoutTarget(order, `u-s-${tag(game)}`, rng)
    : null

  if (!target) {
    return {
      id,
      kind: 'ojeadores',
      icon: '🔭',
      title: 'Los ojeadores vuelven sin resultados',
      text: `No encontraron a ningún ${order.pos} de ${ages} con valoración ${order.minRating}+ y potencial ${order.minPotential}+. Puedes intentarlo de nuevo con otros requisitos.`,
      required: false,
      options: [{ id: 'ok', label: 'Entendido' }],
    }
  }

  const price = marketValue(target)
  return {
    id,
    kind: 'ojeadores',
    icon: '🔭',
    title: `Los ojeadores encontraron a ${target.name}`,
    text: `${describe(target)}. Su club pide ${formatMoney(price)}.`,
    required: false,
    options: [
      {
        id: 'fichar',
        label: 'Ficharlo',
        detail: `${formatMoney(price)} y cobra ${formatMoney(playerSalary(target))} al año`,
        budget: -price,
        addPlayer: target,
      },
      { id: 'descartar', label: 'Descartarlo' },
    ],
  }
}

// Oferta récord: por tu mejor jugador
function recordOfferNotices(game: GameState, squad: SimPlayer[]): Notice[] {
  const best = [...squad].sort((a, b) => b.rating - a.rating)[0]
  if (!best) return []
  const offer = Math.round((marketValue(best) * 1.4) / 10_000) * 10_000
  return [
    {
      id: `${tag(game)}-oferta-record`,
      kind: 'oferta',
      icon: '💸',
      title: `Oferta récord por ${best.name}`,
      text: `${describe(best)}. Un club grande ofrece ${formatMoney(offer)}.`,
      required: true,
      options: [
        {
          id: 'aceptar',
          label: 'Aceptar la oferta',
          detail: 'Vendes y refuerzas las arcas',
          budget: offer,
          removePlayerId: best.id,
        },
        { id: 'rechazar', label: 'Rechazar', detail: 'Tu estrella se queda' },
      ],
    },
  ]
}

export function buildNotices(game: GameState, rng: () => number): Notice[] {
  const squad = getUserSquad(game.league)

  if (game.eventId !== null) {
    if (game.eventId === 'oferta-record') return recordOfferNotices(game, squad)
    const ev = EVENT_STOPS.find((e) => e.id === game.eventId)
    return ev ? ev.notices : []
  }

  const used = new Set<string>()
  const list: (Notice | null)[] = []
  if (game.baseStop === 'verano') {
    list.push(scoutNotice(game, rng))
    list.push(leaveNotice(game, squad, used, rng))
  } else if (game.baseStop === 'invierno') {
    list.push(injuryNotice(game, squad, used, rng))
    list.push(scoutNotice(game, rng))
    list.push(...contractNotices(game, squad, used, rng))
    list.push(leaveNotice(game, squad, used, rng))
  } else {
    list.push(injuryNotice(game, squad, used, rng))
    list.push(scoutNotice(game, rng))
    list.push(leaveNotice(game, squad, used, rng))
  }
  return list.filter((n): n is Notice => n !== null)
}

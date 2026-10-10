import { EVENT_STOPS, NEW_SIGNING_SALARY, RENEWAL_RAISE, YOUTH_SALARY } from './config'
import type { Notice, NoticeOption } from './config'
import { formatMoney } from './data'
import { PROSPECTS, STARTERS, SUBS } from './sample'
import type { GameState, ScoutOrder } from './game'

const FIRST = ['Adrián', 'Bruno', 'Carlos', 'Darío', 'Emilio', 'Félix', 'Gonzalo', 'Héctor', 'Íñigo', 'Julio', 'Kiko', 'Lucas', 'Marco', 'Néstor', 'Óscar', 'Pedro', 'Quique', 'Rodrigo', 'Sergio', 'Teo']
const LAST = ['Arteaga', 'Bermejo', 'Cabrera', 'Duarte', 'Escalante', 'Fontán', 'Galindo', 'Heredia', 'Iglesias', 'Jaramillo', 'Lozano', 'Navarrete', 'Ordóñez', 'Palacios', 'Quintero', 'Ramos', 'Salvatierra', 'Urrutia', 'Vallejo', 'Zamora']

function pick<T>(list: T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)]
}

function pickMany<T>(list: T[], n: number, rng: () => number): T[] {
  const copy = [...list]
  const out: T[] = []
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0])
  }
  return out
}

function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function tag(game: GameState): string {
  return `${game.season}-${game.eventId ?? game.baseStop}`
}

// Probabilidad de que los ojeadores encuentren lo que pides
export function scoutChance(level: number, order: ScoutOrder): number {
  const raw = 0.5 + 0.12 * level - (order.minRating - 60) * 0.015 - (order.minPotential - 1) * 0.04
  return Math.max(0.1, Math.min(0.9, raw))
}

function youthNotices(game: GameState, rng: () => number): Notice[] {
  const count = 1 + (game.investments.academy >= 2 ? 1 : 0)
  return pickMany(PROSPECTS, count, rng).map((p) => ({
    id: `${tag(game)}-cantera-${p.id}`,
    kind: 'cantera' as const,
    icon: '🌱',
    title: `${p.name} destaca en la cantera`,
    text: `${p.pos} de ${p.age} años, valoración ${p.rating}, potencial ${stars(p.potential)}. ¿Lo subes al primer equipo?`,
    required: false,
    options: [
      {
        id: 'subir',
        label: 'Subirlo al primer equipo',
        detail: `Ficha profesional: +${formatMoney(YOUTH_SALARY)} al año en salarios`,
        salary: YOUTH_SALARY,
      },
      { id: 'seguir', label: 'Que siga madurando en la cantera', detail: 'Sin costo' },
    ],
  }))
}

function injuryNotice(game: GameState, rng: () => number): Notice | null {
  if (rng() >= 0.5) return null
  const p = pick(STARTERS, rng)
  const rounds = 3 + Math.floor(rng() * 10)
  const options: NoticeOption[] = SUBS.filter((s) => s.pos === p.pos)
    .slice(0, 2)
    .map((s) => ({
      id: `sub-${s.id}`,
      label: `Sustituirlo por ${s.name}`,
      detail: `${s.pos}, valoración ${s.rating}`,
    }))
  options.push({ id: 'auto', label: 'Que decida el entrenador', detail: 'Elige al mejor suplente disponible' })
  return {
    id: `${tag(game)}-lesion-${p.id}`,
    kind: 'lesion',
    icon: '🤕',
    title: `${p.name} se lesionó`,
    text: `${p.pos}, valoración ${p.rating}. Estará fuera unas ${rounds} jornadas. ¿Quién lo sustituye?`,
    required: true,
    options,
  }
}

function contractNotices(game: GameState, rng: () => number): Notice[] {
  return pickMany(STARTERS, 2, rng).map((p) => ({
    id: `${tag(game)}-contrato-${p.id}`,
    kind: 'contrato' as const,
    icon: '📝',
    title: `${p.name}: su contrato termina esta temporada`,
    text: `${p.pos} de ${p.age} años, valoración ${p.rating}. Decide ahora si se queda o se va cuando acabe la temporada.`,
    required: true,
    options: [
      {
        id: 'renovar',
        label: 'Renovar el contrato',
        detail: `Pide +${formatMoney(RENEWAL_RAISE)} al año en salarios`,
        salary: RENEWAL_RAISE,
      },
      { id: 'dejar', label: 'Dejar que se vaya al terminar', detail: 'Tendrás que buscar reemplazo' },
    ],
  }))
}

function leaveNotice(game: GameState, rng: () => number): Notice | null {
  if (rng() >= 0.25) return null
  const p = pick(STARTERS, rng)
  const fee = (p.rating - 55) * 30_000
  return {
    id: `${tag(game)}-salida-${p.id}`,
    kind: 'salida',
    icon: '🚪',
    title: `${p.name} quiere irse del club`,
    text: `${p.pos}, valoración ${p.rating}. Dice que busca un nuevo reto.`,
    required: true,
    options: [
      {
        id: 'convencer',
        label: 'Convencerlo con un mejor contrato',
        detail: `+${formatMoney(80_000)} al año en salarios`,
        salary: 80_000,
      },
      {
        id: 'vender',
        label: 'Venderlo ahora',
        detail: `Ingresas ${formatMoney(fee)}`,
        budget: fee,
      },
      { id: 'dejar', label: 'Dejarlo marchar al final de la temporada', detail: 'Sin ingreso' },
    ],
  }
}

function scoutNotice(game: GameState, rng: () => number): Notice | null {
  const order = game.scoutOrder
  if (!order) return null
  const id = `${tag(game)}-ojeadores`
  if (rng() >= scoutChance(game.investments.scouts, order)) {
    return {
      id,
      kind: 'ojeadores',
      icon: '🔭',
      title: 'Los ojeadores vuelven sin resultados',
      text: `No encontraron a ningún ${order.pos} con valoración ${order.minRating}+ y potencial ${order.minPotential}+. Puedes intentarlo de nuevo con otros requisitos.`,
      required: false,
      options: [{ id: 'ok', label: 'Entendido' }],
    }
  }
  const rating = Math.min(95, order.minRating + Math.floor(rng() * 5))
  const potential = Math.min(5, order.minPotential + Math.floor(rng() * 2))
  const age = 18 + Math.floor(rng() * 14)
  const price = Math.max(150_000, (rating - 55) * 40_000 + potential * 60_000)
  const name = `${pick(FIRST, rng)} ${pick(LAST, rng)}`
  return {
    id,
    kind: 'ojeadores',
    icon: '🔭',
    title: `Los ojeadores encontraron a ${name}`,
    text: `${order.pos} de ${age} años, valoración ${rating}, potencial ${stars(potential)}. Su club pide ${formatMoney(price)}.`,
    required: false,
    options: [
      {
        id: 'fichar',
        label: 'Ficharlo',
        detail: `${formatMoney(price)} y +${formatMoney(NEW_SIGNING_SALARY)} al año en salario`,
        budget: -price,
        salary: NEW_SIGNING_SALARY,
      },
      { id: 'descartar', label: 'Descartarlo' },
    ],
  }
}

export function buildNotices(game: GameState, rng: () => number): Notice[] {
  if (game.eventId !== null) {
    const ev = EVENT_STOPS.find((e) => e.id === game.eventId)
    return ev ? ev.notices : []
  }

  const list: (Notice | null)[] = []
  if (game.baseStop === 'verano') {
    list.push(scoutNotice(game, rng))
    list.push(...youthNotices(game, rng))
    list.push(leaveNotice(game, rng))
  } else if (game.baseStop === 'invierno') {
    list.push(injuryNotice(game, rng))
    list.push(scoutNotice(game, rng))
    list.push(...contractNotices(game, rng))
    list.push(leaveNotice(game, rng))
  } else {
    list.push(injuryNotice(game, rng))
    list.push(scoutNotice(game, rng))
    list.push(...youthNotices(game, rng))
    list.push(leaveNotice(game, rng))
  }
  return list.filter((n): n is Notice => n !== null)
}
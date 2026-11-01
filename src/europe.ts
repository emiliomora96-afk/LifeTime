import type { LeagueState, SimTeam } from './engine'
import { USER_ID, computeTable } from './engine'
import type { Rng } from './rng'
import { clamp, createRng, normal } from './rng'
import { activeLeague } from './activeLeague'
import { LEAGUES, LEAGUE_IDS } from './leagues'
import type { LeagueDef } from './leagues'

/* ---------- Competiciones europeas (todo configurable aquí) ---------- */
// La Lifetime Champions League tiene formato propio (36 clubes, fase de liga y eliminatorias: champions.ts).
// Se distingue de la Lifetime Europa League, que es otro título europeo. Los nombres se cambian solo en este bloque.
export type EuropeId = 'champions' | 'europa' | 'conferencia'
export type EuropeTitleId = EuropeId | 'supercopa'

export interface EuropeCompetition {
  id: EuropeId
  name: string
  short: string
  icon: string
  positions: number[] // posiciones de 1.ª división que clasifican (1 = campeón de liga)
  fieldSize: number // clubes del torneo
  invitedLevel: number // nivel medio de los clubes invitados
  invitedSpread: number // cuánto varía el nivel entre invitados
}

// Mismo método para las tres: la posición final en la 1.ª división
export const EUROPE: EuropeCompetition[] = [
  { id: 'champions', name: 'Lifetime Champions League', short: 'Champions', icon: '🏆', positions: [1, 2, 3, 4], fieldSize: 36, invitedLevel: 78, invitedSpread: 3.6 },
  { id: 'europa', name: 'Lifetime Europa League', short: 'Europa', icon: '🌍', positions: [5, 6], fieldSize: 16, invitedLevel: 75, invitedSpread: 3 },
  { id: 'conferencia', name: 'Copa Horizonte', short: 'Horizonte', icon: '🌅', positions: [7], fieldSize: 16, invitedLevel: 72, invitedSpread: 3 },
]

// La Supercopa no clasifica por posición: la juegan los campeones de estas dos competiciones (Paso 9)
export const SUPERCUP = {
  id: 'supercopa' as const,
  name: 'Supercopa Continental',
  icon: '⭐',
  between: ['champions', 'europa'] as EuropeId[],
}

export const EUROPE_IDS: EuropeId[] = EUROPE.map((c) => c.id)

export function europeInfo(id: EuropeId): EuropeCompetition {
  return EUROPE.find((c) => c.id === id) ?? EUROPE[0]
}

// A qué competición lleva una posición de 1.ª división (null si no clasifica)
export function qualifyFor(position: number): EuropeId | null {
  return EUROPE.find((c) => c.positions.includes(position))?.id ?? null
}

export const QUALIFIED_POSITIONS = EUROPE.reduce((n, c) => n + c.positions.length, 0)

/* ---------- Clubes participantes ---------- */
export interface Entrant {
  id: string
  name: string // vacío en el club del jugador (se muestra el nombre de su club)
  country: string
  level: number // fuerza con la que juega el torneo
  colors: [string, string]
  user?: boolean
}

export interface EuropeSeason {
  season: number // temporada en la que se juega
  user: EuropeId | null // competición del club del jugador, si clasificó
  fields: Record<EuropeId, Entrant[]>
}

export function entrantName(e: Entrant, clubName: string): string {
  return e.user ? clubName : e.name
}

/* ---------- Clubes invitados ---------- */
// Los clubes de las otras cuatro ligas de Lifetime (los de 1.ª división, con sus nombres) y algunos
// clubes inventados de Portugal y Países Bajos. Los clubes de tu propia liga entran por clasificación, no por invitación.
interface Country {
  code: string
  name: string
  cities: string[]
  patterns: string[] // {c} = ciudad
}

const COUNTRIES: Country[] = [
  { code: 'POR', name: 'Portugal', cities: ['Alvamar', 'Serravila', 'Costalta', 'Vilamora', 'Pontevela', 'Rioalto', 'Portocéu', 'Valdouro', 'Fozdouro', 'Pinhalto', 'Monteluz', 'Ribalva', 'Torrealva'], patterns: ['SC {c}', 'CD {c}', 'FC {c}'] },
  { code: 'HOL', name: 'Países Bajos', cities: ['Veldmeer', 'Oosterdam', 'Hoogwater', 'Zandbeek', 'Noordhaven', 'Kleiburg', 'Wijnveld', 'Marendijk', 'Duinoord', 'Waterhoek', 'Kruisveld', 'Heidmeer', 'Polderburg'], patterns: ['FC {c}', 'SC {c}', 'AFC {c}'] },
]

export const COUNTRY_NAMES: Record<string, string> = {
  ...Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name])),
  ...Object.fromEntries(LEAGUE_IDS.map((id) => [LEAGUES[id].code, LEAGUES[id].name])),
}

const PALETTE: [string, string][] = [
  ['#dc2626', '#f8fafc'], ['#1d4ed8', '#f8fafc'], ['#16a34a', '#f8fafc'], ['#f59e0b', '#111827'],
  ['#7c3aed', '#f8fafc'], ['#0891b2', '#f8fafc'], ['#be123c', '#fde68a'], ['#0f172a', '#f8fafc'],
  ['#ea580c', '#1e293b'], ['#065f46', '#fde68a'], ['#1e3a8a', '#fbbf24'], ['#f8fafc', '#dc2626'],
]

interface ClubSeed {
  name: string
  country: string
  colors: [string, string]
  score: number // fuerza de este año: nivel base del club más un poco de suerte
}

// Todos los clubes posibles, de mejor a peor este año. Sirven para repartir sin repetir ninguno.
function clubPool(rng: Rng, home: LeagueDef): ClubSeed[] {
  const all: ClubSeed[] = []
  for (const id of LEAGUE_IDS) {
    if (id === home.id) continue
    const league = LEAGUES[id]
    for (const club of league.div1) {
      all.push({ name: club.name, country: league.code, colors: club.colors, score: club.base + normal(rng) * 2.5 })
    }
  }
  for (const country of COUNTRIES) {
    for (const city of country.cities) {
      const pattern = country.patterns[Math.floor(rng() * country.patterns.length)]
      all.push({
        name: pattern.replace('{c}', city),
        country: country.code,
        colors: PALETTE[Math.floor(rng() * PALETTE.length)],
        score: 73 + normal(rng) * 3,
      })
    }
  }
  return all.sort((a, b) => b.score - a.score)
}

/* ---------- Armar las competiciones de la temporada siguiente ---------- */
// 1.ª división ordenada por la posición final
export function rankedFirstDivision(league: LeagueState): SimTeam[] {
  const div = league.divisions[1]
  const byId = new Map(div.teams.map((t) => [t.id, t]))
  return computeTable(div).flatMap((r) => {
    const t = byId.get(r.id)
    return t ? [t] : []
  })
}

// Los clubes de la liga del jugador usan este prefijo en su id (se llamaba así cuando solo existía España; se mantiene para no romper partidas guardadas)
export const HOME_ID_PREFIX = 'esp-'

function homeEntrant(t: SimTeam, country: string): Entrant {
  const user = t.id === USER_ID
  return {
    id: user ? 'user' : `${HOME_ID_PREFIX}${t.id}`,
    name: user ? '' : t.name,
    country,
    level: t.strength,
    colors: t.colors ?? PALETTE[0],
    user: user || undefined,
  }
}

// ranked: los equipos de 1.ª división en orden de clasificación final
export function buildEurope(ranked: SimTeam[], season: number, seed: number, home: LeagueDef = activeLeague()): EuropeSeason {
  const rng = createRng(seed)
  const pool = clubPool(rng, home)
  const fields = {} as Record<EuropeId, Entrant[]>
  let user: EuropeId | null = null

  for (const comp of EUROPE) {
    const local = ranked.filter((_, i) => qualifyFor(i + 1) === comp.id).map((t) => homeEntrant(t, home.code))
    if (local.some((e) => e.user)) user = comp.id
    const needed = Math.max(0, comp.fieldSize - local.length)
    // Los invitados de cada competición son los mejores clubes que quedan: la Champions se lleva a los más fuertes
    const chosen = pool.splice(0, needed)
    const mean = chosen.length > 0 ? chosen.reduce((n, c) => n + c.score, 0) / chosen.length : 0
    const invited: Entrant[] = chosen.map((c, i) => ({
      id: `eu-${comp.id}-${i}`,
      name: c.name,
      country: c.country,
      // El nivel medio de los invitados es el de la competición; cada club se aleja de él según lo bueno que sea
      level: Math.round(clamp(comp.invitedLevel + (c.score - mean) * 0.9 + normal(rng) * 0.5, 62, 88) * 10) / 10,
      colors: c.colors,
    }))
    fields[comp.id] = [...local, ...invited].sort((a, b) => b.level - a.level)
  }
  return { season, user, fields }
}

export function buildEuropeFromLeague(league: LeagueState, season: number, seed: number): EuropeSeason {
  return buildEurope(rankedFirstDivision(league), season, seed)
}

/* ---------- Para mostrar en pantalla ---------- */
export interface QualifiedClub {
  position: number
  name: string | null // null = tu club
}

export function homeQualifiers(league: LeagueState): Record<EuropeId, QualifiedClub[]> {
  const out: Record<EuropeId, QualifiedClub[]> = { champions: [], europa: [], conferencia: [] }
  rankedFirstDivision(league).forEach((t, i) => {
    const comp = qualifyFor(i + 1)
    if (comp) out[comp].push({ position: i + 1, name: t.id === USER_ID ? null : t.name })
  })
  return out
}

// Qué logró tu club al cerrar la temporada
export function userQualification(league: LeagueState): { division: 1 | 2; position: number; competition: EuropeId | null } {
  const division = league.userDivision
  const table = computeTable(league.divisions[division])
  const position = table.findIndex((r) => r.id === USER_ID) + 1
  return { division, position, competition: division === 1 ? qualifyFor(position) : null }
}

// Nombre que tenía cuando solo existía la liga española
export const spanishQualifiers = homeQualifiers

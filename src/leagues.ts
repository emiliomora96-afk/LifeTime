import type { ClubDef } from './clubs'
import { DIV1_CLUBS as ESP_DIV1, DIV2_CLUBS as ESP_DIV2 } from './clubs'
import { ALE_DIV1, ALE_DIV2, FRA_DIV1, FRA_DIV2, ING_DIV1, ING_DIV2, ITA_DIV1, ITA_DIV2 } from './clubsWorld'
import type { NatId } from './nations'

/* ==========================================================================
   Las 5 ligas de Lifetime. Cada una tiene sus dos divisiones, su copa nacional y su supercopa.
   Todo lo que cambia entre países (nombres, formato de la supercopa, clubes inferiores de la copa)
   se define aquí, en un solo sitio. Los nombres se cambian solo en este bloque.
   ========================================================================== */
export type LeagueId = 'esp' | 'ing' | 'ita' | 'ale' | 'fra'
export const LEAGUE_IDS: LeagueId[] = ['esp', 'ing', 'ita', 'ale', 'fra']
export const DEFAULT_LEAGUE: LeagueId = 'esp'

export interface CupNames {
  name: string
  short: string
  icon: string
}

// 'four': Supercopa a cuatro (campeón y subcampeón de Liga, campeón y finalista de Copa).
// 'two': un solo partido entre el campeón de Liga y el campeón de Copa.
export type SuperFormat = 'four' | 'two'
// Si el mismo club gana Liga y Copa (doblete), su rival en la Supercopa de dos es...
export type DoubleRival = 'leagueRunnerUp' | 'cupFinalist'

export interface LeagueDef {
  id: LeagueId
  code: string // código de país que usan las competiciones europeas (ESP, ING, ITA, ALE, FRA)
  name: string // nombre del país
  adjective: string // para frases como "Duelo inglés"
  flag: string
  nat: NatId // nacionalidad de la mayoría de sus jugadores
  leagueTitle: string // nombre del título de Liga (el que sale al ganarlo)
  div1Name: string
  div2Name: string
  cup: CupNames
  supercup: CupNames
  superFormat: SuperFormat
  superDouble: DoubleRival
  superHostsCupWinner: boolean // true: la supercopa de dos se juega en casa del campeón de Copa
  div1: ClubDef[]
  div2: ClubDef[] // 19 clubes: el del jugador es el 20.º
  lower: { patterns: string[]; places: string[] } // clubes de categorías inferiores que juegan la copa
  trophyKey: string // prefijo de los archivos de trofeos (assets/trophies/<clave>-liga.png...)
}

const ESPANA: LeagueDef = {
  id: 'esp',
  code: 'ESP',
  name: 'España',
  adjective: 'español',
  flag: '🇪🇸',
  nat: 'ESP',
  leagueTitle: 'Liga de España',
  div1Name: 'Primera División',
  div2Name: 'Segunda División',
  cup: { name: 'Copa del Rey', short: 'Copa', icon: '👑' },
  supercup: { name: 'Supercopa de España', short: 'Supercopa', icon: '⭐' },
  superFormat: 'four',
  superDouble: 'leagueRunnerUp',
  superHostsCupWinner: false,
  div1: ESP_DIV1,
  div2: ESP_DIV2,
  lower: {
    patterns: ['CD {c}', 'UD {c}', 'CF {c}', 'SD {c}', 'AD {c}', 'Racing {c}', 'Atlético {c}', 'Real {c}', 'Deportivo {c}', 'Unión {c}', 'Sporting {c}'],
    places: [
      'Valdearroyo', 'Peñalcázar', 'Campoverde', 'Rioseco', 'Torrenegra', 'Mirabueno', 'Fuenteclara', 'Navalpino',
      'Santa Aurelia', 'Cerrobajo', 'Villaflor', 'Altozano', 'Barrancal', 'Casalarga', 'Dehesilla', 'Encinarejo',
      'Fresnedal', 'Gavilanes', 'Hontoria Baja', 'Illescal', 'Jarales', 'Lagunilla', 'Matorral', 'Nogueral',
      'Olivares del Sur', 'Pozoblanco Viejo', 'Quintanar Alto', 'Robledal', 'Sotillo', 'Tejarejo', 'Umbría',
      'Vegalarga', 'Zarzalejo', 'Arroyomolino', 'Bocalinda', 'Cañaveral', 'Dos Aguas Nuevas', 'Escobar',
      'Fontanal', 'Garrovilla', 'Huertalta', 'Junquera', 'Laderuela', 'Majadal', 'Nava del Rey Chico', 'Ortigal',
      'Pinarejo', 'Rebollar',
    ],
  },
  trophyKey: 'esp',
}

const INGLATERRA: LeagueDef = {
  id: 'ing',
  code: 'ING',
  name: 'Inglaterra',
  adjective: 'inglés',
  flag: '🏴',
  nat: 'ING',
  leagueTitle: 'Prime League',
  div1Name: 'Prime League',
  div2Name: 'Champion Division',
  cup: { name: 'Copa de la FA', short: 'Copa FA', icon: '🏰' },
  supercup: { name: 'Community Crest', short: 'Crest', icon: '⭐' },
  superFormat: 'two',
  superDouble: 'leagueRunnerUp',
  superHostsCupWinner: false,
  div1: ING_DIV1,
  div2: ING_DIV2,
  lower: {
    patterns: ['{c} Town', '{c} Athletic', '{c} Rovers', '{c} United', '{c} City', '{c} Wanderers'],
    places: [
      'Northcote', 'Ravenswick', 'Elmbridge', 'Hartleigh', 'Wetherby Moor', 'Stainford', 'Coldharbour', 'Fairwick',
      'Kelsham', 'Longmoor', 'Marlbury', 'Nethercombe', 'Oakenshaw', 'Pelham Green', 'Quarrington', 'Redfern',
      'Saltmarsh', 'Thornley', 'Underhill', 'Wexcombe', 'Yarnfield', 'Aldermoor', 'Brackenhurst', 'Carlow Hill',
      'Dunmere', 'Eastwick', 'Fenwood', 'Garstone', 'Hollin Brook', 'Ingleby Cross', 'Kirkdale Vale', 'Linthorpe',
      'Moorgate', 'Netherby',
    ],
  },
  trophyKey: 'ing',
}

const ITALIA: LeagueDef = {
  id: 'ita',
  code: 'ITA',
  name: 'Italia',
  adjective: 'italiano',
  flag: '🇮🇹',
  nat: 'ITA',
  leagueTitle: 'Serie Alfa',
  div1Name: 'Serie Alfa',
  div2Name: 'Serie Beta',
  cup: { name: 'Coppa Italiana', short: 'Coppa', icon: '🏛️' },
  supercup: { name: 'Supercoppa Azzurra', short: 'Supercoppa', icon: '⭐' },
  superFormat: 'two',
  superDouble: 'cupFinalist',
  superHostsCupWinner: false,
  div1: ITA_DIV1,
  div2: ITA_DIV2,
  lower: {
    patterns: ['AC {c}', 'US {c}', '{c} Calcio', 'ASD {c}', 'FC {c}'],
    places: [
      'Castelrosso', 'Montesereno', 'Borgoalto', 'Pievebella', 'Rocchetta Nova', 'Santa Vittoria Alta', 'Terralunga',
      'Valleverde', 'Ponteluce', 'Cantalupa', 'Monterosa Bassa', 'Sanfiore', 'Torreverde', 'Villanera', 'Brolovivo',
      'Casapiana', 'Fontebuono', 'Gualdoro', 'Lagoscuro', 'Mareverde', 'Nevalta', 'Orsonero', 'Quercialta',
      'Ripalta Nova', 'Salvaterra', 'Tramonti Alti', 'Ulivaro', 'Vignalunga', 'Zafferano', 'Montefiore',
      'Sanlorenzo', 'Casalbruno', 'Villarosa', 'Fontanalta',
    ],
  },
  trophyKey: 'ita',
}

const ALEMANIA: LeagueDef = {
  id: 'ale',
  code: 'ALE',
  name: 'Alemania',
  adjective: 'alemán',
  flag: '🇩🇪',
  nat: 'ALE',
  leagueTitle: 'Bundesliga Alemana',
  div1Name: 'Bundesliga Alemana',
  div2Name: 'Zweite Liga',
  cup: { name: 'DFV-Pokal', short: 'Pokal', icon: '🦅' },
  supercup: { name: 'Kaiser Supercup', short: 'Supercup', icon: '⭐' },
  superFormat: 'two',
  superDouble: 'leagueRunnerUp',
  superHostsCupWinner: true,
  div1: ALE_DIV1,
  div2: ALE_DIV2,
  lower: {
    patterns: ['FC {c}', 'SV {c}', 'TSV {c}', 'SpVgg {c}', 'VfL {c}', 'SC {c}'],
    places: [
      'Rotenfeld', 'Eisenbach', 'Kleinwald', 'Grünfeld', 'Bergau', 'Hasenau', 'Lerchenfeld', 'Mühlbach', 'Neudorf Ost',
      'Oberweiler', 'Pappelau', 'Quellental', 'Rehbach', 'Sonnenfeld', 'Tiefenau', 'Ulmenbach', 'Waldkirchen Süd',
      'Zinnbach', 'Adlerau', 'Buchenfeld', 'Dornbach', 'Erlenhain', 'Fuchsstein', 'Gerstenau', 'Haselbach', 'Ilmtal',
      'Jagdfeld', 'Kupferbach',
    ],
  },
  trophyKey: 'ale',
}

const FRANCIA: LeagueDef = {
  id: 'fra',
  code: 'FRA',
  name: 'Francia',
  adjective: 'francés',
  flag: '🇫🇷',
  nat: 'FRA',
  leagueTitle: 'Ligue Une',
  div1Name: 'Ligue Une',
  div2Name: 'Ligue Deux',
  cup: { name: 'Coupe Française', short: 'Coupe', icon: '⚜️' },
  supercup: { name: 'Trophée des Vainqueurs', short: 'Trophée', icon: '⭐' },
  superFormat: 'two',
  superDouble: 'leagueRunnerUp',
  superHostsCupWinner: false,
  div1: FRA_DIV1,
  div2: FRA_DIV2,
  lower: {
    patterns: ['AS {c}', 'FC {c}', 'US {c}', 'Stade {c}', 'SC {c}', 'AJ {c}'],
    places: [
      'Aubrières', 'Brumevalle', 'Castelrive', 'Dormeval', 'Étangval', 'Fontevive', 'Grandchamp Sud', 'Hautecombe',
      'Isleval', 'Jouvenel', 'Lacroix-sur-Val', 'Montrivière', 'Neuvalle', 'Orcheval', 'Pontvert', 'Saint-Cyrille',
      'Tourvent', 'Valbrume', 'Villarouge', 'Beaurevers', 'Courtesoie', 'Doulemer', 'Estrevaux', 'Fleuribel',
      'Gravelune', 'Beaumarais', 'Montclair Haut', 'Saint-Aubin des Bois',
    ],
  },
  trophyKey: 'fra',
}

export const LEAGUES: Record<LeagueId, LeagueDef> = {
  esp: ESPANA,
  ing: INGLATERRA,
  ita: ITALIA,
  ale: ALEMANIA,
  fra: FRANCIA,
}

export function leagueDef(id: LeagueId): LeagueDef {
  return LEAGUES[id] ?? LEAGUES[DEFAULT_LEAGUE]
}

export function isLeagueId(x: unknown): x is LeagueId {
  return typeof x === 'string' && (LEAGUE_IDS as string[]).includes(x)
}

// Nombre que usa tu club en su ficha: "España", "Inglaterra"...
export function leagueIdFromName(name: string | undefined): LeagueId {
  const found = LEAGUE_IDS.find((id) => LEAGUES[id].name === name)
  return found ?? DEFAULT_LEAGUE
}

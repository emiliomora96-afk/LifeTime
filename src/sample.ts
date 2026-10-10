export type Position = 'POR' | 'DEF' | 'MED' | 'DEL'

export interface Player {
  id: number
  name: string
  pos: Position
  rating: number
  condition: number
  age: number
}

export interface Starter extends Player {
  x: number
  y: number
}

export function conditionColor(c: number): string {
  if (c >= 80) return '#22c55e'
  if (c >= 60) return '#f59e0b'
  return '#ef4444'
}

/* ---------- Equipo ---------- */
export const FORMATION = '4-3-3'

export const STARTERS: Starter[] = [
  { id: 1, name: 'Mateo Brisa', pos: 'POR', rating: 68, condition: 96, age: 29, x: 50, y: 88 },
  { id: 2, name: 'Hugo Lasarte', pos: 'DEF', rating: 66, condition: 90, age: 26, x: 14, y: 68 },
  { id: 3, name: 'Rubén Cárcamo', pos: 'DEF', rating: 70, condition: 84, age: 31, x: 38, y: 72 },
  { id: 4, name: 'Adrián Solís', pos: 'DEF', rating: 69, condition: 78, age: 28, x: 62, y: 72 },
  { id: 5, name: 'Pablo Ferrán', pos: 'DEF', rating: 65, condition: 92, age: 24, x: 86, y: 68 },
  { id: 6, name: 'Dani Orozco', pos: 'MED', rating: 71, condition: 88, age: 27, x: 25, y: 47 },
  { id: 7, name: 'Leo Marín', pos: 'MED', rating: 73, condition: 74, age: 30, x: 50, y: 51 },
  { id: 8, name: 'Saúl Becerra', pos: 'MED', rating: 67, condition: 81, age: 22, x: 75, y: 47 },
  { id: 9, name: 'Nico Aldana', pos: 'DEL', rating: 72, condition: 69, age: 25, x: 20, y: 21 },
  { id: 10, name: 'Gael Ibarra', pos: 'DEL', rating: 74, condition: 85, age: 28, x: 50, y: 14 },
  { id: 11, name: 'Tomás Quiroga', pos: 'DEL', rating: 70, condition: 58, age: 23, x: 80, y: 21 },
]

export const SUBS: Player[] = [
  { id: 12, name: 'Iván Pedrosa', pos: 'POR', rating: 61, condition: 100, age: 21 },
  { id: 13, name: 'Éric Nadal', pos: 'DEF', rating: 63, condition: 95, age: 20 },
  { id: 14, name: 'Joel Casal', pos: 'DEF', rating: 64, condition: 88, age: 27 },
  { id: 15, name: 'Marc Olmedo', pos: 'MED', rating: 66, condition: 91, age: 24 },
  { id: 16, name: 'Álex Treviño', pos: 'MED', rating: 62, condition: 97, age: 19 },
  { id: 17, name: 'Bruno Salgado', pos: 'DEL', rating: 65, condition: 79, age: 26 },
  { id: 18, name: 'Cris Montoya', pos: 'DEL', rating: 60, condition: 100, age: 18 },
]

/* ---------- Clasificación ---------- */
export interface TableRow {
  name: string | null // null = tu club
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
}

const POINTS = [22, 20, 19, 17, 16, 15, 13, 12, 11, 10, 10, 9, 8, 7, 7, 6, 5, 4, 3, 2]

function buildTable(names: (string | null)[]): TableRow[] {
  return names.map((name, i) => {
    const points = POINTS[i]
    const won = Math.floor(points / 3)
    const drawn = points % 3
    const lost = 10 - won - drawn
    return {
      name,
      played: 10,
      won,
      drawn,
      lost,
      gf: won * 2 + drawn + 3,
      ga: lost * 2 + drawn + 2,
      points,
    }
  })
}

export const DIV1_NAMES: string[] = [
  'Real Albacora', 'CD Torrealta', 'Athletic Ribamar', 'UD Valcárcel', 'Racing Almenara',
  'CF Montesol', 'Sporting Cañada', 'Real Pinares', 'Deportivo Alcor', 'SD Ventura',
  'Unión Mirador', 'CA Sierra Verde', 'Real Benavar', 'CD Alborán', 'Atlético Costaluz',
  'FC Marismas', 'Real Ceniza', 'UD Cabo Norte', 'CD Puerto Lobo', 'Racing Olmeda',
]

export const DIV2_NAMES: (string | null)[] = [
  'CD Atalaya', 'Real Montaña', 'UD Costa Brava', 'Racing Ribera', 'Atlético Meseta',
  null,
  'SD Marisma', 'Deportivo Sierra Alta', 'CD Alcazaba', 'UD Tramuntana', 'Real Bahía Sur',
  'CF Ladera', 'Atlético Roquedal', 'SD Valdeflores', 'Racing Llanura', 'CD Peñascal',
  'UD Hontanar', 'FC Dehesa', 'Real Cuenca Alta', 'CD Almiar',
]

export const DIV1_TABLE = buildTable(DIV1_NAMES)
export const DIV2_TABLE = buildTable(DIV2_NAMES)

/* ---------- Calendario ---------- */
export interface Fixture {
  round: number
  home: string
  away: string
  played: boolean
  homeGoals: number | null
  awayGoals: number | null
}

export function buildFixtures(clubName: string): Fixture[] {
  const rivals = DIV2_NAMES.filter((n): n is string => n !== null)
  const list: Fixture[] = []
  for (let r = 1; r <= 38; r++) {
    const rival = rivals[(r - 1) % rivals.length]
    const atHome = r % 2 === 1
    const played = r <= 10
    const mine = (r * 7) % 4
    const theirs = (r * 5) % 3
    list.push({
      round: r,
      home: atHome ? clubName : rival,
      away: atHome ? rival : clubName,
      played,
      homeGoals: played ? (atHome ? mine : theirs) : null,
      awayGoals: played ? (atHome ? theirs : mine) : null,
    })
  }
  return list
}

/* ---------- Mercado ---------- */
export interface Target {
  id: number
  name: string
  pos: Position
  age: number
  rating: number
  price: number
  club: string
}

export const MARKET_TARGETS: Target[] = [
  { id: 1, name: 'Álvaro Pineda', pos: 'DEL', age: 24, rating: 71, price: 900_000, club: 'UD Tramuntana' },
  { id: 2, name: 'Cristian Maldonado', pos: 'MED', age: 27, rating: 70, price: 650_000, club: 'CD Alcazaba' },
  { id: 3, name: 'Samu Echeverría', pos: 'DEF', age: 22, rating: 67, price: 480_000, club: 'Real Bahía Sur' },
  { id: 4, name: 'Julián Roca', pos: 'POR', age: 30, rating: 69, price: 350_000, club: 'CF Ladera' },
  { id: 5, name: 'Fer Quintana', pos: 'MED', age: 20, rating: 64, price: 300_000, club: 'Racing Llanura' },
  { id: 6, name: 'Oriol Vidal', pos: 'DEF', age: 29, rating: 68, price: 420_000, club: 'SD Valdeflores' },
]

export const OFFERS_RECEIVED = [
  { id: 1, player: 'Tomás Quiroga', from: 'CD Atalaya', amount: 750_000 },
  { id: 2, player: 'Leo Marín', from: 'Real Albacora', amount: 600_000 },
]

/* ---------- Cantera ---------- */
export interface Prospect {
  id: number
  name: string
  age: number
  pos: Position
  rating: number
  potential: number // 1 a 5
}

export const PROSPECTS: Prospect[] = [
  { id: 1, name: 'Pau Morell', age: 17, pos: 'MED', rating: 52, potential: 4 },
  { id: 2, name: 'Izan Rubio', age: 16, pos: 'DEL', rating: 48, potential: 5 },
  { id: 3, name: 'Nil Garrido', age: 18, pos: 'DEF', rating: 55, potential: 3 },
  { id: 4, name: 'Adam Toledo', age: 16, pos: 'POR', rating: 44, potential: 3 },
  { id: 5, name: 'Biel Cano', age: 17, pos: 'DEF', rating: 50, potential: 2 },
]

/* ---------- Finanzas ---------- */
export const INCOME = [
  { label: 'Entradas', amount: 900_000 },
  { label: 'Patrocinios', amount: 1_100_000 },
  { label: 'Derechos de TV', amount: 700_000 },
  { label: 'Otros', amount: 200_000 },
]

export const EXPENSES = [
  { label: 'Salarios', amount: 1_900_000 },
  { label: 'Mantenimiento del estadio', amount: 400_000 },
  { label: 'Cantera', amount: 250_000 },
  { label: 'Ojeadores', amount: 150_000 },
  { label: 'Otros', amount: 100_000 },
]

/* ---------- Directiva ---------- */
export const BOARD = {
  president: 'Rafael Montenegro',
  sportingDirector: 'Marta Ibáñez',
  confidence: 60,
  goals: [
    { text: 'Terminar en la mitad alta de la tabla', progress: 50 },
    { text: 'Cerrar la temporada sin números rojos', progress: 70 },
    { text: 'Subir a un juvenil al primer equipo', progress: 20 },
  ],
}

/* ---------- Estadísticas ---------- */
export interface StatRow {
  name: string
  club: string | null // null = tu club
  value: number
}

export const SCORERS: StatRow[] = [
  { name: 'Bruno Salas', club: 'CD Atalaya', value: 9 },
  { name: 'Gael Ibarra', club: null, value: 8 },
  { name: 'Mario Quesada', club: 'Real Montaña', value: 7 },
  { name: 'Pol Esteve', club: 'UD Costa Brava', value: 7 },
  { name: 'Ian Cordero', club: 'Racing Ribera', value: 6 },
]

export const ASSISTS: StatRow[] = [
  { name: 'Leo Marín', club: null, value: 7 },
  { name: 'Víctor Landa', club: 'CD Atalaya', value: 6 },
  { name: 'Eloy Prados', club: 'SD Marisma', value: 6 },
  { name: 'Hugo Barrios', club: 'Atlético Meseta', value: 5 },
  { name: 'Dani Orozco', club: null, value: 4 },
]

export const BEST_PLAYERS: StatRow[] = [
  { name: 'Bruno Salas', club: 'CD Atalaya', value: 7.8 },
  { name: 'Gael Ibarra', club: null, value: 7.6 },
  { name: 'Víctor Landa', club: 'CD Atalaya', value: 7.5 },
  { name: 'Mario Quesada', club: 'Real Montaña', value: 7.4 },
  { name: 'Leo Marín', club: null, value: 7.3 },
]
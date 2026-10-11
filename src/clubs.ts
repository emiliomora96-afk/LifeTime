import type { NatId } from './nations'
import type { Position } from './sample'

/* ---------- Clubes de la liga española ---------- */
// Los gigantes son referencias a los grandes reales: solo se conserva ciudad y color,
// el nombre está cambiado y los jugadores son inventados.
export type Tier = 'elite' | 'grande' | 'aspirante' | 'media' | 'modesto' | 'ascendido'

export const TIER_LABEL: Record<Tier, string> = {
  elite: 'Gigante',
  grande: 'Grande',
  aspirante: 'Aspirante',
  media: 'Media tabla',
  modesto: 'Modesto',
  ascendido: 'Recién ascendido',
}

export interface CorePlayer {
  pos: Position
  name: string
  nat: NatId
  age: number
  rating: number
}

export interface ClubDef {
  name: string
  city: string
  colors: [string, string]
  tier: Tier
  base: number // nivel al que apunta (los gigantes lo sacan de su once)
  core?: CorePlayer[] // once inicial hecho a mano (solo gigantes)
}

// Formato corto: 'POS|Nombre Apellido|NAC|edad|valoración'
// 'shift' baja o sube todas las valoraciones del once para afinar cuánto domina el club
function core(rows: string[], shift = 0): CorePlayer[] {
  return rows.map((row) => {
    const [pos, name, nat, age, rating] = row.split('|')
    return { pos: pos as Position, name, nat: nat as NatId, age: Number(age), rating: Number(rating) + shift }
  })
}

const ELITE_SHIFT = -8
const GRANDE_SHIFT = -2.5

/* ---------- Primera división: 7 gigantes + 13 clubes por nivel ---------- */
const GIANTS: ClubDef[] = [
  {
    name: 'Real Madrilia', city: 'Madrid', colors: ['#f1f5f9', '#d4af37'], tier: 'elite', base: 88,
    core: core([
      'POR|Thibaut Lambert|BEL|31|88',
      'DEF|Lucas Ordóñez|ESP|28|86', 'DEF|Rúben Teixeira|POR|26|87', 'DEF|Jonas Becker|ALE|29|87', 'DEF|Marcos Vidal|ESP|24|85',
      'MED|Declan Foster|ING|24|90', 'MED|Federico Acosta|URU|27|88', 'MED|Luka Babić|CRO|33|86',
      'DEL|Gabriel Moura|BRA|22|90', 'DEL|Théo Mercier|FRA|26|91', 'DEL|Matheus Cardoso|BRA|20|88',
    ], ELITE_SHIFT),
  },
  {
    name: 'FC Barcelonía', city: 'Barcelona', colors: ['#1e40af', '#9f1239'], tier: 'elite', base: 86,
    core: core([
      'POR|Marc Ibáñez|ESP|27|85',
      'DEF|Joaquín Ledesma|ARG|26|85', 'DEF|Pau Montero|ESP|22|86', 'DEF|Diogo Almeida|POR|29|85', 'DEF|Jordi Castro|ESP|25|84',
      'MED|Álvaro Molina|ESP|20|88', 'MED|Nolan Perrin|FRA|25|86', 'MED|Enzo Giménez|ARG|28|85',
      'DEL|Raphaël Roux|FRA|27|89', 'DEL|João Lima|BRA|21|89', 'DEL|Thomas Willems|BEL|30|85',
    ], ELITE_SHIFT),
  },
  {
    name: 'Atlético Madrileño', city: 'Madrid', colors: ['#dc2626', '#1d4ed8'], tier: 'elite', base: 84,
    core: core([
      'POR|Santiago Acuña|URU|30|84',
      'DEF|Matías Gutiérrez|ARG|27|84', 'DEF|Hugo Navarro|ESP|26|83', 'DEF|Mehdi Benali|MAR|28|83', 'DEF|Facundo Paredes|ARG|31|82',
      'MED|Marcos Ortega|ESP|29|85', 'MED|Caio Barbosa|BRA|25|83', 'MED|Diego Ruiz|ESP|24|84',
      'DEL|Franco Bustos|ARG|30|86', 'DEL|Antoine Girard|FRA|26|85', 'DEL|Álvaro Garrido|ESP|28|83',
    ], ELITE_SHIFT),
  },
  {
    name: 'Real Sevillana', city: 'Sevilla', colors: ['#f8fafc', '#dc2626'], tier: 'grande', base: 80,
    core: core([
      'POR|Rui Almeida|POR|32|80',
      'DEF|Adrián Molina|ESP|27|80', 'DEF|Youssef Idrissi|MAR|26|81', 'DEF|Ezequiel Sosa|ARG|29|79', 'DEF|Iván Castro|ESP|24|78',
      'MED|Joris Mulder|PBA|27|80', 'MED|Santiago Ríos|COL|26|79', 'MED|Pablo Ruiz|ESP|31|80',
      'DEL|Cristian Ospina|COL|27|82', 'DEL|Luis Morales|MEX|25|80', 'DEL|Ousmane Sarr|SEN|23|81',
    ], GRANDE_SHIFT),
  },
  {
    name: 'Valencia Turia CF', city: 'Valencia', colors: ['#f8fafc', '#ea580c'], tier: 'grande', base: 79,
    core: core([
      'POR|Mateo Salazar|MEX|29|79',
      'DEF|Carlos Vidal|ESP|26|79', 'DEF|Nuno Pereira|POR|27|80', 'DEF|Gonzalo Giménez|ARG|28|78', 'DEF|Sergio Navarro|ESP|22|78',
      'MED|Felipe Araújo|BRA|25|80', 'MED|Ante Jurić|CRO|29|79', 'MED|Daniel Sánchez|ESP|24|79',
      'DEL|Brayan Cuesta|COL|24|80', 'DEL|Moussa Diop|SEN|27|80', 'DEL|Marco Conti|ITA|28|79',
    ], GRANDE_SHIFT),
  },
  {
    name: 'Athletic Bilbaíno', city: 'Bilbao', colors: ['#dc2626', '#f8fafc'], tier: 'grande', base: 79,
    core: core([
      'POR|Iker Zubizarreta|ESP|30|79',
      'DEF|Aitor Goikoetxea|ESP|27|79', 'DEF|Mikel Urrutia|ESP|29|78', 'DEF|Asier Larrañaga|ESP|25|79', 'DEF|Ander Elorza|ESP|23|77',
      'MED|Jon Aguirre|ESP|26|80', 'MED|Oihan Etxeberria|ESP|24|78', 'MED|Unai Ibarra|ESP|28|79',
      'DEL|Gorka Mendizábal|ESP|27|80', 'DEL|Iñaki Arana|ESP|22|79', 'DEL|Beñat Lasa|ESP|31|78',
    ], GRANDE_SHIFT),
  },
  {
    name: 'Real Donostiarra', city: 'San Sebastián', colors: ['#2563eb', '#f8fafc'], tier: 'grande', base: 79,
    core: core([
      'POR|Álex Garmendia|ESP|28|78',
      'DEF|Martín Aranburu|ESP|25|79', 'DEF|Rúben Lopes|POR|27|78', 'DEF|Ibai Olaizola|ESP|22|78', 'DEF|Théo Dubois|FRA|26|79',
      'MED|Mathis Colin|FRA|24|80', 'MED|Santiago Gómez|ESP|29|79', 'MED|Hugo Fernández|ESP|27|79',
      'DEL|Nicolás Maidana|ARG|26|80', 'DEL|Brian Reyes|MEX|23|79', 'DEL|Pablo Castro|ESP|30|78',
    ], GRANDE_SHIFT),
  },
]

const D1_OTHERS: ClubDef[] = [
  // Aspirantes: pelean por Europa
  { name: 'Real Albacora', city: 'Albacora', colors: ['#f8fafc', '#0ea5e9'], tier: 'aspirante', base: 76 },
  { name: 'CD Torrealta', city: 'Torrealta', colors: ['#7c3aed', '#f8fafc'], tier: 'aspirante', base: 75.5 },
  { name: 'UD Valcárcel', city: 'Valcárcel', colors: ['#facc15', '#1e293b'], tier: 'aspirante', base: 75 },
  // Media tabla
  { name: 'Racing Almenara', city: 'Almenara', colors: ['#16a34a', '#f8fafc'], tier: 'media', base: 73.5 },
  { name: 'CF Montesol', city: 'Montesol', colors: ['#f97316', '#1e293b'], tier: 'media', base: 72.5 },
  { name: 'Sporting Cañada', city: 'Cañada', colors: ['#dc2626', '#1e293b'], tier: 'media', base: 72 },
  { name: 'Real Pinares', city: 'Pinares', colors: ['#15803d', '#fde047'], tier: 'media', base: 71.5 },
  // Modestos: pelean por no descender
  { name: 'Deportivo Alcor', city: 'Alcor', colors: ['#1d4ed8', '#f8fafc'], tier: 'modesto', base: 70 },
  { name: 'SD Ventura', city: 'Ventura', colors: ['#0f766e', '#f8fafc'], tier: 'modesto', base: 69.5 },
  { name: 'Unión Mirador', city: 'Mirador', colors: ['#be123c', '#f8fafc'], tier: 'modesto', base: 69 },
  // Recién ascendidos
  { name: 'CA Sierra Verde', city: 'Sierra Verde', colors: ['#22c55e', '#14532d'], tier: 'ascendido', base: 68 },
  { name: 'Real Benavar', city: 'Benavar', colors: ['#f8fafc', '#7c2d12'], tier: 'ascendido', base: 67.5 },
  { name: 'CD Alborán', city: 'Alborán', colors: ['#38bdf8', '#0c4a6e'], tier: 'ascendido', base: 67 },
]

// Los gigantes ocupan los primeros puestos del orden inicial
export const DIV1_CLUBS: ClubDef[] = [...GIANTS, ...D1_OTHERS]

/* ---------- Segunda división: 19 clubes (tu club es el número 20) ---------- */
const D2_RAW: [string, string, string, string][] = [
  ['CD Atalaya', 'Atalaya', '#2563eb', '#f8fafc'],
  ['Real Montaña', 'Montaña', '#f8fafc', '#16a34a'],
  ['UD Costa Brava', 'Costa Brava', '#0ea5e9', '#f8fafc'],
  ['Racing Ribera', 'Ribera', '#dc2626', '#f8fafc'],
  ['Atlético Meseta', 'Meseta', '#f59e0b', '#1e293b'],
  ['SD Marisma', 'Marisma', '#0891b2', '#f8fafc'],
  ['Deportivo Sierra Alta', 'Sierra Alta', '#65a30d', '#f8fafc'],
  ['CD Alcazaba', 'Alcazaba', '#9333ea', '#f8fafc'],
  ['UD Tramuntana', 'Tramuntana', '#1e40af', '#fde047'],
  ['Real Bahía Sur', 'Bahía Sur', '#f8fafc', '#0369a1'],
  ['CF Ladera', 'Ladera', '#b45309', '#f8fafc'],
  ['Atlético Roquedal', 'Roquedal', '#dc2626', '#1e293b'],
  ['SD Valdeflores', 'Valdeflores', '#db2777', '#f8fafc'],
  ['Racing Llanura', 'Llanura', '#15803d', '#f8fafc'],
  ['CD Peñascal', 'Peñascal', '#475569', '#f8fafc'],
  ['UD Hontanar', 'Hontanar', '#0d9488', '#1e293b'],
  ['FC Dehesa', 'Dehesa', '#ca8a04', '#14532d'],
  ['Real Cuenca Alta', 'Cuenca Alta', '#f8fafc', '#1d4ed8'],
  ['CD Almiar', 'Almiar', '#eab308', '#7f1d1d'],
]

export const USER_SLOT_DIV2 = 5 // lugar del club del jugador en la lista inicial de 2.ª

export const DIV2_CLUBS: ClubDef[] = D2_RAW.map(([name, city, c1, c2], i) => {
  const slot = i < USER_SLOT_DIV2 ? i : i + 1
  const tier: Tier = slot < 6 ? 'aspirante' : slot < 13 ? 'media' : 'modesto'
  return { name, city, colors: [c1, c2], tier, base: 72.5 - slot * 0.55 }
})

import type { Rng } from './rng'
import { pickOne, pickWeighted } from './rng'

/* ---------- Nacionalidades ---------- */
export type NatId =
  | 'ESP' | 'ING' | 'FRA' | 'POR' | 'ITA' | 'ALE'
  | 'ARG' | 'BRA' | 'MEX' | 'COL' | 'URU'
  | 'PBA' | 'BEL' | 'CRO' | 'MAR' | 'SEN'

// A: gran cantera (+1 al pico de los jugadores nuevos). B: buena cantera (+0,5). Resto: sin bono.
export type NatTier = 'A' | 'B' | 'C'

export interface Nation {
  id: NatId
  name: string
  tier: NatTier
  first: string[]
  last: string[]
}

export const NATIONS: Record<NatId, Nation> = {
  ESP: {
    id: 'ESP', name: 'España', tier: 'A',
    first: ['Adrián', 'Álvaro', 'Carlos', 'Daniel', 'Diego', 'Hugo', 'Iván', 'Javier', 'Marcos', 'Pablo', 'Sergio', 'Unai'],
    last: ['García', 'Martínez', 'López', 'Sánchez', 'Fernández', 'Gómez', 'Ruiz', 'Navarro', 'Molina', 'Ortega', 'Castro', 'Vidal'],
  },
  ING: {
    id: 'ING', name: 'Inglaterra', tier: 'A',
    first: ['Jack', 'Harry', 'Oliver', 'Callum', 'Jordan', 'Luke', 'Ben', 'Tom', 'Mason', 'Declan', 'Reece', 'Connor'],
    last: ['Smith', 'Taylor', 'Walker', 'Hughes', 'Bennett', 'Foster', 'Palmer', 'Wright', 'Cooper', 'Hayes', 'Mitchell', 'Grant'],
  },
  FRA: {
    id: 'FRA', name: 'Francia', tier: 'A',
    first: ['Lucas', 'Hugo', 'Théo', 'Mathis', 'Antoine', 'Maxime', 'Baptiste', 'Nolan', 'Raphaël', 'Enzo', 'Yanis', 'Corentin'],
    last: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Lefèvre', 'Girard', 'Fontaine', 'Roux', 'Perrin', 'Colin', 'Mercier'],
  },
  POR: {
    id: 'POR', name: 'Portugal', tier: 'A',
    first: ['João', 'Tiago', 'Rúben', 'Diogo', 'Rafael', 'Gonçalo', 'Pedro', 'André', 'Nuno', 'Bruno', 'Miguel', 'Rui'],
    last: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Carvalho', 'Teixeira', 'Moreira', 'Almeida'],
  },
  ITA: {
    id: 'ITA', name: 'Italia', tier: 'A',
    first: ['Marco', 'Luca', 'Matteo', 'Andrea', 'Federico', 'Lorenzo', 'Davide', 'Simone', 'Alessio', 'Riccardo', 'Nicolò', 'Giorgio'],
    last: ['Rossi', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Conti', 'Gallo', 'Costa', 'Fontana', 'Moretti'],
  },
  ALE: {
    id: 'ALE', name: 'Alemania', tier: 'A',
    first: ['Lukas', 'Jonas', 'Felix', 'Leon', 'Maximilian', 'Niklas', 'Tobias', 'Jan', 'Florian', 'Moritz', 'Kai', 'Lennart'],
    last: ['Müller', 'Schneider', 'Fischer', 'Weber', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Wolf', 'Krüger', 'Neumann'],
  },
  ARG: {
    id: 'ARG', name: 'Argentina', tier: 'A',
    first: ['Matías', 'Lucas', 'Nicolás', 'Facundo', 'Joaquín', 'Santiago', 'Franco', 'Ezequiel', 'Agustín', 'Tomás', 'Maximiliano', 'Gonzalo'],
    last: ['Fernández', 'Gutiérrez', 'Acosta', 'Benítez', 'Ledesma', 'Maidana', 'Giménez', 'Paredes', 'Sosa', 'Ibáñez', 'Quiroga', 'Bustos'],
  },
  BRA: {
    id: 'BRA', name: 'Brasil', tier: 'A',
    first: ['João', 'Gabriel', 'Matheus', 'Vinícius', 'Rafael', 'Thiago', 'Lucas', 'Felipe', 'Gustavo', 'Caio', 'Henrique', 'Wesley'],
    last: ['Souza', 'Oliveira', 'Lima', 'Pereira', 'Ribeiro', 'Barbosa', 'Cardoso', 'Nascimento', 'Moura', 'Campos', 'Teixeira', 'Araújo'],
  },
  MEX: {
    id: 'MEX', name: 'México', tier: 'B',
    first: ['Luis', 'Jesús', 'Diego', 'Emiliano', 'Alan', 'Brian', 'Héctor', 'Erick', 'César', 'Ángel', 'Raúl', 'Uriel'],
    last: ['Hernández', 'Ramírez', 'Cruz', 'Flores', 'Morales', 'Reyes', 'Ortiz', 'Vázquez', 'Salazar', 'Mendoza', 'Rangel', 'Arriaga'],
  },
  COL: {
    id: 'COL', name: 'Colombia', tier: 'B',
    first: ['Juan', 'Santiago', 'Andrés', 'Camilo', 'Yeison', 'Brayan', 'Duván', 'Jhon', 'Mateo', 'Sebastián', 'Cristian', 'Wílmar'],
    last: ['Rodríguez', 'Gómez', 'Ospina', 'Cuesta', 'Valencia', 'Mosquera', 'Restrepo', 'Cárdenas', 'Ríos', 'Montoya', 'Castaño', 'Tovar'],
  },
  URU: {
    id: 'URU', name: 'Uruguay', tier: 'B',
    first: ['Federico', 'Maximiliano', 'Nahuel', 'Mathías', 'Rodrigo', 'Agustín', 'Brian', 'Facundo', 'Gastón', 'Santiago', 'Emiliano', 'Lucas'],
    last: ['Rodríguez', 'Pereira', 'Suárez', 'Techera', 'Acuña', 'Cabrera', 'Vieira', 'Olivera', 'Silva', 'Píriz', 'Sellanes', 'Pintos'],
  },
  PBA: {
    id: 'PBA', name: 'Países Bajos', tier: 'B',
    first: ['Daan', 'Sven', 'Jesse', 'Luuk', 'Bram', 'Thijs', 'Ruben', 'Milan', 'Joris', 'Niels', 'Stijn', 'Tim'],
    last: ['Jansen', 'De Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Dekker', 'Hendriks'],
  },
  BEL: {
    id: 'BEL', name: 'Bélgica', tier: 'B',
    first: ['Thomas', 'Maxime', 'Jonas', 'Arne', 'Yannick', 'Dries', 'Wout', 'Jelle', 'Simon', 'Lars', 'Thibaut', 'Ruben'],
    last: ['Peeters', 'Janssens', 'Maes', 'Jacobs', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet', 'Hermans', 'Lambert', 'Aerts'],
  },
  CRO: {
    id: 'CRO', name: 'Croacia', tier: 'B',
    first: ['Luka', 'Ivan', 'Marko', 'Josip', 'Ante', 'Mateo', 'Dario', 'Filip', 'Petar', 'Nikola', 'Domagoj', 'Borna'],
    last: ['Horvat', 'Babić', 'Marić', 'Jurić', 'Knežević', 'Vuković', 'Pavlović', 'Matić', 'Tomić', 'Božić', 'Perić', 'Novak'],
  },
  MAR: {
    id: 'MAR', name: 'Marruecos', tier: 'C',
    first: ['Youssef', 'Amine', 'Hamza', 'Ayoub', 'Karim', 'Mehdi', 'Bilal', 'Ilyas', 'Zakaria', 'Anas', 'Soufiane', 'Reda'],
    last: ['El Amrani', 'Benali', 'Haddad', 'Idrissi', 'Bennani', 'Tazi', 'Alaoui', 'Chakir', 'Fassi', 'Mansouri', 'Berrada', 'Lahlou'],
  },
  SEN: {
    id: 'SEN', name: 'Senegal', tier: 'C',
    first: ['Moussa', 'Ibrahima', 'Cheikh', 'Mamadou', 'Idrissa', 'Pape', 'Abdoulaye', 'Ousmane', 'Saliou', 'Boubacar', 'Lamine', 'Famara'],
    last: ['Diop', 'Ndiaye', 'Sarr', 'Fall', 'Gueye', 'Sow', 'Diallo', 'Faye', 'Mbaye', 'Ba', 'Thiam', 'Seck'],
  },
}

export const NAT_IDS = Object.keys(NATIONS) as NatId[]

/* ---------- De dónde sale la gente (pesos relativos, no hace falta que sumen 100) ---------- */
export type NatPool = Partial<Record<NatId, number>>

// Liga española: mayoría española, con mucha presencia de Sudamérica y Europa
export const SPAIN_POOL: NatPool = {
  ESP: 60, ARG: 6, BRA: 5, FRA: 4, POR: 4, ING: 3, ITA: 3, ALE: 3,
  COL: 2.5, URU: 2, MEX: 1.5, PBA: 1.5, MAR: 1.5, BEL: 1, CRO: 1, SEN: 1,
}

// Cantera propia: casi todos son de casa
export const ACADEMY_POOL: NatPool = { ...SPAIN_POOL, ESP: 240 }

// Clubes de los gigantes (ficha más internacional para los suplentes)
export const GIANT_POOL: NatPool = { ...SPAIN_POOL, ESP: 40 }

/* ---------- Las otras ligas: mayoría de casa y una mezcla propia de extranjeros ---------- */
export const ENGLAND_POOL: NatPool = {
  ING: 58, FRA: 5, ESP: 4, BRA: 4, POR: 4, ARG: 3, ALE: 3, ITA: 2, PBA: 3, BEL: 2, SEN: 2.5, MAR: 1, COL: 2, URU: 1.5, CRO: 1, MEX: 1,
}
export const ITALY_POOL: NatPool = {
  ITA: 58, ARG: 6, BRA: 4, FRA: 4, ESP: 3, POR: 3, ALE: 2, ING: 1.5, URU: 3, COL: 2, CRO: 3, BEL: 1, SEN: 1.5, MAR: 1.5, PBA: 1, MEX: 1,
}
export const GERMANY_POOL: NatPool = {
  ALE: 55, FRA: 4, ING: 2, ESP: 3, POR: 2, ITA: 2, BRA: 4, ARG: 2, PBA: 3, BEL: 2, CRO: 4, SEN: 2, MAR: 2, COL: 1, URU: 1, MEX: 1,
}
export const FRANCE_POOL: NatPool = {
  FRA: 58, SEN: 5, MAR: 4, BRA: 5, ARG: 3, POR: 4, ESP: 3, ITA: 2, ALE: 2, ING: 1.5, BEL: 3, COL: 2, URU: 1.5, CRO: 1, PBA: 1, MEX: 1,
}

// De dónde sale la gente en cada liga, según la nacionalidad local. Cantera: casi todos de casa. Gigantes: más mezcla.
export function poolsForNat(nat: NatId): { home: NatPool; academy: NatPool; giant: NatPool } {
  const home = (
    { ESP: SPAIN_POOL, ING: ENGLAND_POOL, ITA: ITALY_POOL, ALE: GERMANY_POOL, FRA: FRANCE_POOL } as Partial<Record<NatId, NatPool>>
  )[nat] ?? SPAIN_POOL
  if (home === SPAIN_POOL) return { home, academy: ACADEMY_POOL, giant: GIANT_POOL }
  const w = home[nat] ?? 50
  return { home, academy: { ...home, [nat]: Math.round(w * 4) }, giant: { ...home, [nat]: Math.round((w * 2) / 3) } }
}

export function pickNation(pool: NatPool, rng: Rng): NatId {
  const entries = (Object.entries(pool) as [NatId, number][]).filter(([, w]) => w > 0)
  return pickWeighted(entries, ([, w]) => w, rng)?.[0] ?? 'ESP'
}

export interface Identity {
  nat: NatId
  first: string
  last: string
  name: string
}

export function randomIdentity(rng: Rng, pool: NatPool = SPAIN_POOL): Identity {
  const nat = pickNation(pool, rng)
  const n = NATIONS[nat]
  const first = pickOne(n.first, rng)
  const last = pickOne(n.last, rng)
  return { nat, first, last, name: `${first} ${last}` }
}

// Bono al pico de los jugadores nuevos según la cantera de su país
export function talentBonus(nat: NatId | undefined): number {
  if (!nat) return 0
  const t = NATIONS[nat].tier
  return t === 'A' ? 1 : t === 'B' ? 0.5 : 0
}

export function natName(nat: NatId | undefined): string {
  return nat ? NATIONS[nat].name : '—'
}

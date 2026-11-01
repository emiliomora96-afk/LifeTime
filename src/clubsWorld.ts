import type { ClubDef, Tier } from './clubs'

/* ==========================================================================
   Clubes de Inglaterra, Italia, Alemania y Francia.
   Misma estructura que España (clubs.ts): 7 gigantes + 13 clubes por nivel en 1.ª,
   y 19 clubes en 2.ª (el club del jugador es el número 20).
   Los nombres están alterados a propósito: parecen los reales pero no lo son.
   Ciudad y color de los gigantes sí siguen a los reales.
   ========================================================================== */

// Nivel inicial de cada puesto de 1.ª: igual que en España, para que todas las ligas tengan el mismo equilibrio
const GIANT_SLOTS: { tier: Tier; base: number }[] = [
  { tier: 'elite', base: 80.5 },
  { tier: 'elite', base: 79.5 },
  { tier: 'elite', base: 78.5 },
  { tier: 'grande', base: 77 },
  { tier: 'grande', base: 76.5 },
  { tier: 'grande', base: 76.5 },
  { tier: 'grande', base: 76.5 },
]

const OTHER_SLOTS: { tier: Tier; base: number }[] = [
  { tier: 'aspirante', base: 76 },
  { tier: 'aspirante', base: 75.5 },
  { tier: 'aspirante', base: 75 },
  { tier: 'media', base: 73.5 },
  { tier: 'media', base: 72.5 },
  { tier: 'media', base: 72 },
  { tier: 'media', base: 71.5 },
  { tier: 'modesto', base: 70 },
  { tier: 'modesto', base: 69.5 },
  { tier: 'modesto', base: 69 },
  { tier: 'ascendido', base: 68 },
  { tier: 'ascendido', base: 67.5 },
  { tier: 'ascendido', base: 67 },
]

// [nombre, ciudad, color principal, color secundario]
export type ClubRow = [string, string, string, string]

// 1.ª división: 7 gigantes primero y luego los 13 clubes restantes, ya ordenados por nivel
export function buildDiv1(rows: ClubRow[]): ClubDef[] {
  const slots = [...GIANT_SLOTS, ...OTHER_SLOTS]
  return rows.map(([name, city, c1, c2], i) => ({ name, city, colors: [c1, c2], tier: slots[i].tier, base: slots[i].base }))
}

// 2.ª división: 19 clubes (el del jugador ocupa el puesto 5, como en España)
export const USER_SLOT = 5
export function buildDiv2(rows: ClubRow[]): ClubDef[] {
  return rows.map(([name, city, c1, c2], i) => {
    const slot = i < USER_SLOT ? i : i + 1
    const tier: Tier = slot < 6 ? 'aspirante' : slot < 13 ? 'media' : 'modesto'
    return { name, city, colors: [c1, c2], tier, base: 72.5 - slot * 0.55 }
  })
}

/* ---------- Inglaterra ---------- */
export const ING_DIV1: ClubDef[] = buildDiv1([
  ['Arsenhall FC', 'Londres', '#dc2626', '#f8fafc'],
  ['Manchester Azure FC', 'Manchester', '#7dd3fc', '#f8fafc'],
  ['Liverpoole FC', 'Liverpool', '#b91c1c', '#f8fafc'],
  ['Manchester Crimson United', 'Manchester', '#dc2626', '#111827'],
  ['Chelsey FC', 'Londres', '#1d4ed8', '#f8fafc'],
  ['Tottenhall Hotspur', 'Londres', '#f8fafc', '#1e3a8a'],
  ['Newcastel United', 'Newcastle', '#111827', '#f8fafc'],
  ['Aston Villan FC', 'Birmingham', '#7f1d1d', '#7dd3fc'],
  ['Brighthon Albion', 'Brighton', '#2563eb', '#f8fafc'],
  ['West Hamm United', 'Londres', '#881337', '#38bdf8'],
  ['Everten FC', 'Liverpool', '#1d4ed8', '#f8fafc'],
  ['Fulhame FC', 'Londres', '#f8fafc', '#111827'],
  ['Crystal Palais', 'Londres', '#1d4ed8', '#dc2626'],
  ['Brentforde FC', 'Londres', '#dc2626', '#f8fafc'],
  ['Nottingham Foresters', 'Nottingham', '#b91c1c', '#f8fafc'],
  ['Bournemoth AFC', 'Bournemouth', '#dc2626', '#111827'],
  ['Wolverhampton Rovers', 'Wolverhampton', '#f59e0b', '#111827'],
  ['Leedz United', 'Leeds', '#f8fafc', '#facc15'],
  ['Sunderlund AFC', 'Sunderland', '#dc2626', '#f8fafc'],
  ['Burnly FC', 'Burnley', '#7f1d1d', '#7dd3fc'],
])

export const ING_DIV2: ClubDef[] = buildDiv2([
  ['Leicestor City', 'Leicester', '#1d4ed8', '#f8fafc'],
  ['Southamton FC', 'Southampton', '#dc2626', '#f8fafc'],
  ['Sheffield Unitd', 'Sheffield', '#dc2626', '#f8fafc'],
  ['Middlesbro FC', 'Middlesbrough', '#dc2626', '#f8fafc'],
  ['Norwych City', 'Norwich', '#facc15', '#16a34a'],
  ['West Bromwich Albian', 'West Bromwich', '#1e3a8a', '#f8fafc'],
  ['Birmingam City', 'Birmingham', '#2563eb', '#f8fafc'],
  ['Stoke Citty', 'Stoke', '#dc2626', '#f8fafc'],
  ['Watforde FC', 'Watford', '#facc15', '#111827'],
  ['Swansee City', 'Swansea', '#f8fafc', '#111827'],
  ['Coventri City', 'Coventry', '#38bdf8', '#f8fafc'],
  ['Ipswitch Town', 'Ipswich', '#2563eb', '#f8fafc'],
  ['Hull Citty', 'Hull', '#f59e0b', '#111827'],
  ['Blackbern Rovers', 'Blackburn', '#2563eb', '#f8fafc'],
  ['Preston North Ende', 'Preston', '#f8fafc', '#1e3a8a'],
  ['Milwall FC', 'Londres', '#1e3a8a', '#f8fafc'],
  ['Queen\u2019s Park Rovers', 'Londres', '#2563eb', '#f8fafc'],
  ['Cardif City', 'Cardiff', '#2563eb', '#f8fafc'],
  ['Sheffield Wendsday', 'Sheffield', '#1d4ed8', '#f8fafc'],
])

/* ---------- Italia ---------- */
export const ITA_DIV1: ClubDef[] = buildDiv1([
  ['Juventis Torino', 'Turín', '#f8fafc', '#111827'],
  ['Internazionali Milano', 'Milán', '#1e3a8a', '#111827'],
  ['AC Millan', 'Milán', '#dc2626', '#111827'],
  ['SSC Napolli', 'Nápoles', '#38bdf8', '#f8fafc'],
  ['AS Romma', 'Roma', '#7f1d1d', '#facc15'],
  ['Atalante BC', 'Bérgamo', '#1e3a8a', '#111827'],
  ['SS Lazzio', 'Roma', '#7dd3fc', '#f8fafc'],
  ['ACF Fiorentino', 'Florencia', '#7c3aed', '#f8fafc'],
  ['Bolonya FC', 'Bolonia', '#dc2626', '#1e3a8a'],
  ['Torinno FC', 'Turín', '#7f1d1d', '#f8fafc'],
  ['Genoha CFC', 'Génova', '#dc2626', '#1e3a8a'],
  ['Udinesse Calcio', 'Údine', '#f8fafc', '#111827'],
  ['Caglieri Calcio', 'Cagliari', '#7f1d1d', '#1d4ed8'],
  ['Hellas Veronna', 'Verona', '#facc15', '#1e3a8a'],
  ['US Lecche', 'Lecce', '#facc15', '#dc2626'],
  ['Parmma Calcio', 'Parma', '#f8fafc', '#facc15'],
  ['Komo 1908', 'Como', '#2563eb', '#f8fafc'],
  ['US Sassuola', 'Sassuolo', '#16a34a', '#111827'],
  ['Monzza FC', 'Monza', '#dc2626', '#f8fafc'],
  ['Empolli FC', 'Empoli', '#2563eb', '#f8fafc'],
])

export const ITA_DIV2: ClubDef[] = buildDiv2([
  ['UC Sampdorya', 'Génova', '#1d4ed8', '#f8fafc'],
  ['Palermmo FC', 'Palermo', '#f9a8d4', '#111827'],
  ['Barri Calcio', 'Bari', '#f8fafc', '#dc2626'],
  ['Venezzia FC', 'Venecia', '#16a34a', '#f59e0b'],
  ['Cremonesse', 'Cremona', '#a8a29e', '#dc2626'],
  ['Pissa SC', 'Pisa', '#111827', '#1d4ed8'],
  ['Bressia Calcio', 'Brescia', '#1d4ed8', '#f8fafc'],
  ['Spezzia Calcio', 'La Spezia', '#f8fafc', '#111827'],
  ['Cesenna FC', 'Cesena', '#f8fafc', '#111827'],
  ['Frosinonne Calcio', 'Frosinone', '#facc15', '#2563eb'],
  ['Modenna FC', 'Módena', '#facc15', '#2563eb'],
  ['Reggianna', 'Reggio Emilia', '#7f1d1d', '#f8fafc'],
  ['Catanzara US', 'Catanzaro', '#facc15', '#dc2626'],
  ['Salernitanna', 'Salerno', '#7f1d1d', '#f8fafc'],
  ['Cosensa Calcio', 'Cosenza', '#1d4ed8', '#dc2626'],
  ['S\u00fcdtyrol', 'Bolzano', '#f8fafc', '#dc2626'],
  ['Mantoba FC', 'Mantua', '#f8fafc', '#dc2626'],
  ['Juve Stabbia', 'Castellammare', '#facc15', '#1d4ed8'],
  ['Ascolli Calcio', 'Ascoli', '#f8fafc', '#111827'],
])

/* ---------- Alemania ---------- */
export const ALE_DIV1: ClubDef[] = buildDiv1([
  ['Bayren M\u00fcnchen', 'M\u00fanich', '#dc2626', '#f8fafc'],
  ['Borusia Dortmunt', 'Dortmund', '#facc15', '#111827'],
  ['Baier Leverkusen', 'Leverkusen', '#dc2626', '#111827'],
  ['RB Leipsic', 'Leipzig', '#f8fafc', '#dc2626'],
  ['VfB Stuttgard', 'Stuttgart', '#f8fafc', '#dc2626'],
  ['Eintracht Frankfort', 'Fr\u00e1ncfort', '#111827', '#dc2626'],
  ['Borusia M\u00f6nchengladbac', 'M\u00f6nchengladbach', '#16a34a', '#111827'],
  ['VfL Wolfsburgh', 'Wolfsburgo', '#16a34a', '#f8fafc'],
  ['Werder Bremmen', 'Bremen', '#16a34a', '#f8fafc'],
  ['SC Freiburgo', 'Friburgo', '#dc2626', '#111827'],
  ['TSG Hoffenhaim', 'Hoffenheim', '#2563eb', '#f8fafc'],
  ['FC Ausburg', 'Augsburgo', '#dc2626', '#16a34a'],
  ['Union Berlyn', 'Berl\u00edn', '#dc2626', '#facc15'],
  ['Mainz 06', 'Maguncia', '#dc2626', '#f8fafc'],
  ['FC K\u00f6lln', 'Colonia', '#f8fafc', '#dc2626'],
  ['Hamburger SC', 'Hamburgo', '#1d4ed8', '#f8fafc'],
  ['FC St. Paoli', 'Hamburgo', '#78350f', '#f8fafc'],
  ['Heidenhaim FC', 'Heidenheim', '#dc2626', '#1e3a8a'],
  ['Shalke 04', 'Gelsenkirchen', '#2563eb', '#f8fafc'],
  ['VfL Bochun', 'Bochum', '#2563eb', '#f8fafc'],
])

export const ALE_DIV2: ClubDef[] = buildDiv2([
  ['Herta BSC', 'Berl\u00edn', '#2563eb', '#f8fafc'],
  ['Hannover 97', 'Hannover', '#16a34a', '#111827'],
  ['Fortuna Dusseldorp', 'D\u00fcsseldorf', '#dc2626', '#f8fafc'],
  ['1. FC N\u00fcrnbergh', 'N\u00farenberg', '#7f1d1d', '#111827'],
  ['Karlsruher SK', 'Karlsruhe', '#1d4ed8', '#f8fafc'],
  ['Hansa Rostok', 'Rostock', '#1d4ed8', '#f8fafc'],
  ['Holstein Kyel', 'Kiel', '#1d4ed8', '#dc2626'],
  ['Darmstadt 99', 'Darmstadt', '#1d4ed8', '#f8fafc'],
  ['Greuther F\u00fcrt', 'F\u00fcrth', '#16a34a', '#f8fafc'],
  ['Paderborn 08', 'Paderborn', '#2563eb', '#111827'],
  ['Magdeburgh FC', 'Magdeburgo', '#2563eb', '#f8fafc'],
  ['Kaiserslautem', 'Kaiserslautern', '#dc2626', '#f8fafc'],
  ['Eintracht Braunschwig', 'Brunswick', '#facc15', '#1e3a8a'],
  ['SV Elversberh', 'Spiesen-Elversberg', '#111827', '#f8fafc'],
  ['Prusia M\u00fcnster', 'M\u00fcnster', '#16a34a', '#111827'],
  ['Arminia Bielfeld', 'Bielefeld', '#1d4ed8', '#f8fafc'],
  ['Dynamo Dresdem', 'Dresde', '#facc15', '#111827'],
  ['Jahn Regensburgo', 'Ratisbona', '#dc2626', '#f8fafc'],
  ['VfL Osnabr\u00fck', 'Osnabr\u00fcck', '#7c3aed', '#f8fafc'],
])

/* ---------- Francia ---------- */
export const FRA_DIV1: ClubDef[] = buildDiv1([
  ['Paris Saint-Germaine', 'Par\u00eds', '#1e3a8a', '#dc2626'],
  ['Olympique Marsella', 'Marsella', '#38bdf8', '#f8fafc'],
  ['Olympique Lyonais', 'Lyon', '#f8fafc', '#1d4ed8'],
  ['AS Monacco', 'M\u00f3naco', '#dc2626', '#f8fafc'],
  ['LOSC Lilla', 'Lille', '#dc2626', '#1e3a8a'],
  ['RC Lenz', 'Lens', '#facc15', '#dc2626'],
  ['OGC Niza', 'Niza', '#dc2626', '#111827'],
  ['Stade Rennaise', 'Rennes', '#dc2626', '#111827'],
  ['RC Strasbourgh', 'Estrasburgo', '#2563eb', '#f8fafc'],
  ['FC Nanttes', 'Nantes', '#facc15', '#16a34a'],
  ['Toulouze FC', 'Toulouse', '#7c3aed', '#f8fafc'],
  ['Montpelier HSC', 'Montpellier', '#f97316', '#1e3a8a'],
  ['Stade de Rems', 'Reims', '#dc2626', '#f8fafc'],
  ['Stade Brestoise', 'Brest', '#dc2626', '#f8fafc'],
  ['FC Lorrient', 'Lorient', '#f97316', '#111827'],
  ['Angiers SCO', 'Angers', '#111827', '#f8fafc'],
  ['AJ Auxerr', 'Auxerre', '#f8fafc', '#1d4ed8'],
  ['Le Havere AC', 'Le Havre', '#7dd3fc', '#1e3a8a'],
  ['FC Mets', 'Metz', '#7f1d1d', '#f8fafc'],
  ['AS Saint-Etien', 'Saint-\u00c9tienne', '#16a34a', '#f8fafc'],
])

export const FRA_DIV2: ClubDef[] = buildDiv2([
  ['Girondins Bordeos', 'Burdeos', '#1e3a8a', '#f8fafc'],
  ['Parris FC', 'Par\u00eds', '#2563eb', '#f8fafc'],
  ['ESTAC Troie', 'Troyes', '#2563eb', '#f8fafc'],
  ['Le Manz FC', 'Le Mans', '#facc15', '#dc2626'],
  ['SM Caenn', 'Caen', '#1d4ed8', '#dc2626'],
  ['EA Guingan', 'Guingamp', '#dc2626', '#111827'],
  ['FC Soch\u00f3', 'Sochaux', '#facc15', '#1e3a8a'],
  ['AS Nansy', 'Nancy', '#f8fafc', '#dc2626'],
  ['Amienz SC', 'Amiens', '#f8fafc', '#111827'],
  ['USL Dunkerke', 'Dunkerque', '#1d4ed8', '#dc2626'],
  ['Rodes AF', 'Rodez', '#facc15', '#dc2626'],
  ['Red Starr FC', 'Saint-Ouen', '#16a34a', '#f8fafc'],
  ['Pau FK', 'Pau', '#facc15', '#1e3a8a'],
  ['Grenobl Foot', 'Grenoble', '#1d4ed8', '#f8fafc'],
  ['FC Annesy', 'Annecy', '#dc2626', '#f8fafc'],
  ['Clermon Foot', 'Clermont-Ferrand', '#dc2626', '#1e3a8a'],
  ['Stade Lavalloise', 'Laval', '#f97316', '#111827'],
  ['SC Bastya', 'Bastia', '#2563eb', '#f8fafc'],
  ['Valensiennes FC', 'Valenciennes', '#dc2626', '#f8fafc'],
])

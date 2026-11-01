import type { Club } from './types'
import { europeInfo } from './europe'
import type { EuropeId } from './europe'
import { REACH_LABEL } from './tournament'
import { COPA, REACH_TEXT, SUPERCOPA } from './domestic'
import { TOTAL_SEASONS } from './config'
import { formatMoney } from './data'
import { legendScore } from './game'
import { activeLeague } from './activeLeague'
import type { GameState, Legend, SeasonRecord } from './game'

/* ==========================================================================
   Paso 10: legado. Todo sale del historial de la partida (game.history y game.legends),
   así que funciona a mitad de carrera igual que al terminar las 30 temporadas.
   ========================================================================== */

export interface Legacy {
  seasons: number // temporadas jugadas
  leagueTitles: number // ligas de 1.ª
  secondTitles: number // ligas de 2.ª
  promotions: number
  relegations: number
  seasonsFirst: number
  seasonsSecond: number
  bestPosition: number | null // mejor puesto en 1.ª
  euroTitles: Partial<Record<EuropeId, number>>
  euroTitleCount: number
  euroFinals: number // finales jugadas (ganadas o perdidas)
  euroSeasons: number
  copaTitles: number // Copa del Rey ganadas
  copaFinals: number // finales de Copa jugadas (ganadas o perdidas)
  supercopaTitles: number
  supercopaFinals: number
  bestSeason: SeasonRecord | null // la temporada con más puntos en 1.ª
  firstTitle: { season: number; label: string } | null
  legends: Legend[]
  topScorer: Legend | null
  verdict: { title: string; text: string }
  score: number
}

const EMPTY_VERDICT = { title: 'Proyecto en marcha', text: 'Aún queda mucha historia por escribir.' }

// Veredicto según lo conseguido (ajustable aquí)
function verdictFor(score: number, finished: boolean): { title: string; text: string } {
  if (score >= 90) return { title: 'Dinastía legendaria', text: `Dominaste ${activeLeague().name} y Europa: tu club entra en la historia del fútbol.` }
  if (score >= 55) return { title: 'Potencia continental', text: 'Títulos nacionales y copas europeas: un club temido en todo el continente.' }
  if (score >= 30) return { title: 'Potencia nacional', text: `Tu club se asentó entre los grandes de ${activeLeague().name} y dejó su huella.` }
  if (score >= 12) return { title: 'Club respetable', text: 'Creciste desde abajo y le diste a la afición días de orgullo.' }
  return finished
    ? { title: 'Club de barrio', text: 'Una historia humilde, pero el club sigue en pie y la afición no te olvida.' }
    : EMPTY_VERDICT
}

export function buildLegacy(game: GameState): Legacy {
  const h = game.history
  const euroTitles: Partial<Record<EuropeId, number>> = {}
  let euroFinals = 0
  let euroSeasons = 0
  let firstTitle: Legacy['firstTitle'] = null
  const note = (season: number, label: string) => {
    if (!firstTitle) firstTitle = { season, label }
  }

  for (const r of h) {
    if (r.champion && r.division === 1) note(r.season, 'Primera liga de 1.ª división')
    if (r.copa?.champion) note(r.season, `Primera ${COPA.name}`)
    if (r.supercopa?.champion) note(r.season, `Primera ${SUPERCOPA.name}`)
    if (r.euro) {
      euroSeasons++
      if (r.euro.reach === 'final' || r.euro.champion) euroFinals++
      if (r.euro.champion) {
        euroTitles[r.euro.comp] = (euroTitles[r.euro.comp] ?? 0) + 1
        note(r.season, `Primer título europeo (${europeInfo(r.euro.comp).name})`)
      }
    }
  }

  const leagueTitles = h.filter((r) => r.champion && r.division === 1).length
  const secondTitles = h.filter((r) => r.champion && r.division === 2).length
  const euroTitleCount = Object.values(euroTitles).reduce((a, b) => a + (b ?? 0), 0)
  const copaTitles = h.filter((r) => r.copa?.champion).length
  const copaFinals = h.filter((r) => r.copa && (r.copa.champion || r.copa.reach === 'final')).length
  const supercopaTitles = h.filter((r) => r.supercopa?.champion).length
  const supercopaFinals = h.filter((r) => r.supercopa && (r.supercopa.champion || r.supercopa.reach === 'final')).length
  const firstDiv = h.filter((r) => r.division === 1)
  const bestSeason = firstDiv.length ? [...firstDiv].sort((a, b) => b.points - a.points)[0] : null
  const legends = Object.values(game.legends).sort((a, b) => legendScore(b) - legendScore(a) || a.name.localeCompare(b.name))
  const topScorer = [...legends].sort((a, b) => b.goals - a.goals)[0] ?? null
  const bestPosition = firstDiv.length ? Math.min(...firstDiv.map((r) => r.position)) : null

  // La Gran Copa vale más que las otras competiciones europeas
  const champions = euroTitles.champions ?? 0
  const score =
    leagueTitles * 5 +
    secondTitles * 1 +
    champions * 10 +
    (euroTitleCount - champions) * 5 +
    euroFinals * 1 +
    copaTitles * 3 +
    (copaFinals - copaTitles) * 0.5 +
    supercopaTitles * 1.5 +
    (supercopaFinals - supercopaTitles) * 0.25 +
    h.filter((r) => r.promoted).length * 1.5 +
    firstDiv.length * 0.4

  return {
    seasons: h.length,
    leagueTitles,
    secondTitles,
    promotions: h.filter((r) => r.promoted).length,
    relegations: h.filter((r) => r.relegated).length,
    seasonsFirst: firstDiv.length,
    seasonsSecond: h.length - firstDiv.length,
    bestPosition,
    euroTitles,
    euroTitleCount,
    euroFinals,
    euroSeasons,
    copaTitles,
    copaFinals,
    supercopaTitles,
    supercopaFinals,
    bestSeason,
    firstTitle,
    legends,
    topScorer,
    verdict: verdictFor(score, game.finished || h.length >= TOTAL_SEASONS),
    score: Math.round(score),
  }
}

// Texto listo para pegar en un chat o en una red social
export function legacyText(club: Club, game: GameState, budget: number): string {
  const l = buildLegacy(game)
  const lines = [
    `🏟️ ${club.name} · Lifetime`,
    `${l.verdict.title} — ${l.seasons} ${l.seasons === 1 ? 'temporada' : 'temporadas'} de ${TOTAL_SEASONS}`,
    '',
    `🏆 Ligas de 1.ª: ${l.leagueTitles}${l.secondTitles ? ` (y ${l.secondTitles} de 2.ª)` : ''}`,
  ]
  for (const [id, n] of Object.entries(l.euroTitles)) lines.push(`${europeInfo(id as EuropeId).icon} ${europeInfo(id as EuropeId).name}: ${n}`)
  if (l.euroTitleCount === 0) lines.push(`🌍 Títulos europeos: 0${l.euroFinals ? ` (${l.euroFinals} ${l.euroFinals === 1 ? 'final' : 'finales'})` : ''}`)
  lines.push(`${COPA.icon} ${COPA.name}: ${l.copaTitles}${l.copaFinals > l.copaTitles ? ` (${l.copaFinals - l.copaTitles} ${l.copaFinals - l.copaTitles === 1 ? 'final perdida' : 'finales perdidas'})` : ''}`)
  lines.push(`${SUPERCOPA.icon} ${SUPERCOPA.name}: ${l.supercopaTitles}`)
  lines.push(`📈 Ascensos: ${l.promotions} · Descensos: ${l.relegations}`)
  if (l.bestPosition) lines.push(`🥇 Mejor puesto en 1.ª: ${l.bestPosition}.º`)
  const top = l.legends.slice(0, 3)
  if (top.length) {
    lines.push('', '⭐ Leyendas del club:')
    top.forEach((p) => lines.push(`• ${p.name} (${p.pos}) — ${p.goals} goles, ${p.titles} títulos, mejor valoración ${p.peak}`))
  }
  lines.push('', `💰 Presupuesto final: ${formatMoney(budget)} · Prestigio: ${game.prestige}`)
  return lines.join('\n')
}

export function seasonLine(r: SeasonRecord): string {
  const bits = [`${r.position}.º en ${r.division}.ª`]
  if (r.champion) bits.push('campeón')
  if (r.promoted) bits.push('ascenso')
  if (r.relegated) bits.push('descenso')
  if (r.euro) bits.push(`${europeInfo(r.euro.comp).short}: ${REACH_LABEL[r.euro.reach]}`)
  if (r.copa) bits.push(`${COPA.short}: ${REACH_TEXT[r.copa.reach]}`)
  if (r.supercopa) bits.push(`${SUPERCOPA.short}: ${REACH_TEXT[r.supercopa.reach]}`)
  return bits.join(' · ')
}

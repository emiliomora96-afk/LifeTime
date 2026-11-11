import { describe, expect, it } from 'vitest'
import { advance, initialGame } from './game'
import type { GameState } from './game'
import { BALON, balonPrestige, computeBalonDeOro } from './balonDeOro'
import { buildLegacy, legacyText } from './legacy'
import { sponsorPrestige } from './economy'
import type { Club } from './types'

const CLUB: Club = {
  league: 'España', division: 2, name: 'Club de Prueba', city: 'Santo Domingo',
  primaryColor: '#c62828', secondaryColor: '#ffffff', crestShape: 'classic', stadium: 'Estadio Test', budget: 2_000_000,
}

// Juega una carrera entera dejándose llevar, y guarda lo que había al llegar a cada gala de premios
function play(seed: number) {
  let s = seed
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  let g = initialGame(rng)
  const galas: GameState[] = []
  let guard = 0
  while (!g.finished && guard++ < 800) {
    g = advance(g, rng)
    if (g.eventId === 'gala') galas.push(g)
  }
  return { g, galas }
}

describe('Lifetime Balón de Oro', () => {
  const { g, galas } = play(11)

  it('hay un Balón de Oro por temporada, con los mejores ordenados por puntos', () => {
    expect(g.history.every((r) => r.balon && r.balon.top.length === BALON.keep)).toBe(true)
    for (const r of g.history) {
      const pts = (r.balon?.top ?? []).map((e) => e.points)
      expect(pts).toEqual([...pts].sort((a, b) => b - a))
    }
  })

  it('el ganador de la gala es el mismo que queda en el historial', () => {
    expect(galas.length).toBe(g.history.length)
    for (const gala of galas) {
      const shown = computeBalonDeOro({ league: gala.league, champions: gala.champions, domestic: gala.domestic, season: gala.season, seed: gala.seed })
      const saved = g.history.find((r) => r.season === gala.season)?.balon
      expect(shown?.top[0].id).toBe(saved?.top[0].id)
      expect(shown?.top[0].points).toBe(saved?.top[0].points)
    }
  })

  it('los puntos son títulos + ranking (más un desempate de menos de 1 punto)', () => {
    for (const r of g.history) {
      for (const e of r.balon?.top ?? []) {
        const titles = e.titles.reduce((n, t) => n + BALON.titles[t], 0)
        expect(e.titlePts).toBe(titles)
        expect(Math.abs(e.points - (e.titlePts + e.rankPts))).toBeLessThanOrEqual(BALON.tiebreak)
      }
    }
  })

  it('el prestigio solo va a clubes de tu liga: +3 al ganador, +1 al 2.º y 3.º', () => {
    const rec = g.history.find((r) => r.balon && r.balon.top.slice(0, 3).every((e) => e.teamId !== null))?.balon ?? null
    expect(rec).not.toBeNull()
    expect(balonPrestige(rec).map((a) => a.bonus)).toEqual([3, 1, 1])
  })

  it('el legado cuenta los Balones de Oro de tu club', () => {
    const l = buildLegacy(g)
    const mine = g.history.filter((r) => r.balon?.top[0].club === null).length
    expect(l.balonWins).toHaveLength(mine)
    expect(legacyText(CLUB, g, 0)).toContain(BALON.name)
  })

  it('los delanteros y medios que ganan tienen números de ganador (goles y asistencias de liga, copas y Champions)', () => {
    const ganadores = g.history.flatMap((r) => (r.balon ? [r.balon.top[0]] : []))
    const ofensivos = ganadores.filter((w) => w.pos === 'DEL' || w.pos === 'MED')
    expect(ofensivos.length).toBeGreaterThan(0)
    for (const w of ofensivos) expect(w.goals + w.assists).toBeGreaterThanOrEqual(12)
  })

  it('el prestigio no tiene tope, pero los patrocinios sí', () => {
    expect(sponsorPrestige(250)).toBe(100)
    expect(sponsorPrestige(40)).toBe(40)
  })
})

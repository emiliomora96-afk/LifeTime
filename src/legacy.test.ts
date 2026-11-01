import { describe, expect, it } from 'vitest'
import { advance, initialGame, legendScore, parseGame } from './game'
import type { GameState } from './game'
import { TOTAL_SEASONS } from './config'
import { buildLegacy, legacyText } from './legacy'
import { exportSave, importSave } from './save'
import type { Club } from './types'

const CLUB: Club = {
  league: 'España',
  division: 2,
  name: 'Club de Prueba',
  city: 'Santo Domingo',
  primaryColor: '#c62828',
  secondaryColor: '#ffffff',
  crestShape: 'classic',
  stadium: 'Estadio Test',
  budget: 2_000_000,
}

// Juega una carrera entera saltando todas las paradas (sin tocar nada, como un club que se deja llevar)
function playAll(seed: number): GameState {
  let rngState = seed
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0
    return rngState / 4294967296
  }
  let g = initialGame(rng)
  let guard = 0
  while (!g.finished && guard++ < 600) g = advance(g, rng)
  return g
}

describe('Paso 10: 30 temporadas seguidas', () => {
  const g = playAll(5)

  it('la partida llega al final sin romperse', () => {
    expect(g.finished).toBe(true)
    expect(g.season).toBe(TOTAL_SEASONS)
    expect(g.history).toHaveLength(TOTAL_SEASONS)
    expect(g.history.map((r) => r.season)).toEqual(Array.from({ length: TOTAL_SEASONS }, (_, i) => i + 1))
  })

  it('cada temporada guarda el nivel, el mejor jugador y el goleador del club', () => {
    for (const r of g.history) {
      expect(r.strength).toBeGreaterThan(40)
      expect(r.bestPlayer).toBeTruthy()
    }
    expect(g.history.filter((r) => r.topScorer).length).toBeGreaterThan(20)
  })

  it('los jugadores que pasaron por el club quedan en las leyendas aunque se hayan retirado', () => {
    const legends = Object.values(g.legends)
    expect(legends.length).toBeGreaterThan(30)
    const retired = legends.filter((l) => l.lastSeason < TOTAL_SEASONS)
    expect(retired.length).toBeGreaterThan(10)
    for (const l of legends) {
      expect(l.seasons).toBeGreaterThanOrEqual(1)
      expect(l.lastSeason).toBeGreaterThanOrEqual(l.firstSeason)
    }
    const goals = legends.reduce((s, l) => s + l.goals, 0)
    expect(goals).toBeGreaterThan(100)
  })

  it('el legado resume títulos, ascensos y jugadores históricos', () => {
    const l = buildLegacy(g)
    expect(l.seasons).toBe(TOTAL_SEASONS)
    expect(l.promotions).toBe(g.history.filter((r) => r.promoted).length)
    expect(l.seasonsFirst + l.seasonsSecond).toBe(TOTAL_SEASONS)
    expect(l.legends.length).toBeGreaterThan(0)
    for (let i = 1; i < l.legends.length; i++) expect(legendScore(l.legends[i - 1])).toBeGreaterThanOrEqual(legendScore(l.legends[i]))
    expect(l.verdict.title.length).toBeGreaterThan(0)
  })

  it('el texto para compartir menciona el club, las temporadas y las leyendas', () => {
    const text = legacyText(CLUB, g, 1_234_000)
    expect(text).toContain('Club de Prueba')
    expect(text).toContain(`${TOTAL_SEASONS} temporadas`)
    expect(text).toContain('Leyendas')
  })

  it('el guardado resiste el viaje a texto y vuelta sin perder nada', () => {
    const text = exportSave(CLUB, g)
    const back = importSave(text)
    expect(back.ok).toBe(true)
    if (back.ok) {
      expect(back.club.name).toBe('Club de Prueba')
      expect(back.game.history).toHaveLength(TOTAL_SEASONS)
      expect(back.game.finished).toBe(true)
      expect(Object.keys(back.game.legends)).toHaveLength(Object.keys(g.legends).length)
      expect(back.game.league.year).toBe(g.league.year)
    }
  })
})

describe('Paso 10: guardar y cargar a mitad de carrera', () => {
  it('una partida a mitad de camino se carga igual y se puede seguir jugando', () => {
    let g = initialGame()
    for (let i = 0; i < 40; i++) g = advance(g)
    const loaded = parseGame(JSON.parse(JSON.stringify(g)))
    expect(loaded).not.toBeNull()
    expect(loaded?.season).toBe(g.season)
    expect(loaded?.history).toHaveLength(g.history.length)
    const next = advance(loaded as GameState)
    expect(next.finished).toBe(false)
  })

  it('un archivo dañado o de otro juego se rechaza con un mensaje claro', () => {
    expect(importSave('no es json').ok).toBe(false)
    expect(importSave('{"format":"otro"}').ok).toBe(false)
    const g = initialGame()
    const broken = JSON.stringify({ format: 'lifetime-save', version: 1, club: CLUB, game: { ...g, league: { v: 1 } } })
    const r = importSave(broken)
    expect(r.ok).toBe(false)
  })

  it('una partida de una versión anterior no se carga (parseGame devuelve null)', () => {
    const g = initialGame()
    expect(parseGame({ ...g, league: { ...g.league, v: 1 } })).toBeNull()
    expect(parseGame(null)).toBeNull()
  })
})

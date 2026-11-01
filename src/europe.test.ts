import { describe, expect, it } from 'vitest'
import { advance, initialGame } from './game'
import type { GameState } from './game'
import { USER_ID } from './engine'
import type { SimTeam } from './engine'
import {
  EUROPE,
  EUROPE_IDS,
  QUALIFIED_POSITIONS,
  SUPERCUP,
  buildEurope,
  buildEuropeFromLeague,
  qualifyFor,
  rankedFirstDivision,
  spanishQualifiers,
  userQualification,
} from './europe'

// Paso 8: clasificación a Europa. Las tres competiciones clasifican por posición en 1.ª división;
// la Supercopa la juegan los campeones de las dos primeras (se resuelve en el Paso 9).

function playToClose(): GameState {
  let game = initialGame()
  for (let guard = 0; guard < 40; guard++) {
    if (game.eventId === null && game.baseStop === 'cierre') return game
    game = advance(game)
  }
  throw new Error('La temporada nunca llegó al cierre')
}

describe('Paso 8: reglas de clasificación', () => {
  it('cada posición lleva a la competición correcta', () => {
    expect([1, 2, 3, 4].map(qualifyFor)).toEqual(['champions', 'champions', 'champions', 'champions'])
    expect([5, 6].map(qualifyFor)).toEqual(['europa', 'europa'])
    expect(qualifyFor(7)).toBe('conferencia')
    expect([8, 12, 20].map(qualifyFor)).toEqual([null, null, null])
  })

  it('las posiciones de las competiciones no se repiten ni dejan huecos', () => {
    const all = EUROPE.flatMap((c) => c.positions).sort((a, b) => a - b)
    expect(all).toEqual(Array.from({ length: QUALIFIED_POSITIONS }, (_, i) => i + 1))
  })

  it('la Supercopa se juega entre campeones de competiciones que existen', () => {
    expect(SUPERCUP.between).toHaveLength(2)
    for (const id of SUPERCUP.between) expect(EUROPE_IDS).toContain(id)
  })
})

describe('Paso 8: competiciones armadas al cerrar la temporada', () => {
  const closes = Array.from({ length: 12 }, playToClose)

  it('cada competición tiene todos sus clubes y nadie se repite', () => {
    for (const game of closes) {
      const europe = buildEuropeFromLeague(game.league, 2, 123)
      const names = new Set<string>()
      for (const comp of EUROPE) {
        const field = europe.fields[comp.id]
        expect(field).toHaveLength(comp.fieldSize)
        for (const e of field) {
          expect(Number.isFinite(e.level)).toBe(true)
          expect(e.level).toBeGreaterThanOrEqual(62)
          expect(e.level).toBeLessThanOrEqual(88)
          expect(names.has(e.id)).toBe(false) // ni dentro de una competición ni entre ellas
          names.add(e.id)
        }
      }
    }
  })

  it('los españoles que clasifican son los de 1.ª división en su orden de liga', () => {
    for (const game of closes) {
      const ranked = rankedFirstDivision(game.league)
      const europe = buildEuropeFromLeague(game.league, 2, 5)
      for (const comp of EUROPE) {
        const expected = ranked.filter((_, i) => qualifyFor(i + 1) === comp.id).map((t) => `esp-${t.id}`)
        const got = europe.fields[comp.id].filter((e) => e.country === 'ESP').map((e) => e.id)
        expect(got.sort()).toEqual(expected.sort())
      }
    }
  })

  it('tu club en 2.ª no clasifica a nada', () => {
    for (const game of closes) {
      expect(game.league.userDivision).toBe(2)
      expect(buildEuropeFromLeague(game.league, 2, 9).user).toBeNull()
      expect(userQualification(game.league).competition).toBeNull()
    }
  })

  it('los invitados son más fuertes cuanto más importante es la competición', () => {
    const europe = buildEuropeFromLeague(closes[0].league, 2, 77)
    const avg = (id: (typeof EUROPE_IDS)[number]) => {
      const inv = europe.fields[id].filter((e) => e.country !== 'ESP')
      return inv.reduce((n, e) => n + e.level, 0) / inv.length
    }
    expect(avg('champions')).toBeGreaterThan(avg('europa'))
    expect(avg('europa')).toBeGreaterThan(avg('conferencia'))
  })

  it('con la misma semilla sale lo mismo', () => {
    const a = buildEuropeFromLeague(closes[0].league, 2, 42)
    const b = buildEuropeFromLeague(closes[0].league, 2, 42)
    expect(a).toEqual(b)
  })

  it('spanishQualifiers lista 4, 2 y 1 clubes', () => {
    const q = spanishQualifiers(closes[0].league)
    expect([q.champions.length, q.europa.length, q.conferencia.length]).toEqual([4, 2, 1])
  })
})

describe('Paso 8: tu club puede clasificarse', () => {
  const ranked = rankedFirstDivision(playToClose().league)
  const asUser = (position: number): SimTeam[] => ranked.map((t, i) => (i === position - 1 ? { ...t, id: USER_ID, name: '' } : t.id === USER_ID ? { ...t, id: 9999 } : t))

  it('en cada posición de clasificación te ponen en la competición que toca', () => {
    for (let pos = 1; pos <= QUALIFIED_POSITIONS; pos++) {
      const europe = buildEurope(asUser(pos), 2, 1)
      expect(europe.user).toBe(qualifyFor(pos))
      const field = europe.fields[qualifyFor(pos)!]
      expect(field.filter((e) => e.user)).toHaveLength(1)
    }
  })

  it('fuera de los puestos europeos no apareces en ninguna', () => {
    const europe = buildEurope(asUser(QUALIFIED_POSITIONS + 1), 2, 1)
    expect(europe.user).toBeNull()
    for (const id of EUROPE_IDS) expect(europe.fields[id].some((e) => e.user)).toBe(false)
  })
})

describe('Paso 8: dentro del flujo del juego', () => {
  it('al cerrar la temporada se guarda la Europa de la siguiente y el historial lo recuerda', () => {
    let game = playToClose()
    expect(game.europe).toBeNull() // en la temporada 1 todavía no hay Europa
    for (let i = 0; i < 6 && game.season === 1; i++) game = advance(game)
    expect(game.season).toBe(2)
    expect(game.europe).not.toBeNull()
    expect(game.europe?.season).toBe(2)
    for (const comp of EUROPE) expect(game.europe?.fields[comp.id]).toHaveLength(comp.fieldSize)
    expect(game.history[0].europe).toBeNull() // empiezas en 2.ª: no clasificas
  })
})

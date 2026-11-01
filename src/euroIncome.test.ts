import { describe, expect, it } from 'vitest'
import { advance, initialGame } from './game'
import type { GameState } from './game'
import { buildEuropeFromLeague } from './europe'
import type { EuropeId } from './europe'
import { clChampionEntrant, clMatchOutcome, clUser, clUserMatches, playChampionsKnockout } from './champions'
import type { ClState } from './champions'
import { matchOutcome, playEuropeSeason, userEntrant, userMatches } from './tournament'
import { EURO_PRIZES } from './economy'
import { europeFinalIncome, europeIncome } from './euroIncome'
import { seasonIncome, total } from './finance'

function playToClose(): GameState {
  let game = initialGame()
  for (let guard = 0; guard < 40; guard++) {
    if (game.eventId === null && game.baseStop === 'cierre') return game
    game = advance(game)
  }
  throw new Error('La temporada nunca llegó al cierre')
}

const base = playToClose()

// Tu club dentro de una competición europea de la temporada 2
function inEurope(comp: EuropeId, seed: number): GameState {
  const europe0 = buildEuropeFromLeague(base.league, 2, seed)
  const fields = {
    ...europe0.fields,
    [comp]: europe0.fields[comp].map((e, i) => (i === 0 ? { ...e, id: 'user', name: '', country: 'ESP', user: true } : e)),
  }
  return { ...base, season: 2, europe: { ...europe0, user: comp, fields }, champions: null, tournament: null }
}

// Pasa por lo mismo que el juego: fase de liga al inicio y eliminatorias / torneo al final
function played(comp: EuropeId, seed: number): GameState {
  const g = inEurope(comp, seed)
  const cl = playChampionsKnockout({ ...g, champions: null }) as ClState | null
  const ts = playEuropeSeason({ ...g, clChampion: cl ? clChampionEntrant(cl) : null })
  return { ...g, champions: cl, tournament: ts }
}

describe('ingresos europeos', () => {
  it('sin Europa no hay ingresos europeos', () => {
    expect(europeIncome({ ...base, europe: null })).toHaveLength(0)
  })

  it('al clasificar ya se cobra la participación, antes de jugar nada', () => {
    for (const comp of ['champions', 'europa', 'conferencia'] as EuropeId[]) {
      const lines = europeIncome(inEurope(comp, 3))
      expect(lines).toHaveLength(1)
      expect(lines[0].amount).toBe(EURO_PRIZES[comp].participation)
      expect(lines[0].final).toBe(false)
    }
  })

  it('Champions: fase de liga y clasificación directa se cobran con el cierre; el resto, al final del torneo', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = played('champions', seed)
      const cl = g.champions as ClState
      const me = clUser(cl)!
      const p = EURO_PRIZES.champions
      const liga = clUserMatches(cl).filter((m) => m.stage === 'liga')
      const w = liga.filter((m) => clMatchOutcome(m, me.id) === 'win').length
      const d = liga.filter((m) => clMatchOutcome(m, me.id) === 'draw').length
      const lines = europeIncome(g)

      const now = lines.filter((l) => !l.final)
      const direct = cl.table.findIndex((r) => r.id === me.id) < 8
      expect(total(now)).toBe(p.participation + w * p.win + d * p.draw + (direct ? p.directBonus : 0))

      // Lo de la fase final: rondas superadas y título
      let rounds = 0
      for (const r of cl.rounds) for (const t of r.ties) if (t.winner === me.id && r.stage !== 'final') rounds += p.rounds[r.stage]
      const champion = cl.champion === me.id ? p.champion : 0
      expect(total(europeFinalIncome(g))).toBe(rounds + champion)
    }
  })

  it('Europa League y Copa Horizonte: grupos, rondas y título se cobran al final', () => {
    for (const comp of ['europa', 'conferencia'] as EuropeId[]) {
      for (const seed of [1, 2, 3, 4]) {
        const g = played(comp, seed)
        const t = g.tournament!.main
        const me = userEntrant(t)!
        const p = EURO_PRIZES[comp]
        const mine = userMatches(t)
        const group = mine.filter((m) => m.stage === 'group')
        let expected = group.filter((m) => matchOutcome(m, me.id) === 'win').length * p.win
        expected += group.filter((m) => matchOutcome(m, me.id) === 'draw').length * p.draw
        if (mine.some((m) => m.stage === 'quarter')) expected += p.rounds.group
        for (const m of mine) if (m.stage !== 'group' && m.stage !== 'final' && m.winner === me.id) expected += p.rounds[m.stage]
        if (t.champion === me.id) expected += p.champion
        expect(total(europeFinalIncome(g))).toBe(expected)
        expect(total(europeIncome(g))).toBe(expected + p.participation)
      }
    }
  })

  it('el balance del cierre solo cuenta lo que ya se jugó; el dinero de la fase final aparece cuando se juega', () => {
    const g = inEurope('champions', 7)
    const antes = seasonIncome(g).filter((l) => l.label.startsWith('Champions'))
    expect(antes).toHaveLength(1)
    const despues = seasonIncome(played('champions', 7)).filter((l) => l.label.startsWith('Champions'))
    expect(despues.length).toBeGreaterThan(1)
  })
})

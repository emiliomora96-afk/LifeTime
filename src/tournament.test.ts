import { describe, expect, it } from 'vitest'
import { advance, initialGame } from './game'
import { clChampionEntrant, playChampionsKnockout } from './champions'
import type { GameState } from './game'
import { buildEuropeFromLeague } from './europe'
import type { EuropeId } from './europe'
import {
  FIELD_SIZE,
  GROUP_COUNT,
  GROUP_ROUNDS,
  GROUP_SIZE,
  allMatches,
  groupTable,
  matchOutcome,
  playEuropeSeason,
  simulateTournament,
  tournamentScorers,
  userMatches,
  userParticipates,
  userReach,
} from './tournament'
import type { Tournament } from './tournament'

// Paso 9: el motor calcula todo el torneo antes de abrir la pantalla.

function playToClose(): GameState {
  let game = initialGame()
  for (let guard = 0; guard < 40; guard++) {
    if (game.eventId === null && game.baseStop === 'cierre') return game
    game = advance(game)
  }
  throw new Error('La temporada nunca llegó al cierre')
}

const base = playToClose()

// Un torneo con tu club dentro
function withUser(seed: number): Tournament {
  const league = base.league
  const europe = buildEuropeFromLeague(league, 2, seed)
  const entrants = europe.fields.europa.map((e, i) =>
    i === 0 ? { ...e, id: 'user', name: '', country: 'ESP', user: true } : e,
  )
  return simulateTournament('europa', entrants, league, seed, 2)
}

describe('Paso 9: formato del torneo', () => {
  const europe = buildEuropeFromLeague(base.league, 2, 11)
  const t = simulateTournament('europa', europe.fields.europa, base.league, 11, 2)

  it('16 clubes, 4 grupos de 4, cuartos, semifinales y final', () => {
    expect(FIELD_SIZE).toBe(GROUP_COUNT * GROUP_SIZE)
    expect(t.groups).toHaveLength(GROUP_COUNT)
    for (const g of t.groups) {
      expect(g.ids).toHaveLength(GROUP_SIZE)
      expect(g.matches).toHaveLength((GROUP_SIZE * (GROUP_SIZE - 1)) / 2 * (GROUP_ROUNDS / (GROUP_SIZE - 1)))
    }
    expect(t.rounds.map((r) => r.matches.length)).toEqual([4, 2, 1])
    expect(allMatches(t)).toHaveLength(t.groups.reduce((n, g) => n + g.matches.length, 0) + 7)
  })

  it('nadie se repite en los grupos y todos los clubes están', () => {
    const ids = t.groups.flatMap((g) => g.ids)
    expect(new Set(ids).size).toBe(FIELD_SIZE)
    expect(ids.sort()).toEqual(t.entrants.map((e) => e.id).sort())
  })

  it('los goles de cada partido coinciden con el marcador y con los goleadores', () => {
    for (const m of allMatches(t)) {
      expect(m.goals.filter((g) => g.side === 0)).toHaveLength(m.hg)
      expect(m.goals.filter((g) => g.side === 1)).toHaveLength(m.ag)
      for (const g of m.goals) if (g.assist) expect(g.assist.id).not.toBe(g.scorer.id)
      expect(m.mvp).not.toBeNull()
    }
  })

  it('las eliminatorias nunca acaban empatadas y hay campeón', () => {
    for (const m of allMatches(t).filter((x) => x.stage !== 'group')) {
      expect(m.winner).not.toBeNull()
      if (m.hg === m.ag) expect(m.pens).not.toBeNull()
      if (m.pens) expect(m.pens[0]).not.toBe(m.pens[1])
    }
    const final = t.rounds[2].matches[0]
    expect(t.champion).toBe(final.winner)
    expect(t.runnerUp).not.toBe(t.champion)
  })

  it('pasan los dos primeros de cada grupo a cuartos', () => {
    const quarter = new Set(t.rounds[0].matches.flatMap((m) => [m.home, m.away]))
    expect(quarter.size).toBe(8)
    for (const g of t.groups) {
      const table = groupTable(g)
      expect(quarter.has(table[0].id)).toBe(true)
      expect(quarter.has(table[1].id)).toBe(true)
      expect(quarter.has(table[2].id)).toBe(false)
    }
  })

  it('los resultados son siempre los mismos con la misma semilla', () => {
    const again = simulateTournament('europa', europe.fields.europa, base.league, 11, 2)
    expect(again).toEqual(t)
  })

  it('hay goleadores y se pueden listar', () => {
    const rows = tournamentScorers(t)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].goals).toBeGreaterThanOrEqual(rows[rows.length - 1].goals)
  })
})

describe('Paso 9: tu club en el torneo', () => {
  it('sus partidos van en orden, de los grupos a la final', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const t = withUser(seed)
      const mine = userMatches(t)
      expect(mine.length).toBeGreaterThanOrEqual(GROUP_ROUNDS)
      mine.slice(0, GROUP_ROUNDS).forEach((m) => expect(m.stage).toBe('group'))
      for (let i = 1; i < mine.length; i++) expect(mine[i].seq).toBeGreaterThan(mine[i - 1].seq)
      const reach = userReach(t)
      expect(reach).not.toBeNull()
      // Si pierdes en una eliminatoria, ese es tu último partido
      const last = mine[mine.length - 1]
      if (reach === 'campeon') expect(matchOutcome(last, 'user')).toBe('win')
      else if (last.stage !== 'group') expect(matchOutcome(last, 'user')).toBe('loss')
    }
  })

  it('nadie gana siempre: los resultados varían entre torneos', () => {
    const reaches = new Set<string | null>()
    for (let seed = 1; seed <= 40; seed++) reaches.add(userReach(withUser(seed)))
    expect(reaches.size).toBeGreaterThan(1)
  })
})

describe('Paso 9: dentro del flujo del juego', () => {
  it('las tres competiciones se simulan y se guardan sus campeones', () => {
    const game = { ...base, season: 2, europe: buildEuropeFromLeague(base.league, 2, 5), champions: null }
    // La Champions (36 clubes) la calcula champions.ts; las otras dos, el formato de grupos
    const cl = playChampionsKnockout(game)
    const ts = playEuropeSeason({ ...game, clChampion: cl ? clChampionEntrant(cl) : null })
    expect(ts).not.toBeNull()
    for (const id of ['champions', 'europa', 'conferencia'] as EuropeId[]) expect(ts?.champions[id]).toBeDefined()
    // Tu club no está en Europa: se muestra la competición de grupos que se haya simulado, sin animación
    expect(ts?.main.comp).toBe('europa')
    expect(ts && userParticipates(ts)).toBe(false)
  })

  it('sin Europa esa temporada no hay torneo', () => {
    expect(playEuropeSeason({ ...base, europe: null })).toBeNull()
  })

  it('al cerrar una temporada con Europa aparece la parada del torneo antes de la gala', () => {
    let game = playToClose()
    game = { ...game, season: 2, europe: buildEuropeFromLeague(game.league, 2, 3) }
    game = advance(game) // sale del cierre
    expect(game.eventId).toBe('torneo')
    expect(game.tournament).not.toBeNull()
    expect(game.tournament?.season).toBe(2)
    game = advance(game)
    expect(game.eventId).toBe('gala')
    game = advance(game)
    expect(game.season).toBe(3)
    expect(game.tournament).toBeNull()
    expect(game.history[game.history.length - 1].euro ?? null).toBeNull() // tu club no jugaba
  })

  it('en la temporada 1 (sin Europa) no hay parada de torneo', () => {
    let game = playToClose()
    game = advance(game)
    expect(game.eventId).not.toBe('torneo')
  })

  it('se puede guardar y cargar la partida con el torneo dentro', () => {
    let game = playToClose()
    game = { ...game, season: 2, europe: buildEuropeFromLeague(game.league, 2, 3) }
    game = advance(game)
    const copy = JSON.parse(JSON.stringify(game)) as GameState
    expect(JSON.stringify(copy.tournament)).toBe(JSON.stringify(game.tournament))
  })
})

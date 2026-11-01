import { describe, expect, it } from 'vitest'
import { advance, initialGame } from './game'
import type { GameState } from './game'
import { buildEuropeFromLeague } from './europe'
import {
  CL_DIRECT,
  CL_LEAGUE_MATCHES,
  CL_PLAYOFF_LAST,
  CL_SIZE,
  clAllMatches,
  clReach,
  clRecord,
  clTable,
  clTieOf,
  clUserMatches,
  clUserPosition,
  playChampionsKnockout,
  playChampionsLeague,
} from './champions'
import type { ClState } from './champions'
import {
  GOAL_PAUSE_SECONDS,
  HALF_SECONDS,
  MAX_COUNTERS,
  ANIMATED_STAGES,
  QUICK_STAGES,
  SPEED,
  buildScript,
  isAnimated,
  matchSeconds,
} from './clTimeline'

// Lifetime Champions League: formato, calendario y línea de tiempo de la animación.

// Por defecto la Champions no se anima (ANIMATED_STAGES = solo la Supercopa). Para probar el motor de la
// animación, esta ayuda activa temporalmente las fases que se indiquen y luego deja la configuración como estaba.
function withAnimated<T>(stages: string[], fn: () => T): T {
  const saved = [...ANIMATED_STAGES]
  ANIMATED_STAGES.splice(0, ANIMATED_STAGES.length, ...stages)
  try {
    return fn()
  } finally {
    ANIMATED_STAGES.splice(0, ANIMATED_STAGES.length, ...saved)
  }
}
const ALL_STAGES = ['liga', 'playoff', 'octavos', 'cuartos', 'semi', 'final']

function playToClose(): GameState {
  let game = initialGame()
  for (let guard = 0; guard < 40; guard++) {
    if (game.eventId === null && game.baseStop === 'cierre') return game
    game = advance(game)
  }
  throw new Error('La temporada nunca llegó al cierre')
}

const base = playToClose()

// Tu club dentro de la Champions (con un nivel alto para llegar lejos en las eliminatorias)
function withUser(seed: number) {
  const europe0 = buildEuropeFromLeague(base.league, 2, seed)
  const fields = {
    ...europe0.fields,
    champions: europe0.fields.champions.map((e, i) => (i === seed % 6 ? { ...e, id: 'user', name: '', country: 'ESP', user: true } : e)),
  }
  const strong = {
    ...base.league,
    divisions: {
      ...base.league.divisions,
      2: {
        ...base.league.divisions[2],
        teams: base.league.divisions[2].teams.map((t) =>
          t.id === 0 ? { ...t, strength: 83, squad: t.squad.map((p) => ({ ...p, rating: Math.min(95, p.rating + 18) })) } : t,
        ),
      },
    },
  }
  return { league: strong, europe: { ...europe0, user: 'champions' as const, fields }, seed, season: 2, champions: null as ClState | null }
}

describe('Lifetime Champions League: formato', () => {
  const g = withUser(11)
  const league = playChampionsLeague(g) as ClState
  const full = playChampionsKnockout({ ...g, champions: league }) as ClState

  it('36 clubes y 144 partidos de fase de liga', () => {
    expect(CL_SIZE).toBe(36)
    expect(league.entrants).toHaveLength(36)
    expect(league.league).toHaveLength((CL_SIZE * CL_LEAGUE_MATCHES) / 2)
  })

  it('cada club juega 8 partidos contra 8 rivales distintos: 4 de local y 4 de visita', () => {
    for (const e of league.entrants) {
      const mine = league.league.filter((m) => m.home === e.id || m.away === e.id)
      expect(mine).toHaveLength(8)
      expect(mine.filter((m) => m.home === e.id)).toHaveLength(4)
      expect(new Set(mine.map((m) => (m.home === e.id ? m.away : m.home))).size).toBe(8)
    }
  })

  it('en cada jornada juegan los 36 clubes una sola vez', () => {
    for (let md = 1; md <= 8; md++) {
      const ids = league.league.filter((m) => m.matchday === md).flatMap((m) => [m.home, m.away])
      expect(ids).toHaveLength(36)
      expect(new Set(ids).size).toBe(36)
    }
  })

  it('la tabla ordena a los 36 y se puede ver jornada a jornada', () => {
    expect(league.table).toHaveLength(36)
    expect(clTable(league.entrants, league.league, 3).every((r) => r.played === 3)).toBe(true)
    for (let i = 1; i < 36; i++) expect(league.table[i - 1].points).toBeGreaterThanOrEqual(league.table[i].points)
  })

  it('1-8 directo a octavos, 9-24 playoff de ida y vuelta y 25-36 eliminados', () => {
    const ids = league.table.map((r) => r.id)
    const playoff = new Set(full.rounds[0].ties.flatMap((t) => [t.first, t.second]))
    const round16 = new Set(full.rounds[1].ties.flatMap((t) => [t.first, t.second]))
    expect(full.rounds[0].stage).toBe('playoff')
    expect(playoff).toEqual(new Set(ids.slice(CL_DIRECT, CL_PLAYOFF_LAST)))
    for (const id of ids.slice(0, CL_DIRECT)) expect(round16.has(id)).toBe(true)
    for (const id of ids.slice(CL_PLAYOFF_LAST)) expect(round16.has(id)).toBe(false)
  })

  it('octavos, cuartos y semifinales son de ida y vuelta; la final es un partido único', () => {
    expect(full.rounds.map((r) => [r.stage, r.ties.length])).toEqual([
      ['playoff', 8],
      ['octavos', 8],
      ['cuartos', 4],
      ['semi', 2],
      ['final', 1],
    ])
    for (const r of full.rounds) for (const t of r.ties) expect(t.legs).toHaveLength(r.stage === 'final' ? 1 : 2)
    expect(clAllMatches(full)).toHaveLength(144 + 16 + 16 + 8 + 4 + 1)
  })

  it('las eliminatorias nunca acaban empatadas y hay campeón', () => {
    for (const r of full.rounds) {
      for (const t of r.ties) {
        expect(t.winner === t.first || t.winner === t.second).toBe(true)
        if (t.agg[0] === t.agg[1]) expect(t.legs[t.legs.length - 1].pens).not.toBeNull()
        for (const l of t.legs) expect(clTieOf(full, l)?.id).toBe(t.id)
      }
    }
    expect(full.champion).toBe(full.rounds[4].ties[0].winner)
    expect(full.runnerUp).not.toBe(full.champion)
  })

  it('los goles coinciden con el marcador y con los goleadores', () => {
    for (const m of clAllMatches(full)) {
      expect(m.goals.filter((x) => x.side === 0)).toHaveLength(m.hg)
      expect(m.goals.filter((x) => x.side === 1)).toHaveLength(m.ag)
    }
  })

  it('con la misma semilla sale lo mismo', () => {
    expect(playChampionsKnockout({ ...g, champions: playChampionsLeague(g) })).toEqual(full)
  })

  it('si tu club no juega, todo se calcula de una vez', () => {
    const none = { ...g, europe: { ...g.europe, user: null } }
    const s = playChampionsKnockout({ ...none, europe: buildEuropeFromLeague(base.league, 2, 4), champions: null }) as ClState
    expect(s.champion).not.toBeNull()
    expect(clAllMatches(s).every((m) => m.timeline === null)).toBe(true)
  })
})

describe('Lifetime Champions League: línea de tiempo de la animación', () => {
  // Con todas las fases de la Champions animadas (solo para probar el motor de la animación)
  const states = withAnimated(ALL_STAGES, () =>
    Array.from({ length: 25 }, (_, i) => {
      const g = withUser(i + 1)
      return playChampionsKnockout({ ...g, champions: playChampionsLeague(g) }) as ClState
    }),
  )
  const everyMatch = states.flatMap((s) => clUserMatches(s))
  const mine = everyMatch.filter((m) => m.timeline !== null) // los que llevan animación

  it('solo los partidos de tu club traen línea de tiempo, y todos (si su fase está animada)', () => {
    for (const s of states) {
      for (const m of clAllMatches(s)) {
        const animated = clUserMatches(s).includes(m)
        expect(m.timeline !== null).toBe(animated)
      }
    }
  })

  it('un partido (completo) de 2 goles dura unos 29 s: 10 + 10 + 3 de descanso + 3 por gol', () => {
    const two = mine.find((m) => m.stage !== 'liga' && m.goals.length === 2 && !m.extraTime)
    expect(two).toBeDefined()
    expect(matchSeconds(two!.timeline!)).toBeCloseTo(2 * HALF_SECONDS + 3 + 2 * GOAL_PAUSE_SECONDS, 5)
  })

  it('cada gol pausa siempre 3 s, sin importar cuántos haya', () => {
    for (const m of mine.filter((x) => !x.extraTime)) {
      const script = buildScript(m.timeline!)
      const pauses = script.segs.filter((s) => s.kind === 'goal')
      expect(pauses).toHaveLength(m.goals.length)
      const pause = SPEED[m.timeline!.mode ?? 'completo'].goalPause * 1000
      for (const p of pauses) expect(p.end - p.start).toBeCloseTo(pause, 3)
    }
  })

  it('la prórroga son dos tramos de 5 s y los penales, 1 s por lanzamiento', () => {
    const et = mine.filter((m) => m.extraTime)
    expect(et.length).toBeGreaterThan(0)
    for (const m of et) {
      expect(m.timeline!.halves.map((h) => h.seconds)).toEqual([10, 10, 5, 5])
      const kicks = buildScript(m.timeline!).segs.filter((s) => s.kind === 'kick')
      expect(kicks).toHaveLength(m.timeline!.kicks.length)
      for (const k of kicks) expect(k.end - k.start).toBeCloseTo(1000, 3)
      if (m.pens) {
        const tally: [number, number] = [0, 0]
        m.timeline!.kicks.forEach((k) => k.scored && tally[k.side]++)
        expect(tally).toEqual(m.pens)
      }
    }
  })

  it('por defecto toda la Champions usa simulación rápida y solo la Supercopa se anima', () => {
    expect(ANIMATED_STAGES).toEqual(['supercopa'])
    expect(QUICK_STAGES).toEqual(ALL_STAGES)
    for (const st of ALL_STAGES) expect(isAnimated(st)).toBe(false)
    expect(isAnimated('supercopa')).toBe(true)
    const g = withUser(11)
    const s = playChampionsKnockout({ ...g, champions: playChampionsLeague(g) }) as ClState
    expect(clUserMatches(s).length).toBeGreaterThan(8)
    for (const m of clAllMatches(s)) expect(m.timeline).toBeNull()
  })

  it('el código de la animación sigue disponible: pasar una fase a la lista de animadas la anima', () => {
    withAnimated(['playoff'], () => {
      const g = withUser(11)
      const s = playChampionsKnockout({ ...g, champions: playChampionsLeague(g) }) as ClState
      const mineAll = clUserMatches(s)
      expect(mineAll.some((m) => m.stage === 'playoff')).toBe(true)
      for (const m of mineAll) expect(m.timeline !== null).toBe(m.stage === 'playoff')
    })
    expect(isAnimated('playoff')).toBe(false) // y la configuración queda como estaba
  })

  it('no queda ningún modo rápido animado: todas las animaciones usan los tiempos completos', () => {
    expect(Object.keys(SPEED)).toEqual(['completo'])
    for (const m of mine) expect(m.timeline!.halves.slice(0, 2).map((h) => h.seconds)).toEqual([10, 10])
  })

  it('el marcador de la animación termina igual que el del partido', () => {
    for (const m of mine) {
      const segs = buildScript(m.timeline!).segs
      const last = segs.filter((s) => s.kind !== 'kick').slice(-1)[0]
      expect(last.score).toEqual([m.hg, m.ag])
    }
  })

  it('hasta 3 contraataques por tiempo, cruzan el campo en 0,5 a 1 s y terminan en tiro, gol o fallo', () => {
    let seen = 0
    for (const m of mine) {
      for (const h of m.timeline!.halves) {
        expect(h.counters.length).toBeLessThanOrEqual(MAX_COUNTERS)
        for (const c of h.counters) {
          seen++
          expect(['left', 'center', 'right']).toContain(c.lane)
          expect(['shot', 'goal', 'fail']).toContain(c.result)
          expect(1 / c.speed).toBeGreaterThanOrEqual(0.5 - 1e-9)
          expect(1 / c.speed).toBeLessThanOrEqual(1 + 1e-9)
          // Un contraataque de gol acaba justo en un gol del partido
          if (c.result === 'goal') expect(h.goals.some((g) => g.goal === c.goal && g.side === c.side)).toBe(true)
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('no todos los contraataques terminan en gol', () => {
    const all = mine.flatMap((m) => m.timeline!.halves.flatMap((h) => h.counters))
    expect(all.some((c) => c.result === 'fail')).toBe(true)
    expect(all.some((c) => c.result === 'goal')).toBe(true)
  })

  it('el dominio va de -1 a 1', () => {
    for (const m of mine) for (const h of m.timeline!.halves) for (const d of h.dominance) expect(Math.abs(d)).toBeLessThanOrEqual(1)
  })
})

describe('Lifetime Champions League: tu club', () => {
  const states = Array.from({ length: 30 }, (_, i) => {
    const g = withUser(i + 1)
    return playChampionsKnockout({ ...g, champions: playChampionsLeague(g) }) as ClState
  })

  it('sus partidos van en orden y, si cae, ese es su último partido', () => {
    for (const s of states) {
      const mine = clUserMatches(s)
      expect(mine.slice(0, 8).every((m) => m.stage === 'liga')).toBe(true)
      for (let i = 1; i < mine.length; i++) expect(mine[i].seq).toBeGreaterThan(mine[i - 1].seq)
      const reach = clReach(s)
      expect(reach).not.toBeNull()
      const pos = clUserPosition(s)
      if (pos > CL_PLAYOFF_LAST) expect(mine).toHaveLength(8)
      if (pos <= CL_DIRECT) expect(mine.some((m) => m.stage === 'playoff')).toBe(false)
      if (reach !== 'campeon' && reach !== 'liga') {
        const last = mine[mine.length - 1]
        const tie = clTieOf(s, last)
        expect(tie?.winner).not.toBe('user')
      }
    }
  })

  it('nadie gana siempre: los resultados varían y el historial lo recuerda', () => {
    expect(new Set(states.map((s) => clReach(s))).size).toBeGreaterThan(1)
    const rec = clRecord(states[0])
    expect(rec?.comp).toBe('champions')
    expect(clRecord(states[0], 99)).toBeNull()
  })
})

describe('Lifetime Champions League: dentro del flujo del juego', () => {
  it('con tu club dentro aparece la parada de inicio y, al final, las eliminatorias antes de la gala', () => {
    let game = initialGame()
    const g = withUser(3)
    game = { ...game, season: 2, europe: g.europe, league: g.league, baseStop: 'verano', eventId: null, round: 0, seed: 3 }
    game = advance(game) // sale del verano
    expect(game.eventId).toBe('champions-liga')
    expect(game.champions?.league).toHaveLength(144)
    expect(game.champions?.champion).toBeNull() // las eliminatorias esperan a la parada final
    game = advance(game) // invierno
    expect(game.baseStop).toBe('invierno')
    expect(game.eventId).toBeNull()
    expect(game.champions?.season).toBe(2)
    game = advance(game) // evento(s) de invierno o cierre
    for (let i = 0; i < 6 && !(game.baseStop === 'cierre' && game.eventId === null); i++) game = advance(game)
    expect(game.baseStop).toBe('cierre')
    game = advance(game) // sale del cierre
    expect(game.eventId).toBe('torneo')
    expect(game.champions?.champion).not.toBeNull()
    expect(game.tournament?.champions.champions).toBeDefined()
    game = advance(game)
    expect(game.eventId).toBe('gala')
    game = advance(game)
    expect(game.season).toBe(3)
    expect(game.champions).toBeNull()
    expect(game.history[game.history.length - 1].euro?.comp).toBe('champions')
  })

  it('sin tu club no hay parada de inicio', () => {
    let game = playToClose()
    game = { ...game, season: 2, baseStop: 'verano', eventId: null, round: 0, europe: buildEuropeFromLeague(game.league, 2, 3) }
    game = advance(game)
    expect(game.eventId).toBeNull()
    expect(game.baseStop).toBe('invierno')
  })
})

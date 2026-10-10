import { describe, expect, it } from 'vitest'
import {
  ROUNDS,
  TEAMS_PER_DIVISION,
  USER_ID,
  computeTable,
  createLeague,
  finishSeason,
  simulateLeague,
  userSeasonResult,
} from './engine'
import type { LeagueState, Level } from './engine'

const LEVELS: Level[] = [1, 2]

function playSeason(seed: number): LeagueState {
  return simulateLeague(createLeague(seed), ROUNDS, seed + 5000)
}

describe('semilla', () => {
  it('la misma semilla da exactamente los mismos resultados', () => {
    const a = playSeason(5)
    const b = playSeason(5)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('semillas distintas dan resultados distintos', () => {
    expect(JSON.stringify(playSeason(5))).not.toBe(JSON.stringify(playSeason(6)))
  })
})

describe('temporada', () => {
  it('se simula en menos de un segundo (las dos divisiones)', () => {
    const start = Date.now()
    playSeason(9)
    expect(Date.now() - start).toBeLessThan(1000)
  })

  it('simular por tramos completa las 38 jornadas', () => {
    let league = createLeague(3)
    league = simulateLeague(league, 19, 1)
    expect(league.divisions[2].played).toBe(19)
    league = simulateLeague(league, 38, 2)
    for (const level of LEVELS) {
      expect(league.divisions[level].played).toBe(38)
      expect(league.divisions[level].results.length).toBe(380)
    }
  })

  it('cada equipo juega 38 partidos, 19 en casa, y enfrenta a cada rival dos veces', () => {
    const league = playSeason(11)
    for (const level of LEVELS) {
      const div = league.divisions[level]
      for (const team of div.teams) {
        const home = div.results.filter((m) => m.home === team.id)
        const away = div.results.filter((m) => m.away === team.id)
        expect(home.length).toBe(19)
        expect(away.length).toBe(19)
        const rivals = new Set([...home.map((m) => m.away), ...away.map((m) => m.home)])
        expect(rivals.size).toBe(TEAMS_PER_DIVISION - 1)
      }
    }
  })

  it('los goles repartidos entre jugadores coinciden con los goles de los partidos', () => {
    const league = playSeason(13)
    for (const level of LEVELS) {
      for (const m of league.divisions[level].results) {
        expect(m.goals.length).toBe(m.hg + m.ag)
      }
    }
  })

  it('las estadísticas de cada partido tienen sentido', () => {
    const league = playSeason(17)
    for (const level of LEVELS) {
      for (const m of league.divisions[level].results) {
        expect(m.stats.shots[0]).toBeGreaterThanOrEqual(m.stats.onTarget[0])
        expect(m.stats.shots[1]).toBeGreaterThanOrEqual(m.stats.onTarget[1])
        expect(m.stats.onTarget[0]).toBeGreaterThanOrEqual(m.hg)
        expect(m.stats.onTarget[1]).toBeGreaterThanOrEqual(m.ag)
        expect(m.stats.poss).toBeGreaterThanOrEqual(28)
        expect(m.stats.poss).toBeLessThanOrEqual(72)
      }
    }
  })
})

describe('coherencia en 100 temporadas', () => {
  const SEASONS = 100
  let matches = 0
  let goals = 0
  let homeWins = 0
  let draws = 0
  let awayWins = 0
  let poss = 0
  let shots = 0
  let yellow = 0
  let championPoints = 0
  let lastPoints = 0
  let strongestPoints = 0
  let weakestPoints = 0
  let tables = 0

  for (let s = 0; s < SEASONS; s++) {
    const league = playSeason(1000 + s)
    for (const level of LEVELS) {
      const div = league.divisions[level]
      for (const m of div.results) {
        matches++
        goals += m.hg + m.ag
        if (m.hg > m.ag) homeWins++
        else if (m.hg === m.ag) draws++
        else awayWins++
        poss += m.stats.poss
        shots += m.stats.shots[0] + m.stats.shots[1]
        yellow += m.stats.yellow[0] + m.stats.yellow[1]
      }
      const table = computeTable(div)
      championPoints += table[0].points
      lastPoints += table[TEAMS_PER_DIVISION - 1].points
      const byStrength = [...div.teams].sort((a, b) => b.strength - a.strength)
      const points = new Map(table.map((r) => [r.id, r.points]))
      for (const t of byStrength.slice(0, 3)) strongestPoints += points.get(t.id) ?? 0
      for (const t of byStrength.slice(-3)) weakestPoints += points.get(t.id) ?? 0
      tables++
    }
  }

  it('goles por partido entre 2,3 y 3,0', () => {
    expect(goals / matches).toBeGreaterThan(2.3)
    expect(goals / matches).toBeLessThan(3.0)
  })

  it('el local gana más que el visitante, con empates razonables', () => {
    expect(homeWins / matches).toBeGreaterThan(0.4)
    expect(homeWins / matches).toBeLessThan(0.52)
    expect(draws / matches).toBeGreaterThan(0.2)
    expect(draws / matches).toBeLessThan(0.3)
    expect(awayWins / matches).toBeGreaterThan(0.25)
    expect(awayWins / matches).toBeLessThan(0.36)
  })

  it('posesión, tiros y tarjetas con valores realistas', () => {
    expect(poss / matches).toBeGreaterThan(50)
    expect(poss / matches).toBeLessThan(54)
    expect(shots / matches).toBeGreaterThan(16)
    expect(shots / matches).toBeLessThan(26)
    expect(yellow / matches).toBeGreaterThan(3)
    expect(yellow / matches).toBeLessThan(5.5)
  })

  it('el campeón suma entre 70 y 90 puntos y el último entre 18 y 35', () => {
    expect(championPoints / tables).toBeGreaterThan(70)
    expect(championPoints / tables).toBeLessThan(90)
    expect(lastPoints / tables).toBeGreaterThan(18)
    expect(lastPoints / tables).toBeLessThan(35)
  })

  it('los equipos más fuertes puntúan claramente más que los más débiles', () => {
    expect(strongestPoints / (tables * 3) - weakestPoints / (tables * 3)).toBeGreaterThan(20)
  })
})

describe('30 temporadas seguidas', () => {
  it('mantiene 40 clubes, 20 por división, y el club del jugador siempre existe', () => {
    let league = createLeague(7)
    let promotions = 0
    let relegations = 0

    for (let season = 1; season <= 30; season++) {
      league = simulateLeague(league, 19, 100 + season)
      league = simulateLeague(league, ROUNDS, 200 + season)

      const result = userSeasonResult(league)
      expect(result.position).toBeGreaterThanOrEqual(1)
      expect(result.position).toBeLessThanOrEqual(TEAMS_PER_DIVISION)
      if (result.promoted) promotions++
      if (result.relegated) relegations++

      league = finishSeason(league, 300 + season)

      const all = [...league.divisions[1].teams, ...league.divisions[2].teams]
      expect(all.length).toBe(2 * TEAMS_PER_DIVISION)
      expect(new Set(all.map((t) => t.id)).size).toBe(2 * TEAMS_PER_DIVISION)
      expect(league.divisions[1].teams.length).toBe(TEAMS_PER_DIVISION)
      expect(league.divisions[2].teams.length).toBe(TEAMS_PER_DIVISION)
      expect(all.some((t) => t.id === USER_ID)).toBe(true)
      for (const t of all) {
        expect(t.strength).toBeGreaterThanOrEqual(55)
        expect(t.strength).toBeLessThanOrEqual(88)
      }
    }

    // Se sube y se baja de categoría a lo largo de una carrera
    expect(promotions + relegations).toBeGreaterThan(0)
  })
})

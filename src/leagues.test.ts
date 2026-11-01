import { afterEach, describe, expect, it } from 'vitest'
import { LEAGUES, LEAGUE_IDS } from './leagues'
import type { LeagueId } from './leagues'
import { setActiveLeague } from './activeLeague'
import { USER_ID, createLeague, simulateLeague } from './engine'
import { advance, initialGame, parseGame } from './game'
import { playDomesticSeason } from './domestic'
import { buildEuropeFromLeague, rankedFirstDivision } from './europe'

afterEach(() => setActiveLeague('esp'))

describe('las 5 ligas: datos', () => {
  it('cada liga tiene 20 clubes en 1.ª y 19 en 2.ª (el 20.º es el tuyo)', () => {
    for (const id of LEAGUE_IDS) {
      expect(LEAGUES[id].div1).toHaveLength(20)
      expect(LEAGUES[id].div2).toHaveLength(19)
    }
  })

  it('cada liga tiene 3 gigantes de élite y 4 grandes', () => {
    for (const id of LEAGUE_IDS) {
      expect(LEAGUES[id].div1.filter((c) => c.tier === 'elite')).toHaveLength(3)
      expect(LEAGUES[id].div1.filter((c) => c.tier === 'grande')).toHaveLength(4)
    }
  })

  it('ningún nombre de club se repite en ninguna liga, y todos tienen ciudad y colores', () => {
    const all = LEAGUE_IDS.flatMap((id) => [...LEAGUES[id].div1, ...LEAGUES[id].div2])
    const names = all.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
    for (const c of all) {
      expect(c.name.length).toBeGreaterThan(2)
      expect(c.city.length).toBeGreaterThan(1)
      expect(c.colors[0]).toMatch(/^#[0-9a-f]{6}$/i)
      expect(c.colors[1]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('las supercopas: España a cuatro, el resto a un partido', () => {
    expect(LEAGUES.esp.superFormat).toBe('four')
    for (const id of ['ing', 'ita', 'ale', 'fra'] as LeagueId[]) expect(LEAGUES[id].superFormat).toBe('two')
  })
})

describe.each(LEAGUE_IDS)('liga %s: una partida completa', (id) => {
  it('crea el mundo con 20 + 20 clubes y tu club en 2.ª', () => {
    setActiveLeague(id)
    const league = createLeague(5, id)
    expect(league.divisions[1].teams).toHaveLength(20)
    expect(league.divisions[2].teams).toHaveLength(20)
    expect(league.divisions[2].teams.some((t) => t.id === USER_ID)).toBe(true)
    expect(league.divisions[1].teams[0].name).toBe(LEAGUES[id].div1[0].name)
  })

  it('los jugadores son sobre todo de la nacionalidad de la liga', () => {
    setActiveLeague(id)
    const league = createLeague(7, id)
    const players = league.divisions[1].teams.slice(7).flatMap((t) => t.squad)
    const home = players.filter((p) => p.nat === LEAGUES[id].nat).length / players.length
    expect(home).toBeGreaterThan(0.4)
  })

  it('copa y supercopa dan campeón, y el formato de la supercopa es el de la liga', () => {
    setActiveLeague(id)
    const league = simulateLeague(createLeague(9, id), 38, 99)
    const ds = playDomesticSeason(league, 123, 1)
    expect(ds.copa.entrants).toHaveLength(64)
    expect(ds.copa.ties).toHaveLength(32 + 16 + 8 + 4 + 2 + 1)
    expect(ds.supercopa.entrants).toHaveLength(LEAGUES[id].superFormat === 'four' ? 4 : 2)
    expect(ds.supercopa.entrants.map((e) => e.id)).toContain(ds.supercopa.champion)
    expect(new Set(ds.supercopa.entrants.map((e) => e.id)).size).toBe(ds.supercopa.entrants.length)
    // los clubes de categorías inferiores llevan nombres del país
    const lower = ds.copa.entrants.filter((e) => e.tier === 3)
    expect(lower).toHaveLength(24)
    expect(new Set(lower.map((e) => e.name)).size).toBe(24)
  })

  it('Europa: tu liga aporta sus clubes y el resto de invitados son de otras ligas', () => {
    setActiveLeague(id)
    const league = simulateLeague(createLeague(11, id), 38, 77)
    const europe = buildEuropeFromLeague(league, 2, 5)
    const ranked = rankedFirstDivision(league)
    const mine = Object.values(europe.fields).flat().filter((e) => e.country === LEAGUES[id].code)
    expect(mine).toHaveLength(7)
    expect(mine.every((e) => ranked.some((t) => e.id === `esp-${t.id}`))).toBe(true)
    const all = Object.values(europe.fields).flat()
    expect(new Set(all.map((e) => e.name + e.id)).size).toBe(all.length)
    expect(new Set(all.filter((e) => e.country !== LEAGUES[id].code).map((e) => e.name)).size).toBe(all.length - 7)
  })

  it('juega tres temporadas seguidas, se guarda y se vuelve a cargar en la misma liga', () => {
    let game = initialGame(undefined, id)
    expect(game.leagueId).toBe(id)
    const startSeason = game.season
    for (let guard = 0; guard < 200 && game.season < startSeason + 3; guard++) game = advance(game)
    expect(game.season).toBe(startSeason + 3)
    expect(game.history).toHaveLength(3)
    const loaded = parseGame(JSON.parse(JSON.stringify(game)))
    expect(loaded?.leagueId).toBe(id)
    expect(loaded?.league.divisions[1].teams.length).toBe(20)
  })
})

describe('partidas viejas', () => {
  it('una partida guardada sin liga es de España', () => {
    const g = initialGame()
    const old = JSON.parse(JSON.stringify(g)) as Record<string, unknown>
    delete old.leagueId
    setActiveLeague('fra')
    expect(parseGame(old)?.leagueId).toBe('esp')
  })
})

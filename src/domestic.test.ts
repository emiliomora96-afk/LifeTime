import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { computeTable, createLeague, simulateLeague } from './engine'
import type { LeagueState } from './engine'
import { cupPrestigeChange } from './economy'
import {
  COPA_ROUNDS,
  cupIncome,
  entrantMap,
  playCopa,
  playDomesticSeason,
  playSupercopa,
  userCopaRecord,
  userSupercopaRecord,
  userTies,
} from './domestic'

function finishedLeague(seed: number): LeagueState {
  return simulateLeague(createLeague(seed), 38, seed * 7)
}

// El club del jugador con un nivel altísimo: gana todo
function superClub(league: LeagueState): LeagueState {
  const boost = (t: { id: number; strength: number }) => (t.id === 0 ? { ...t, strength: 140 } : t)
  return {
    ...league,
    divisions: {
      1: { ...league.divisions[1], teams: league.divisions[1].teams.map(boost) as typeof league.divisions[1]['teams'] },
      2: { ...league.divisions[2], teams: league.divisions[2].teams.map(boost) as typeof league.divisions[2]['teams'] },
    },
  }
}

describe('Copa del Rey', () => {
  it('64 clubes, 63 partidos, y cada ronda reparte los partidos que le tocan', () => {
    const copa = playCopa(finishedLeague(1), createRng(1))
    expect(copa.entrants).toHaveLength(64)
    expect(copa.ties).toHaveLength(63)
    const sizes = COPA_ROUNDS.map((r) => copa.ties.filter((t) => t.round === r.id).length)
    expect(sizes).toEqual([32, 16, 8, 4, 2, 1])
  })

  it('solo quien gana pasa de ronda y al final queda un campeón', () => {
    for (const seed of [2, 3, 4, 5]) {
      const copa = playCopa(finishedLeague(seed), createRng(seed))
      const alive = new Set(copa.entrants.map((e) => e.id))
      for (const round of COPA_ROUNDS) {
        for (const t of copa.ties.filter((x) => x.round === round.id)) {
          expect(alive.has(t.home) && alive.has(t.away)).toBe(true)
        }
        for (const t of copa.ties.filter((x) => x.round === round.id)) alive.delete(t.winner === t.home ? t.away : t.home)
      }
      expect(alive.size).toBe(1)
      expect(alive.has(copa.champion)).toBe(true)
      expect(copa.finalist === copa.champion).toBe(false)
    }
  })

  it('no hay empates: si acaba igual hay prórroga y, si sigue igual, penaltis', () => {
    const copa = playCopa(finishedLeague(6), createRng(6))
    for (const t of copa.ties) {
      if (t.hg === t.ag) {
        expect(t.pk !== undefined && t.pk[0] !== t.pk[1]).toBe(true)
      } else {
        expect(t.pk).toBe(undefined)
      }
    }
  })

  it('juega en casa el club de menor categoría (salvo semifinales y final, en campo neutral)', () => {
    const copa = playCopa(finishedLeague(7), createRng(7))
    const byId = entrantMap(copa)
    for (const t of copa.ties) {
      if (t.round === 'sf' || t.round === 'final') {
        expect(t.neutral).toBe(true)
        continue
      }
      const home = byId.get(t.home)
      const away = byId.get(t.away)
      expect((home?.tier ?? 0) >= (away?.tier ?? 0)).toBe(true)
    }
  })

  it('es repetible con la misma semilla', () => {
    const league = finishedLeague(8)
    expect(playDomesticSeason(league, 99, 1)).toEqual(playDomesticSeason(league, 99, 1))
  })
})

describe('Supercopa de España', () => {
  it('la juegan cuatro clubes distintos: 2 de Liga y 2 de Copa, con 3 partidos', () => {
    const league = finishedLeague(9)
    const ds = playDomesticSeason(league, 5, 1)
    const ids = ds.supercopa.entrants.map((e) => e.id)
    expect(new Set(ids).size).toBe(4)
    expect(ds.supercopa.ties).toHaveLength(3)
    expect(ids).toContain(ds.supercopa.champion)
  })

  it('el campeón y el subcampeón de Liga siempre están, y el campeón de Copa también', () => {
    const league = finishedLeague(10)
    const copa = playCopa(league, createRng(10))
    const table = computeTable(league.divisions[1]).map((r) => (r.id === 0 ? 'user' : `t${r.id}`))
    const ids = playSupercopa(league, copa, createRng(1)).entrants.map((e) => e.id)
    expect(ids).toContain(table[0])
    expect(ids).toContain(table[1])
    expect(ids).toContain(copa.champion)
  })

  it('si un club gana Liga y Copa, la plaza repetida pasa al siguiente de la Liga', () => {
    const league = finishedLeague(11)
    const copa = playCopa(league, createRng(11))
    const table = computeTable(league.divisions[1]).map((r) => (r.id === 0 ? 'user' : `t${r.id}`))
    // Campeón de Liga = campeón de Copa; subcampeón de Liga = finalista de Copa
    const doble = { ...copa, champion: table[0], finalist: table[1] }
    const sc = playSupercopa(league, doble, createRng(2))
    expect(sc.entrants.map((e) => e.id).sort()).toEqual([table[0], table[1], table[2], table[3]].sort())
    expect(sc.reasons[table[2]]).toContain('Siguiente clasificado')
  })
})

describe('premios y registro del club', () => {
  it('un club campeón de las dos copas cobra premios, taquilla y Supercopa', () => {
    const league = superClub(finishedLeague(12))
    const ds = playDomesticSeason(league, 3, 1)
    expect(userCopaRecord(ds)?.champion).toBe(true)
    const lines = cupIncome(ds, league.userDivision)
    // 10.000 de participación + 15.000 + 30.000 + 60.000 + 120.000 + 250.000 + 600.000
    expect(lines[0].amount).toBe(1_085_000)
    expect(lines.some((l) => l.label.includes('taquilla'))).toBe(true)
    expect(userSupercopaRecord(ds)).toBeTruthy()
  })

  it('el recorrido del club acaba en el partido en que cae', () => {
    const league = finishedLeague(13)
    const ds = playDomesticSeason(league, 4, 1)
    const mine = userTies(ds.copa)
    const rec = userCopaRecord(ds)
    expect(mine.length).toBeGreaterThan(0)
    if (rec && !rec.champion) expect(rec.reach).toBe(mine[mine.length - 1].round)
  })

  it('el prestigio sube con los títulos de copa', () => {
    expect(cupPrestigeChange({ champion: true, reach: 'champion' }, { champion: true })).toBe(3)
    expect(cupPrestigeChange({ champion: false, reach: 'final' }, null)).toBe(1)
    expect(cupPrestigeChange({ champion: false, reach: 'qf' }, null)).toBe(0)
  })
})

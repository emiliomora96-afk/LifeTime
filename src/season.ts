import { USER_ID, computeTable } from './engine'
import type { LeagueState, Level } from './engine'
import type { Fixture, StatRow, TableRow } from './sample'

// Clasificación de una división. El club del jugador aparece con nombre null.
export function getTable(league: LeagueState, level: Level): TableRow[] {
  const div = league.divisions[level]
  const teams = new Map(div.teams.map((t) => [t.id, t]))
  const rows = computeTable(div)

  // Antes de jugar, se ordena por nivel del equipo
  if (div.played === 0) {
    rows.sort((a, b) => (teams.get(b.id)?.strength ?? 0) - (teams.get(a.id)?.strength ?? 0) || a.id - b.id)
  }

  return rows.map((r) => ({
    name: r.id === USER_ID ? null : (teams.get(r.id)?.name ?? '?'),
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    gf: r.gf,
    ga: r.ga,
    points: r.points,
  }))
}

// Los 38 partidos del club del jugador, jugados o por jugar
export function getUserFixtures(league: LeagueState, clubName: string): Fixture[] {
  const div = league.divisions[league.userDivision]
  const teams = new Map(div.teams.map((t) => [t.id, t]))
  const label = (id: number) => (id === USER_ID ? clubName : (teams.get(id)?.name ?? '?'))

  const fixtures: Fixture[] = []
  div.schedule.forEach((round, i) => {
    const pair = round.find(([h, a]) => h === USER_ID || a === USER_ID)
    if (!pair) return
    const [h, a] = pair
    const result = div.results.find((m) => m.round === i + 1 && m.home === h && m.away === a)
    fixtures.push({
      round: i + 1,
      home: label(h),
      away: label(a),
      played: result !== undefined,
      homeGoals: result ? result.hg : null,
      awayGoals: result ? result.ag : null,
    })
  })
  return fixtures
}

export interface ClubStats {
  matches: number
  possession: number
  shots: number
  onTarget: number
  corners: number
  fouls: number
  yellow: number
  red: number
}

// Promedios por partido del club del jugador
export function getClubStats(league: LeagueState): ClubStats | null {
  const div = league.divisions[league.userDivision]
  const mine = div.results.filter((m) => m.home === USER_ID || m.away === USER_ID)
  if (mine.length === 0) return null

  const sum = { poss: 0, shots: 0, onTarget: 0, corners: 0, fouls: 0, yellow: 0, red: 0 }
  for (const m of mine) {
    const i = m.home === USER_ID ? 0 : 1
    sum.poss += i === 0 ? m.stats.poss : 100 - m.stats.poss
    sum.shots += m.stats.shots[i]
    sum.onTarget += m.stats.onTarget[i]
    sum.corners += m.stats.corners[i]
    sum.fouls += m.stats.fouls[i]
    sum.yellow += m.stats.yellow[i]
    sum.red += m.stats.red[i]
  }
  const n = mine.length
  return {
    matches: n,
    possession: sum.poss / n,
    shots: sum.shots / n,
    onTarget: sum.onTarget / n,
    corners: sum.corners / n,
    fouls: sum.fouls / n,
    yellow: sum.yellow / n,
    red: sum.red / n,
  }
}

export type StatKind = 'goals' | 'assists' | 'best'

// Rankings de jugadores de una división
export function getTopPlayers(league: LeagueState, level: Level, kind: StatKind, n = 5): StatRow[] {
  const div = league.divisions[level]

  const info = new Map<string, { name: string; club: string | null; rating: number }>()
  for (const t of div.teams) {
    for (const p of t.squad) {
      info.set(p.id, { name: p.name, club: t.id === USER_ID ? null : t.name, rating: p.rating })
    }
  }

  const goals = new Map<string, number>()
  const assists = new Map<string, number>()
  for (const m of div.results) {
    for (const e of m.goals) {
      goals.set(e.scorer, (goals.get(e.scorer) ?? 0) + 1)
      if (e.assist) assists.set(e.assist, (assists.get(e.assist) ?? 0) + 1)
    }
  }

  const rows: StatRow[] = []
  for (const [id, p] of info) {
    const g = goals.get(id) ?? 0
    const a = assists.get(id) ?? 0
    let value: number
    if (kind === 'goals') value = g
    else if (kind === 'assists') value = a
    else value = Math.min(10, 6 + (p.rating - 65) * 0.04 + Math.min(2.5, g * 0.25 + a * 0.15)) // provisorio
    if (kind !== 'best' && value === 0) continue
    rows.push({ name: p.name, club: p.club, value })
  }

  rows.sort((x, y) => y.value - x.value || x.name.localeCompare(y.name))
  return rows.slice(0, n)
}

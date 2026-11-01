import { createLeague, aiWinterWindow, finishSeason, simulateLeague, USER_ID } from './engine'
import type { LeagueState, SimTeam } from './engine'
import { setActiveLeague } from './activeLeague'
import type { LeagueId } from './leagues'
import { DEFAULT_LEAGUE } from './leagues'
import { mixSeed } from './rng'
import type { SimPlayer } from './players'
import { ACADEMY_TIERS, SIM, START, VAL_LIMITS, VAL_TARGETS } from './lifetimeConfig'

/* ==========================================================================
   Simulación sin interfaz de Lifetime (validación del balance).
   Corre N temporadas con todos los clubes gestionados por la IA (también el del jugador) y mide:
   Val por división, jugadores 85+/90+/95+, superestrellas por club, canteranos que llegaron lejos,
   dinero de los clubes élite frente al resto y cuántos clubes normales se hicieron gigantes.
   Uso desde la consola:  npx tsx src/lifetimeSim.cli.ts 100
   ========================================================================== */

export interface SimOptions {
  seasons: number // 30, 50 o 100
  seed?: number
  leagueId?: LeagueId
  checkpoints?: number[] // por defecto 1, 20, 50 y 100 (y la última temporada si no coincide)
}

export interface CanteranoStats {
  generated: number // canteranos creados hasta ahora
  finished: number // los que ya terminaron su carrera o tienen 26+ años
  reach85: number // de los terminados, cuántos llegaron a Val 85+
  reach90: number
  reach95: number
  reach80: number
  pot85: number // potencial sorteado >= 85 (de todos los generados)
  pot90: number
}

export interface Checkpoint {
  season: number
  div1Mean: number // Val medio de los titulares de 1.ª
  div2Mean: number
  div1Spread: number // desviación típica del Val de los titulares de 1.ª
  players: number // jugadores en plantillas
  n85: number
  n90: number
  n95: number
  share85: number // % de jugadores de 1.ª
  share90: number
  share95: number
  clubs95: { max: number; withAny: number; withTwo: number; over: number } // 95+ por club
  budgetEliteStart: number // presupuesto medio de los clubes que empezaron como élite
  budgetRest: number
  prestigeEliteStart: number
  prestigeRest: number
  canteranos: Record<string, CanteranoStats>
  topGroup: { nonEliteNow: number; nonEliteEver: number; nonEliteSustained: number; eliteStartInTop: number; size: number }
  academyLevels: number[] // cuántos clubes están en cada nivel de cantera (0..3)
  transfersPerSeason: number
  bankrupt: number // clubes en el suelo de deuda
}

export interface LifetimeReport {
  seasons: number
  seed: number
  leagueId: LeagueId
  checkpoints: Checkpoint[]
  warnings: string[]
  winners: number // clubes distintos que ganaron la liga de 1.ª
  elitesStart: string[]
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}

function sd(xs: number[]): number {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

function allTeams(league: LeagueState): { team: SimTeam; division: 1 | 2 }[] {
  return ([1, 2] as const).flatMap((division) => league.divisions[division].teams.map((team) => ({ team, division })))
}

// El club del jugador no tiene gestor en la simulación: se le da lo que tiene un club de la IA
function adoptUser(league: LeagueState): LeagueState {
  const fix = (t: SimTeam): SimTeam => {
    if (t.id !== USER_ID) return t
    const p = START.profiles.media
    return {
      ...t,
      name: 'Club del usuario',
      tier: 'media',
      budget: p.budget,
      prestige: p.prestige,
      academy: [],
      academyLevel: p.academy,
      stadiumLevel: p.stadium,
    }
  }
  const divisions = {
    1: { ...league.divisions[1], teams: league.divisions[1].teams.map(fix) },
    2: { ...league.divisions[2], teams: league.divisions[2].teams.map(fix) },
  }
  return { ...league, divisions }
}

interface Seen {
  origin: string
  pot: number
  maxRating: number
  lastAge: number
  lastSeason: number
}

export function runLifetimeSim(opts: SimOptions): LifetimeReport {
  const seed = opts.seed ?? SIM.seed
  const leagueId = opts.leagueId ?? DEFAULT_LEAGUE
  const wanted = new Set(opts.checkpoints ?? SIM.checkpoints)
  wanted.add(opts.seasons)
  setActiveLeague(leagueId)

  let league = adoptUser(createLeague(seed, leagueId))
  const eliteStart = new Set(allTeams(league).filter((x) => x.team.tier === 'elite').map((x) => x.team.id))
  const nameOf = new Map(allTeams(league).map((x) => [x.team.id, x.team.name]))

  const seen = new Map<string, Seen>()
  const owner = new Map<string, number>()
  const everTop = new Set<number>()
  const topSeasons = new Map<number, number>() // temporadas que cada club estuvo en el grupo de los mejores
  const winners = new Set<number>()
  let transfers = 0
  let transferSeasons = 0
  const checkpoints: Checkpoint[] = []

  const scan = (season: number): void => {
    const now = new Map<string, number>()
    for (const { team } of allTeams(league)) {
      const all: SimPlayer[] = [...team.squad, ...(team.academy ?? [])]
      for (const p of all) {
        now.set(p.id, team.id)
        if (!p.origin) continue
        const s = seen.get(p.id)
        if (!s) seen.set(p.id, { origin: p.origin, pot: p.pot ?? p.peak, maxRating: p.rating, lastAge: p.age, lastSeason: season })
        else {
          s.maxRating = Math.max(s.maxRating, p.rating)
          s.lastAge = p.age
          s.lastSeason = season
        }
      }
    }
    // Cuántos jugadores cambiaron de club desde la temporada anterior
    if (owner.size > 0) {
      let moved = 0
      for (const [id, team] of now) {
        const before = owner.get(id)
        if (before !== undefined && before !== team) moved++
      }
      transfers += moved
      transferSeasons++
    }
    owner.clear()
    for (const [id, team] of now) owner.set(id, team)

    // Grupo de los mejores por presupuesto o reputación
    const top = topGroup(league)
    for (const id of top) {
      everTop.add(id)
      topSeasons.set(id, (topSeasons.get(id) ?? 0) + 1)
    }
  }

  const topGroup = (l: LeagueState): Set<number> => {
    const teams = allTeams(l).map((x) => x.team)
    const byBudget = [...teams].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)).slice(0, START.topGroupSize)
    const byPrestige = [...teams].sort((a, b) => (b.prestige ?? 0) - (a.prestige ?? 0)).slice(0, START.topGroupSize)
    return new Set([...byBudget, ...byPrestige].map((t) => t.id))
  }

  const snapshot = (season: number): Checkpoint => {
    const teams = allTeams(league)
    const starters1 = teams.filter((x) => x.division === 1).flatMap((x) => x.team.squad.filter((p) => p.starter))
    const starters2 = teams.filter((x) => x.division === 2).flatMap((x) => x.team.squad.filter((p) => p.starter))
    const all = teams.flatMap((x) => x.team.squad)
    const d1 = teams.filter((x) => x.division === 1).flatMap((x) => x.team.squad)
    const count = (list: SimPlayer[], min: number) => list.filter((p) => p.rating >= min).length
    const per95 = teams.map((x) => x.team.squad.filter((p) => p.rating >= VAL_LIMITS.topStarRating).length)

    const cant: Record<string, CanteranoStats> = {}
    for (const t of ACADEMY_TIERS) {
      cant[t.id] = { generated: 0, finished: 0, reach80: 0, reach85: 0, reach90: 0, reach95: 0, pot85: 0, pot90: 0 }
    }
    for (const s of seen.values()) {
      const c = cant[s.origin]
      if (!c) continue
      c.generated++
      if (s.pot >= 85) c.pot85++
      if (s.pot >= 90) c.pot90++
      const finished = s.lastSeason < season || s.lastAge >= SIM.matureAge
      if (!finished) continue
      c.finished++
      if (s.maxRating >= 80) c.reach80++
      if (s.maxRating >= 85) c.reach85++
      if (s.maxRating >= 90) c.reach90++
      if (s.maxRating >= 95) c.reach95++
    }

    const eliteTeams = teams.filter((x) => eliteStart.has(x.team.id)).map((x) => x.team)
    const rest = teams.filter((x) => !eliteStart.has(x.team.id)).map((x) => x.team)
    const top = topGroup(league)
    const levels = [0, 0, 0, 0]
    for (const x of teams) levels[x.team.academyLevel ?? 1]++

    return {
      season,
      div1Mean: mean(starters1.map((p) => p.rating)),
      div2Mean: mean(starters2.map((p) => p.rating)),
      div1Spread: sd(starters1.map((p) => p.rating)),
      players: all.length,
      n85: count(all, 85),
      n90: count(all, 90),
      n95: count(all, 95),
      share85: count(d1, 85) / Math.max(1, d1.length),
      share90: count(d1, 90) / Math.max(1, d1.length),
      share95: count(d1, 95) / Math.max(1, d1.length),
      clubs95: {
        max: Math.max(0, ...per95),
        withAny: per95.filter((n) => n >= 1).length,
        withTwo: per95.filter((n) => n >= 2).length,
        over: per95.filter((n) => n > VAL_LIMITS.maxTopStarsPerClub).length,
      },
      budgetEliteStart: mean(eliteTeams.map((t) => t.budget ?? 0)),
      budgetRest: mean(rest.map((t) => t.budget ?? 0)),
      prestigeEliteStart: mean(eliteTeams.map((t) => t.prestige ?? 0)),
      prestigeRest: mean(rest.map((t) => t.prestige ?? 0)),
      canteranos: cant,
      topGroup: {
        nonEliteNow: [...top].filter((id) => !eliteStart.has(id)).length,
        nonEliteEver: [...everTop].filter((id) => !eliteStart.has(id)).length,
        nonEliteSustained: [...topSeasons].filter(([id, n]) => !eliteStart.has(id) && n >= SIM.sustainedSeasons).length,
        eliteStartInTop: [...top].filter((id) => eliteStart.has(id)).length,
        size: top.size,
      },
      academyLevels: levels,
      transfersPerSeason: transferSeasons === 0 ? 0 : transfers / transferSeasons,
      bankrupt: teams.filter((x) => (x.team.budget ?? 0) <= -5_900_000).length,
    }
  }

  for (let season = 1; season <= opts.seasons; season++) {
    scan(season)
    if (wanted.has(season)) checkpoints.push(snapshot(season))

    league = simulateLeague(league, 19, mixSeed(seed, season, 19))
    league = aiWinterWindow(league, mixSeed(seed, season, 555), true)
    league = simulateLeague(league, 38, mixSeed(seed, season, 38))
    const champion = league.divisions[1].teams
      .map((t) => ({ t, pts: pointsOf(league, t.id) }))
      .sort((a, b) => b.pts - a.pts)[0]?.t
    if (champion) winners.add(champion.id)
    league = finishSeason(league, mixSeed(seed, season, 999), { academyBonus: 0, leaving: [], userAsAi: true })
  }

  return {
    seasons: opts.seasons,
    seed,
    leagueId,
    checkpoints,
    warnings: warningsFor(checkpoints),
    winners: winners.size,
    elitesStart: [...eliteStart].map((id) => nameOf.get(id) ?? String(id)),
  }
}

function pointsOf(league: LeagueState, id: number): number {
  let pts = 0
  for (const m of league.divisions[1].results) {
    if (m.home === id) pts += m.hg > m.ag ? 3 : m.hg === m.ag ? 1 : 0
    else if (m.away === id) pts += m.ag > m.hg ? 3 : m.hg === m.ag ? 1 : 0
  }
  return pts
}

// Avisos cuando algo se sale de los rangos de VAL_TARGETS / VAL_LIMITS
export function warningsFor(checkpoints: Checkpoint[]): string[] {
  const out: string[] = []
  for (const c of checkpoints) {
    const [a1, b1] = VAL_TARGETS.div1StartersMean
    const [a2, b2] = VAL_TARGETS.div2StartersMean
    if (c.div1Mean < a1 || c.div1Mean > b1) out.push(`T${c.season}: media de titulares de 1.ª = ${c.div1Mean.toFixed(1)} (objetivo ${a1}-${b1})`)
    if (c.div2Mean < a2 || c.div2Mean > b2) out.push(`T${c.season}: media de titulares de 2.ª = ${c.div2Mean.toFixed(1)} (objetivo ${a2}-${b2})`)
    if (c.share85 < VAL_TARGETS.share85[0] || c.share85 > VAL_TARGETS.share85[1]) out.push(`T${c.season}: 85+ en 1.ª = ${(c.share85 * 100).toFixed(1)} % (objetivo poco comunes)`)
    if (c.share90 > VAL_TARGETS.share90[1]) out.push(`T${c.season}: 90+ en 1.ª = ${(c.share90 * 100).toFixed(1)} % (deben ser muy raros)`)
    if (c.share95 > VAL_TARGETS.share95[1]) out.push(`T${c.season}: 95+ en 1.ª = ${(c.share95 * 100).toFixed(2)} % (deben ser rarísimos)`)
    if (c.clubs95.over > 0) out.push(`T${c.season}: ${c.clubs95.over} clubes con más de ${VAL_LIMITS.maxTopStarsPerClub} jugadores de ${VAL_LIMITS.topStarRating}+`)
  }
  return out
}

/* ---------- Texto para la consola ---------- */
const M = (n: number) => `${(n / 1_000_000).toFixed(1)} M`
const P = (n: number) => `${(n * 100).toFixed(1)}%`

export function formatReport(r: LifetimeReport): string {
  const L: string[] = []
  L.push(`=== Lifetime · ${r.seasons} temporadas · liga ${r.leagueId} · semilla ${r.seed} ===`)
  L.push(`Clubes élite al empezar: ${r.elitesStart.join(', ')}`)
  L.push(`Campeones distintos de 1.ª: ${r.winners}`)
  for (const c of r.checkpoints) {
    L.push('')
    L.push(`--- Temporada ${c.season} ---`)
    L.push(`Val medio de titulares: 1.ª ${c.div1Mean.toFixed(1)} (±${c.div1Spread.toFixed(1)}) · 2.ª ${c.div2Mean.toFixed(1)}`)
    L.push(`Jugadores 85+: ${c.n85} (${P(c.share85)} de 1.ª) · 90+: ${c.n90} (${P(c.share90)}) · 95+: ${c.n95} (${P(c.share95)})  [de ${c.players}]`)
    L.push(`95+ por club: máx ${c.clubs95.max} · clubes con alguno ${c.clubs95.withAny} · con dos ${c.clubs95.withTwo} · por encima del tope ${c.clubs95.over}`)
    L.push(`Presupuesto medio: élite inicial ${M(c.budgetEliteStart)} vs resto ${M(c.budgetRest)} · prestigio ${c.prestigeEliteStart.toFixed(0)} vs ${c.prestigeRest.toFixed(0)}`)
    L.push(`Grupo top-${c.topGroup.size} (presupuesto o prestigio): élite inicial dentro ${c.topGroup.eliteStartInTop} · no élite dentro ahora ${c.topGroup.nonEliteNow} · no élite que llegaron alguna vez ${c.topGroup.nonEliteEver} · de forma sostenida (${SIM.sustainedSeasons}+ temporadas) ${c.topGroup.nonEliteSustained}`)
    L.push(`Niveles de cantera (0/1/2/3): ${c.academyLevels.join(' / ')} · traspasos por temporada ${c.transfersPerSeason.toFixed(0)} · clubes en deuda máxima ${c.bankrupt}`)
    for (const t of ACADEMY_TIERS) {
      const k = c.canteranos[t.id]
      if (!k || k.generated === 0) continue
      const f = Math.max(1, k.finished)
      L.push(
        `  cantera ${t.label.padEnd(7)} generados ${String(k.generated).padStart(4)} · pot 85+ ${P(k.pot85 / k.generated)} · pot 90+ ${P(k.pot90 / k.generated)} · terminados ${String(k.finished).padStart(4)} → Val 80+ ${P(k.reach80 / f)} · 85+ ${k.reach85} (${P(k.reach85 / f)}) · 90+ ${k.reach90} (${P(k.reach90 / f)}) · 95+ ${k.reach95}`,
      )
    }
  }
  L.push('')
  L.push(r.warnings.length === 0 ? 'Todo dentro de los rangos.' : `AVISOS (${r.warnings.length}):\n  ${r.warnings.join('\n  ')}`)
  return L.join('\n')
}

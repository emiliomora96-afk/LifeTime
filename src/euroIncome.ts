import type { GameState } from './game'
import { EURO_PRIZES } from './economy'
import { clMatchOutcome, clPathOf, clUser, clUserMatches, clUserPosition } from './champions'
import { europeInfo } from './europe'
import { matchOutcome, userEntrant, userMatches } from './tournament'

/* ==========================================================================
   Ingresos por jugar en Europa (Champions, Europa League y Copa Horizonte).
   Todo se calcula a partir de lo ya jugado, así que antes de que se juegue una fase no aparece su dinero.
   - Se cobra con el balance del cierre: la clasificación y, en la Champions, la fase de liga y la clasificación directa.
   - Se cobra al terminar la parada del torneo europeo (`final: true`): eliminatorias, grupos de las otras dos copas y título.
   ========================================================================== */
export interface EuroLine {
  label: string
  amount: number
  final: boolean // true = se cobra al terminar el torneo europeo, después del cierre
}

function record(w: number, d: number): string {
  return `${w} ${w === 1 ? 'victoria' : 'victorias'}, ${d} ${d === 1 ? 'empate' : 'empates'}`
}

export function europeIncome(game: GameState): EuroLine[] {
  const eu = game.europe && game.europe.season === game.season ? game.europe : null
  if (!eu?.user) return []
  const comp = eu.user
  const prizes = EURO_PRIZES[comp]
  const name = europeInfo(comp).short
  const lines: EuroLine[] = [{ label: `${name}: clasificación`, amount: prizes.participation, final: false }]

  if (comp === 'champions') {
    const cl = game.champions && game.champions.season === game.season ? game.champions : null
    const me = cl ? clUser(cl) : undefined
    if (!cl || !me) return lines

    // Fase de liga: victorias y empates, y clasificación directa
    const league = clUserMatches(cl).filter((m) => m.stage === 'liga')
    const w = league.filter((m) => clMatchOutcome(m, me.id) === 'win').length
    const d = league.filter((m) => clMatchOutcome(m, me.id) === 'draw').length
    if (league.length > 0) {
      lines.push({ label: `${name}: fase de liga (${record(w, d)})`, amount: w * prizes.win + d * prizes.draw, final: false })
      if (clPathOf(clUserPosition(cl)) === 'directo') {
        lines.push({ label: `${name}: clasificación directa a octavos`, amount: prizes.directBonus, final: false })
      }
    }

    // Eliminatorias superadas y título
    let rounds = 0
    for (const round of cl.rounds) {
      for (const tie of round.ties) {
        if (tie.winner === me.id && round.stage !== 'final') rounds += prizes.rounds[round.stage] ?? 0
      }
    }
    if (rounds > 0) lines.push({ label: `${name}: eliminatorias superadas`, amount: rounds, final: true })
    if (cl.champion === me.id) lines.push({ label: `${name}: campeón`, amount: prizes.champion, final: true })
    return lines
  }

  // Europa League y Copa Horizonte: grupos y eliminatorias
  const ts = game.tournament && game.tournament.season === game.season ? game.tournament : null
  const t = ts?.main
  const me = t ? userEntrant(t) : undefined
  if (!t || !me || t.comp !== comp) return lines

  const mine = userMatches(t)
  const group = mine.filter((m) => m.stage === 'group')
  const w = group.filter((m) => matchOutcome(m, me.id) === 'win').length
  const d = group.filter((m) => matchOutcome(m, me.id) === 'draw').length
  if (group.length > 0) {
    lines.push({ label: `${name}: fase de grupos (${record(w, d)})`, amount: w * prizes.win + d * prizes.draw, final: true })
  }
  let rounds = mine.some((m) => m.stage === 'quarter') ? (prizes.rounds.group ?? 0) : 0
  for (const m of mine) {
    if (m.stage !== 'group' && m.stage !== 'final' && m.winner === me.id) rounds += prizes.rounds[m.stage] ?? 0
  }
  if (rounds > 0) lines.push({ label: `${name}: rondas superadas`, amount: rounds, final: true })
  if (t.champion === me.id) lines.push({ label: `${name}: campeón`, amount: prizes.champion, final: true })
  return lines
}

// Lo que se cobra al terminar el torneo europeo
export function europeFinalIncome(game: GameState): EuroLine[] {
  return europeIncome(game).filter((l) => l.final)
}

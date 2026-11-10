import './vitrina.css'
import { useMemo } from 'react'
import type { Club } from './types'
import type { GameState, SeasonRecord } from './game'
import { BALON, POS_LABEL, TITLE_LABEL, balonWinner, computeBalonDeOro } from './balonDeOro'
import type { BalonEntry, BalonRecord } from './balonDeOro'
import TrophyImg from './TrophyImg'

/* ==========================================================================
   Lifetime Balón de Oro en pantalla:
   - BalonDeOroGala: la entrega, en la parada "Gala de premios" (solo el ganador y el podio)
   - BalonDeOroHistory: el historial de ganadores y el desglose de puntos, en Estadísticas y premios
   ========================================================================== */

const clubOf = (e: BalonEntry, clubName: string) => e.club ?? clubName

function Hero({ entry, clubName, season }: { entry: BalonEntry; clubName: string; season: number }) {
  return (
    <div className="bo-hero" data-mine={entry.club === null}>
      <TrophyImg id="balon" height={150} label={`${BALON.name}, temporada ${season}`} />
      <div className="bo-hero-text">
        <span className="bo-kicker">Ganador · Temporada {season}</span>
        <strong className="bo-winner">{entry.name}</strong>
        <span className="bo-sub">
          {POS_LABEL[entry.pos]} · {clubOf(entry, clubName)}
        </span>
        <span className="bo-stats">
          {entry.goals} {entry.goals === 1 ? 'gol' : 'goles'} · {entry.assists} {entry.assists === 1 ? 'asistencia' : 'asistencias'} ·{' '}
          <b>{entry.points} pts</b>
        </span>
      </div>
    </div>
  )
}

// La entrega del premio. Se calcula igual que al cerrar la temporada, así que el ganador es el mismo que queda en el historial.
export function BalonDeOroGala({ game, club }: { game: GameState; club: Club }) {
  const record = useMemo<BalonRecord | null>(
    () =>
      computeBalonDeOro({
        league: game.league,
        champions: game.champions,
        domestic: game.domestic,
        season: game.season,
        seed: game.seed,
      }),
    [game.league, game.champions, game.domestic, game.season, game.seed],
  )
  const winner = balonWinner(record)
  if (!record || !winner) return null
  const podium = record.top.slice(1, 3)
  return (
    <div className="card bo-card">
      <h2>{BALON.name}</h2>
      <Hero entry={winner} clubName={club.name} season={record.season} />
      {winner.club === null && <p className="bo-mine">¡Un jugador de tu club se lleva el {BALON.short}!</p>}
      {podium.length > 0 && (
        <ol className="bo-podium" start={2}>
          {podium.map((e, i) => (
            <li key={e.id + i} className={e.club === null ? 'me' : ''}>
              <span className="bo-pos">{i + 2}.º</span>
              <span className="bo-who">
                <strong>{e.name}</strong>
                <em>
                  {POS_LABEL[e.pos]} · {clubOf(e, club.name)}
                </em>
              </span>
              <b>{e.points} pts</b>
            </li>
          ))}
        </ol>
      )}
      <p className="hint">
        El club del ganador suma +{BALON.prestige[0]} de prestigio; los del 2.º y 3.º, +{BALON.prestige[1]}.
      </p>
    </div>
  )
}

function titleChips(e: BalonEntry) {
  if (e.titles.length === 0) return <span className="bo-chip none">Sin títulos</span>
  return e.titles.map((t) => (
    <span key={t} className="bo-chip" title={`${TITLE_LABEL[t]}: +${BALON.titles[t]}`}>
      {TITLE_LABEL[t]}
    </span>
  ))
}

// Historial: el último premio con el desglose de puntos y la lista de todos los ganadores
export function BalonDeOroHistory({ history, clubName }: { history: SeasonRecord[]; clubName: string }) {
  const seasons = history.filter((r) => r.balon && r.balon.top.length > 0)
  if (seasons.length === 0) {
    return <p className="hint">Aún no se ha entregado ningún {BALON.short}. Se entrega al cerrar cada temporada.</p>
  }
  const last = seasons[seasons.length - 1].balon as BalonRecord
  return (
    <div className="bo-history">
      <Hero entry={last.top[0]} clubName={clubName} season={last.season} />
      <ol className="bo-top">
        {last.top.map((e, i) => (
          <li key={e.id + i} className={e.club === null ? 'me' : ''}>
            <span className="bo-pos">{i + 1}</span>
            <span className="bo-who">
              <strong>{e.name}</strong>
              <em>
                {POS_LABEL[e.pos]} · {clubOf(e, clubName)}
              </em>
              <span className="bo-chips">{titleChips(e)}</span>
            </span>
            <span className="bo-pts">
              <b>{e.points}</b>
              <small>
                {e.titlePts} títulos + {e.rankPts} rendimiento
              </small>
            </span>
          </li>
        ))}
      </ol>
      <h3 className="bo-sub-title">Ganadores</h3>
      <ol className="bo-winners">
        {[...seasons].reverse().map((r) => {
          const w = (r.balon as BalonRecord).top[0]
          return (
            <li key={r.season} className={w.club === null ? 'me' : ''}>
              <span className="bo-season">T{r.season}</span>
              <strong>{w.name}</strong>
              <em>
                {POS_LABEL[w.pos]} · {clubOf(w, clubName)}
              </em>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

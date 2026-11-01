import { Fragment } from 'react'
import type { Club } from './types'
import type { SectionId } from './sections'
import type { GameState } from './game'
import { BASE_STOPS, EVENT_STOPS, ROUNDS_PER_SEASON } from './config'
import { OBJECTIVE, buildInbox } from './mock'
import { getTable } from './season'
import { europeInfo } from './europe'
import MiniBoard from './MiniBoard'
import ErrorBoundary from './ErrorBoundary'

interface Props {
  club: Club
  game: GameState
  onGoTo: (id: SectionId) => void
}

export default function Dashboard({ club, game, onGoTo }: Props) {
  const baseIndex = BASE_STOPS.findIndex((s) => s.id === game.baseStop)
  const base = BASE_STOPS[baseIndex] ?? BASE_STOPS[0]
  const event = game.eventId ? EVENT_STOPS.find((e) => e.id === game.eventId) : undefined
  const inbox = buildInbox(club)
  const unanswered = game.notices.filter((n) => game.answers[n.id] === undefined)
  const requiredLeft = unanswered.filter((n) => n.required).length

  const level = game.league.userDivision
  const table = getTable(game.league, level)
  const myIndex = table.findIndex((r) => r.name === null)
  const top = table.slice(0, 6).map((row, i) => ({ row, pos: i + 1 }))
  const rows = myIndex >= 6 ? [...top, { row: table[myIndex], pos: myIndex + 1 }] : top

  return (
    <div className="dash">
      <section className="card stop-card">
        <h2>
          Parada actual · Temporada {game.season} · Jornada {game.round} de {ROUNDS_PER_SEASON}
        </h2>
        <div className="stepper">
          {BASE_STOPS.map((s, i) => (
            <div
              key={s.id}
              className={'step' + (i < baseIndex ? ' done' : '') + (i === baseIndex ? ' current' : '')}
            >
              <span className="step-dot">{i + 1}</span>
              <span className="step-label">{s.name}</span>
            </div>
          ))}
        </div>
        <h3 className="stop-title">{event ? `${event.icon} ${event.name}` : base.name}</h3>
        <p className="stop-when">{event ? event.intro : base.when}</p>
        {!event && (
          <p>
            <strong>Qué haces:</strong> {base.actions}
          </p>
        )}
        <p className="hint">
          {unanswered.length === 0
            ? 'No tienes avisos pendientes.'
            : `Avisos pendientes: ${unanswered.length}` +
              (requiredLeft > 0 ? ` (${requiredLeft} requieren decisión)` : '')}
        </p>
        {game.europe?.user && game.europe.season === game.season && (
          <p>
            <strong>Europa:</strong> {europeInfo(game.europe.user).icon} {europeInfo(game.europe.user).name} esta temporada.
          </p>
        )}
        <ErrorBoundary name="la pizarra" fallback={null}>
          <MiniBoard club={club} league={game.league} onOpenTable={() => onGoTo('tabla')} />
        </ErrorBoundary>
        <button type="button" className="btn inline only-desktop" onClick={() => onGoTo('parada')}>
          Ir a la parada →
        </button>
      </section>

      <section className="card dash-clasif">
        <h2>Clasificación · {level}.ª división</h2>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Club</th>
              <th>PJ</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, pos }, i) => (
              <Fragment key={pos}>
                {i === 6 && (
                  <tr className="gap">
                    <td colSpan={4}>…</td>
                  </tr>
                )}
                <tr className={row.name === null ? 'me' : ''}>
                  <td>{pos}</td>
                  <td>{row.name ?? club.name}</td>
                  <td>{row.played}</td>
                  <td>{row.points}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        <button type="button" className="link-btn" onClick={() => onGoTo('tabla')}>
          Ver clasificación completa →
        </button>
        {game.round === 0 && <p className="hint">Aún no se ha jugado: orden por nivel de los equipos.</p>}
      </section>

      <section className="card">
        <h2>Objetivo de la directiva</h2>
        <p className="objective">{OBJECTIVE.text}</p>
        <p className="hint">Confianza de la directiva: {OBJECTIVE.confidence}%</p>
        <div className="bar">
          <span style={{ width: `${OBJECTIVE.confidence}%` }} />
        </div>
      </section>

      <section className="card inbox-card">
        <h2>Bandeja de entrada</h2>
        <ul className="inbox">
          {inbox.map((m) => (
            <li key={m.id} className={m.unread ? 'unread' : ''}>
              <div className="inbox-head">
                <strong>{m.from}</strong>
                {m.unread && <span className="dot" />}
              </div>
              <div>{m.subject}</div>
              <div className="hint">{m.preview}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

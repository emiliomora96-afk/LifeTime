import { useState } from 'react'
import type { Club } from './types'
import type { SectionId } from './sections'
import { OBJECTIVE, STANDINGS_SAMPLE, STOPS, buildInbox } from './mock'

interface Props {
  club: Club
  onGoTo: (id: SectionId) => void
}

export default function Dashboard({ club, onGoTo }: Props) {
  const [stopIndex, setStopIndex] = useState(0)
  const stop = STOPS[stopIndex]
  const inbox = buildInbox(club)

  return (
    <div className="dash">
      <section className="card stop-card">
        <h2>Parada actual</h2>
        <div className="stepper">
          {STOPS.map((s, i) => (
            <div
              key={s.id}
              className={'step' + (i < stopIndex ? ' done' : '') + (i === stopIndex ? ' current' : '')}
            >
              <span className="step-dot">{i + 1}</span>
              <span className="step-label">{s.name}</span>
            </div>
          ))}
        </div>
        <h3 className="stop-title">{stop.name}</h3>
        <p className="stop-when">{stop.when}</p>
        <p>
          <strong>Qué haces:</strong> {stop.actions}
        </p>
        <p className="hint">Duración objetivo: {stop.duration}</p>
        {/* Demo visual: en el Paso 4 este botón avanza la temporada de verdad */}
        <button
          type="button"
          className="btn inline"
          onClick={() => setStopIndex((i) => (i + 1) % STOPS.length)}
        >
          Continuar →
        </button>
      </section>

      <section className="card">
        <h2>Clasificación · 2.ª división</h2>
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
            {STANDINGS_SAMPLE.map((row, i) => (
              <tr key={i} className={row.name === null ? 'me' : ''}>
                <td>{i + 1}</td>
                <td>{row.name ?? club.name}</td>
                <td>{row.played}</td>
                <td>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="link-btn" onClick={() => onGoTo('tabla')}>
          Ver clasificación completa →
        </button>
        <p className="hint">Datos de ejemplo.</p>
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
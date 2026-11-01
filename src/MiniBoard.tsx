import './standings.css'
import './miniBoard.css'
import type { CSSProperties } from 'react'
import type { Club } from './types'
import type { LeagueState } from './engine'
import Crest from './Crest'
import { ZONE_COLOR } from './zones'
import { buildBoard, nextMatch } from './miniBoardLogic'

interface Props {
  club: Club
  league: LeagueState
  onOpenTable?: () => void
}

// Mini tabla con el mismo estilo que la Clasificación: tu club en el centro, el equipo de arriba y el de abajo.
export default function MiniBoard({ club, league, onOpenTable }: Props) {
  const board = buildBoard(league, club)
  const next = nextMatch(league)

  return (
    <section className="miniboard" aria-label={`Clasificación de la ${board.level}.ª división, cerca de tu club`}>
      <header className="mb-head">
        <h3>Tu posición · {board.level}.ª división</h3>
        {onOpenTable && (
          <button type="button" className="mb-open" onClick={onOpenTable}>
            Tabla completa
          </button>
        )}
      </header>

      <div className="table-scroll">
        <table className="data-table standings-table">
          <thead>
            <tr>
              <th className="st-pos">#</th>
              <th>Club</th>
              <th className="num hide-sm">PJ</th>
              <th className="num">
                <span className="lbl-lg">G</span>
                <span className="lbl-sm">V</span>
              </th>
              <th className="num">E</th>
              <th className="num">
                <span className="lbl-lg">P</span>
                <span className="lbl-sm">D</span>
              </th>
              <th className="num hide-sm">DG</th>
              <th className="num show-sm">PJ</th>
              <th className="num st-pts-h">
                <span className="lbl-lg">Pts</span>
                <span className="lbl-sm">PTOS</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r) => {
              const style = r.zone ? ({ '--zone': ZONE_COLOR[r.zone] } as CSSProperties) : undefined
              return (
                <tr key={r.id} className={r.isMe ? 'me' : ''} data-zone={r.zone ?? undefined} style={style} aria-current={r.isMe ? 'true' : undefined}>
                  <td className="st-pos">
                    <span className="pos-badge">{r.pos}</span>
                  </td>
                  <td>
                    <span className="club-cell">
                      <Crest name={r.name} shape={r.isMe ? club.crestShape : 'classic'} primary={r.colors[0]} secondary={r.colors[1]} size={20} />
                      <span className="club-name">{r.name}</span>
                    </span>
                  </td>
                  <td className="num hide-sm">{r.played}</td>
                  <td className="num">{r.won}</td>
                  <td className="num">{r.drawn}</td>
                  <td className="num">{r.lost}</td>
                  <td className={'num hide-sm dg' + (r.gd > 0 ? ' pos' : r.gd < 0 ? ' neg' : '')}>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="num show-sm">{r.played}</td>
                  <td className="num st-pts">
                    <strong>{r.points}</strong>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mb-next">
        <span className="mb-next-x" aria-hidden="true">⚽</span>
        {next ? (
          <span className="mb-next-txt">
            <small>
              Próximo · J{next.round} · {next.home ? 'En casa' : 'De visita'}
            </small>
            <strong>
              {next.home ? 'vs' : '@'} {next.rival}
            </strong>
          </span>
        ) : (
          <span className="mb-next-txt">
            <small>Próximo partido</small>
            <strong>Temporada completada</strong>
          </span>
        )}
      </div>
    </section>
  )
}

import './market.css'
import { useState } from 'react'
import PageHead from './PageHead'
import type { GameState } from './game'
import { LEVEL_NAMES } from './config'
import { formatMoney } from './data'
import { getUserSquad } from './engine'
import { ACADEMY_MAX_AGE, academyCapacity, intakeSize } from './academy'
import { phaseOf, playerSalary, potentialLabel } from './players'
import type { SimPlayer } from './players'
import { MAX_SQUAD } from './squads'
import { PHASES } from './playerView'

interface Props {
  game: GameState
  onPromote: (player: SimPlayer) => void
  onRelease: (player: SimPlayer) => void
}

export default function Academy({ game, onPromote, onRelease }: Props) {
  const [confirm, setConfirm] = useState<string | null>(null)

  const level = game.investments.academy
  const capacity = academyCapacity(level)
  const squadSize = getUserSquad(game.league).length
  const squadFull = squadSize >= MAX_SQUAD
  const youths = [...game.academy].sort((a, b) => b.age - a.age || b.rating - a.rating)

  function ask(key: string, action: () => void) {
    if (confirm === key) {
      setConfirm(null)
      action()
    } else setConfirm(key)
  }

  return (
    <div className="page">
      <PageHead
        icon="🌱"
        title="Cantera"
        subtitle="Tus juveniles. Súbelos al primer equipo cuando estén listos o libera su plaza."
      />

      <div className="card">
        <h2>Tu cantera</h2>
        <div className="academy-info">
          <div>
            Plazas
            <strong>
              {youths.length} / {capacity}
            </strong>
          </div>
          <div>
            Inversión
            <strong>{LEVEL_NAMES[level]}</strong>
          </div>
          <div>
            Llegan cada temporada
            <strong>hasta {2 + level}</strong>
          </div>
          <div>
            Plantilla del primer equipo
            <strong>
              {squadSize} / {MAX_SQUAD}
            </strong>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table market-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th className="num">Potencial</th>
                <th>Fase</th>
                <th className="num">Sueldo si sube</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {youths.map((p) => {
                const lastYear = p.age >= ACADEMY_MAX_AGE
                const phase = PHASES[phaseOf(p)]
                const upKey = 'u' + p.id
                const outKey = 'r' + p.id
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="pos">{p.pos}</span>
                    </td>
                    <td>
                      {p.name}
                      {p.nat ? <span className="nat-code"> {p.nat}</span> : null}
                      {lastYear ? <span className="tag last"> Último año</span> : null}
                    </td>
                    <td className="num">{p.age}</td>
                    <td className="num">{p.rating}</td>
                    <td className="num">{potentialLabel(p)}</td>
                    <td className={phase.cls}>{phase.label}</td>
                    <td className="num">{formatMoney(playerSalary(p))}</td>
                    <td className="num">
                      <div className="row-btns">
                        <button
                          type="button"
                          className="mini-btn"
                          disabled={squadFull}
                          title={squadFull ? `Plantilla llena (${MAX_SQUAD})` : undefined}
                          onClick={() => ask(upKey, () => onPromote(p))}
                        >
                          {confirm === upKey ? '¿Confirmar?' : 'Subir al primer equipo'}
                        </button>
                        <button
                          type="button"
                          className="mini-btn danger"
                          onClick={() => ask(outKey, () => onRelease(p))}
                        >
                          {confirm === outKey ? '¿Seguro?' : 'Liberar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {youths.length === 0 ? (
                <tr>
                  <td colSpan={8} className="hint center">
                    La cantera está vacía. Al empezar la próxima temporada llegarán {intakeSize(level, 0)} juveniles.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="hint">
          A los {ACADEMY_MAX_AGE} años es su último año: si no lo subes al primer equipo, se va al terminar la
          temporada. Cada temporada llegan juveniles nuevos mientras haya plazas libres. Más inversión en cantera
          significa más plazas y mejor potencial (se cambia en Finanzas).
        </p>
      </div>
    </div>
  )
}

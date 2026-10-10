import { INVESTMENTS, LEVEL_NAMES } from './config'
import type { InvestArea } from './config'
import type { GameState } from './game'
import { formatMoney } from './data'

interface Props {
  game: GameState
  onInvest: (area: InvestArea, level: number) => void
}

export default function Investments({ game, onInvest }: Props) {
  const areas = Object.keys(INVESTMENTS) as InvestArea[]

  return (
    <div className="card">
      <h2>Inversiones del club</h2>
      <p className="hint">
        Se pagan una vez por temporada, al cerrarla, junto con los salarios. Puedes cambiarlas en cualquier parada.
      </p>
      <div className="invest-list">
        {areas.map((a) => {
          const info = INVESTMENTS[a]
          const level = game.investments[a]
          return (
            <div className="invest" key={a}>
              <div className="invest-head">
                <strong>
                  {info.icon} {info.label}
                </strong>
                <span>{formatMoney(info.costs[level])} / temporada</span>
              </div>
              <span className="hint">{info.effect}</span>
              <div className="levels">
                {LEVEL_NAMES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className={'level' + (i === level ? ' active' : '')}
                    onClick={() => onInvest(a, i)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
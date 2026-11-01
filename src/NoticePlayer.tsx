import type { SimPlayer } from './players'
import { marketValue, nameParts, playerSalary, potentialLabel } from './players'
import { NATIONS } from './nations'
import { formatMoney } from './data'
import { auraOf } from './aura'
import { deltaClass, deltaText } from './playerView'
import PlayerFace from './PlayerFace'

// Mini ficha del jugador que aparece dentro de un aviso (lesión, contrato, oferta, ojeadores...)
export default function NoticePlayer({ player }: { player: SimPlayer }) {
  const { first, last } = nameParts(player)
  const nation = player.nat ? NATIONS[player.nat] : undefined
  const color = auraOf(player.rating).color
  return (
    <div className="notice-player">
      <div className="notice-player-photo">
        <PlayerFace player={player} shape="card" res={192} />
      </div>
      <div className="notice-player-info">
        <div className="notice-player-name">
          <span>{first}</span>
          <strong>{last}</strong>
        </div>
        <div className="notice-player-tags">
          <span className="pos">{player.pos}</span>
          <span>{nation ? `${nation.id} · ${nation.name}` : 'Sin nacionalidad'}</span>
        </div>
        <dl className="notice-player-stats">
          <div>
            <dt>Edad</dt>
            <dd>{player.age}</dd>
          </div>
          <div>
            <dt>Potencial</dt>
            <dd>{potentialLabel(player)}</dd>
          </div>
          <div>
            <dt>Sueldo</dt>
            <dd>{formatMoney(playerSalary(player))}</dd>
          </div>
          <div>
            <dt>Valor</dt>
            <dd>{formatMoney(marketValue(player))}</dd>
          </div>
        </dl>
      </div>
      <div className="notice-player-val" style={{ color, borderColor: color }}>
        {player.rating}
        <small>VAL</small>
        {deltaText(player.lastGain) && <span className={deltaClass(player.lastGain)}>{deltaText(player.lastGain)}</span>}
      </div>
    </div>
  )
}

import './ficha.css'
import type { Club } from './types'
import type { SimPlayer } from './players'
import { marketValue, nameParts, phaseOf, playerSalary, potentialLabel, potentialRange } from './players'
import { NATIONS } from './nations'
import { formatMoney } from './data'
import { PHASES, gainClass, gainLabel, ratingColor } from './playerView'

const BAR_MIN = 40
const BAR_MAX = 100
const SEASON_ROUNDS = 38

function pct(v: number): number {
  return Math.max(0, Math.min(100, ((v - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100))
}

// Silueta en los colores de tu club (el retrato anime llegará más adelante)
function Silhouette({ club }: { club: Club }) {
  return (
    <svg className="ficha-photo" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="14" fill={club.primaryColor} />
      <circle cx="50" cy="38" r="16" fill={club.secondaryColor} opacity="0.95" />
      <path d="M16 100 C16 70 32 60 50 60 C68 60 84 70 84 100 Z" fill={club.secondaryColor} opacity="0.95" />
    </svg>
  )
}

interface Props {
  player: SimPlayer | undefined
  club: Club
  swapMode: boolean
  onToggleSwap: () => void
  onClose: () => void
}

export default function PlayerCard({ player, club, swapMode, onToggleSwap, onClose }: Props) {
  if (!player) {
    return (
      <aside className="ficha ficha-empty">
        <div className="ficha-empty-icon">👤</div>
        <p>Toca un jugador del campo o de la plantilla para ver su ficha.</p>
      </aside>
    )
  }

  const { first, last } = nameParts(player)
  const nation = player.nat ? NATIONS[player.nat] : undefined
  const [lo, hi] = potentialRange(player)
  const average = Math.round((lo + hi) / 2)
  const phase = PHASES[phaseOf(player)]
  const slow = phaseOf(player) === 'crece' && !player.starter
  const color = ratingColor(player.rating)
  const closed = lo === hi

  return (
    <aside className="ficha">
      <button type="button" className="ficha-close" aria-label="Cerrar ficha" onClick={onClose}>
        ✕
      </button>

      <div className="ficha-top">
        <Silhouette club={club} />
        <div className="ficha-id">
          <span className="ficha-first">{first}</span>
          <strong className="ficha-last">{last}</strong>
          <div className="ficha-tags">
            <span className="pos">{player.pos}</span>
            <span className="ficha-nat">{nation ? `${nation.id} · ${nation.name}` : 'Sin nacionalidad'}</span>
          </div>
        </div>
        <div className="ficha-rating" style={{ color, borderColor: color }}>
          {player.rating}
          <small>VAL</small>
        </div>
      </div>

      <div className="ficha-pot">
        <div className="ficha-pot-head">
          <span>Potencial</span>
          <strong>{potentialLabel(player)}</strong>
        </div>
        <div className="ficha-bar">
          <div className="ficha-band" style={{ left: `${pct(lo)}%`, width: `${Math.max(1.5, pct(hi) - pct(lo))}%` }} />
          <div className="ficha-fill" style={{ width: `${pct(player.rating)}%`, background: color }} />
        </div>
        <div className="ficha-pot-foot">
          <span>Promedio {average}</span>
          <span>{closed ? 'Potencial definido' : 'El rango se cierra con los años'}</span>
        </div>
      </div>

      <dl className="ficha-grid">
        <div>
          <dt>Edad</dt>
          <dd>{player.age} años</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>{player.starter ? 'Titular' : 'Suplente'}</dd>
        </div>
        <div>
          <dt>Fase</dt>
          <dd className={phase.cls}>{slow ? '↗ Crece despacio' : phase.label}</dd>
        </div>
        <div>
          <dt>Último año</dt>
          <dd className={gainClass(player.lastGain)}>{gainLabel(player.lastGain)}</dd>
        </div>
        <div>
          <dt>Jornadas de titular</dt>
          <dd>
            {player.starts ?? 0} / {SEASON_ROUNDS}
          </dd>
        </div>
        <div>
          <dt>Sueldo anual</dt>
          <dd>{formatMoney(playerSalary(player))}</dd>
        </div>
        <div className="ficha-wide">
          <dt>Valor de mercado</dt>
          <dd>{formatMoney(marketValue(player))}</dd>
        </div>
      </dl>

      <button type="button" className={'ficha-swap' + (swapMode ? ' active' : '')} onClick={onToggleSwap}>
        {swapMode ? 'Cancelar cambio' : player.starter ? 'Cambiar por un suplente' : 'Cambiar por un titular'}
      </button>
      <p className="ficha-hint">
        {swapMode
          ? 'Toca a un jugador resaltado en verde (misma posición, rol contrario).'
          : 'El cambio solo es posible entre un titular y un suplente de la misma posición.'}
      </p>
    </aside>
  )
}

import type { Club } from './types'
import type { GameState } from './game'
import { formatMoney } from './data'
import { ROUNDS_PER_SEASON, TOTAL_SEASONS } from './config'
import Crest from './Crest'

interface Props {
  club: Club
  game: GameState
  onBudget?: () => void // acceso directo a Club > Finanzas
  onMenu?: () => void // abre la hoja «Más» (solo móvil)
}

export default function TopBar({ club, game, onBudget, onMenu }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-club">
        <Crest
          name={club.name}
          shape={club.crestShape}
          primary={club.primaryColor}
          secondary={club.secondaryColor}
          size={30}
        />
        <span className="topbar-name">{club.name}</span>
        {onMenu && (
          <button type="button" className="topbar-menu" aria-label="Más secciones" onClick={onMenu}>
            ☰
          </button>
        )}
      </div>
      <div className="stat">
        <span>Temporada</span>
        <strong>
          {game.season} / {TOTAL_SEASONS}
        </strong>
      </div>
      <div className="stat">
        <span>Jornada</span>
        <strong>
          {game.round} / {ROUNDS_PER_SEASON}
        </strong>
      </div>
      <button type="button" className="stat stat-link" onClick={onBudget} title="Ver finanzas">
        <span>Presupuesto</span>
        <strong>{formatMoney(club.budget)}</strong>
      </button>
      <div className="stat">
        <span>Prestigio</span>
        <strong>{game.prestige}</strong>
      </div>
    </header>
  )
}

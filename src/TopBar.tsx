import type { Club } from './types'
import type { GameState } from './game'
import { formatMoney } from './data'
import { ROUNDS_PER_SEASON, TOTAL_SEASONS } from './config'
import Crest from './Crest'

interface Props {
  club: Club
  game: GameState
  onMenu: () => void
}

export default function TopBar({ club, game, onMenu }: Props) {
  return (
    <header className="topbar">
      <button type="button" className="menu-btn" onClick={onMenu} aria-label="Abrir menú">
        ☰
      </button>
      <div className="topbar-club">
        <Crest
          name={club.name}
          shape={club.crestShape}
          primary={club.primaryColor}
          secondary={club.secondaryColor}
          size={30}
        />
        <span className="topbar-name">{club.name}</span>
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
      <div className="stat">
        <span>Presupuesto</span>
        <strong>{formatMoney(club.budget)}</strong>
      </div>
      <div className="stat">
        <span>Prestigio</span>
        <strong>{game.prestige}</strong>
      </div>
    </header>
  )
}

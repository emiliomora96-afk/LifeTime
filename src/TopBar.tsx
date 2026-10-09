import type { Club } from './types'
import { formatMoney } from './data'
import { START_PRESTIGE, TOTAL_SEASONS } from './mock'
import Crest from './Crest'

interface Props {
  club: Club
  onMenu: () => void
}

export default function TopBar({ club, onMenu }: Props) {
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
        <strong>1 / {TOTAL_SEASONS}</strong>
      </div>
      <div className="stat">
        <span>Presupuesto</span>
        <strong>{formatMoney(club.budget)}</strong>
      </div>
      <div className="stat">
        <span>Prestigio</span>
        <strong>{START_PRESTIGE}</strong>
      </div>
    </header>
  )
}
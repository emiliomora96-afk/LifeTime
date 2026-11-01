import type { SimPlayer } from './players'
import PlayerFace from './PlayerFace'

// Mini retrato con aura para filas de tablas (plantilla, mercado, cantera)
export default function PlayerChip({ player }: { player: SimPlayer }) {
  return (
    <span className="chip-face" aria-hidden="true">
      <PlayerFace player={player} res={64} />
    </span>
  )
}

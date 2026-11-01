import type { SimPlayer } from './players'
import { NATIONS } from './nations'
import PlayerAura from './PlayerAura'
import { PlayerPortrait } from './portraits'

interface Props {
  player: SimPlayer
  shape?: 'round' | 'card'
  /** Resolución interna del retrato (la pantalla lo escala con CSS). */
  res?: number
}

// Retrato del jugador (motor) dentro de su aura. Se usa en el campo y en la ficha.
export default function PlayerFace({ player, shape = 'round', res = 96 }: Props) {
  const nation = player.nat ? NATIONS[player.nat]?.name ?? '' : ''
  return (
    <PlayerAura rating={player.rating} lastGain={player.lastGain} shape={shape}>
      <PlayerPortrait seed={player.id} nationality={nation} age={player.age} size={res} />
    </PlayerAura>
  )
}

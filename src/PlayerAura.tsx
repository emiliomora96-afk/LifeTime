import type { CSSProperties, ReactNode } from 'react'
import './aura.css'
import { auraOf, crossedTier, mixColor } from './aura'

interface Props {
  rating: number
  lastGain?: number
  /** 'round' = círculo (campo). 'card' = cuadrado redondeado (ficha). */
  shape?: 'round' | 'card'
  /** Tamaño en px. Si se omite, ocupa el 100% de su contenedor. */
  size?: number
  children: ReactNode
}

// Marco con aura alrededor de cualquier contenido (el retrato del jugador).
// El color y el nivel salen de aura.ts (según el Val). Solo los tramos con `animated` se mueven (90+).
export default function PlayerAura({ rating, lastGain, shape = 'round', size, children }: Props) {
  const { tier, color, animated } = auraOf(rating)
  const levelUp = crossedTier(rating, lastGain)
  const style = {
    '--aura-c': color,
    '--aura-l': mixColor(color, '#ffffff', 0.45), // tono claro (reflejo del aro)
    '--aura-d': mixColor(color, '#000000', 0.55), // tono oscuro (sombra del aro)
    ...(size ? { width: size, height: size } : null),
  } as CSSProperties
  const kind = tier === 'none' ? '' : animated ? ' aura-fx' : ' aura-static'
  return (
    <div className={`aura aura-${tier}${kind} aura-${shape}${levelUp ? ' aura-levelup' : ''}`} style={style}>
      <span className="aura-glow" aria-hidden="true" />
      <span className="aura-ring" aria-hidden="true" />
      <span className="aura-ring aura-ring-2" aria-hidden="true" />
      <div className="aura-face">{children}</div>
    </div>
  )
}

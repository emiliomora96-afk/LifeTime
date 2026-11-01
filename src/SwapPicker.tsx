import './swapPicker.css'
import type { SimPlayer } from './players'
import { nameParts, potentialRange } from './players'
import { auraOf } from './aura'
import PlayerFace from './PlayerFace'

interface Props {
  selected: SimPlayer
  candidates: SimPlayer[]
  onPick: (p: SimPlayer) => void
  onCancel: () => void
}

// Panel para cambiar jugadores en móvil: al tocar "Cambiar" salen las tarjetas de los que pueden entrar
// (misma posición, rol contrario) con su valoración, promedio de potencial y edad. En escritorio no se ve.
export default function SwapPicker({ selected, candidates, onPick, onCancel }: Props) {
  const sorted = [...candidates].sort((a, b) => b.rating - a.rating)
  const title = selected.starter ? 'Elige al suplente que entra' : 'Elige al titular que sale'

  return (
    <div className="swap-picker" role="dialog" aria-label="Elegir jugador para el cambio">
      <div className="swap-head">
        <div>
          <strong>{title}</strong>
          <span>
            {selected.starter ? 'Sale' : 'Entra'}: {nameParts(selected).last} · {selected.pos} · VAL {selected.rating}
          </span>
        </div>
        <button type="button" className="swap-cancel" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="swap-empty">No hay jugadores de esa posición disponibles para el cambio.</p>
      ) : (
        <div className="swap-grid">
          {sorted.map((p) => {
            const [lo, hi] = potentialRange(p)
            const color = auraOf(p.rating).color
            return (
              <button key={p.id} type="button" className="swap-card" onClick={() => onPick(p)}>
                <span className="swap-face">
                  <PlayerFace player={p} shape="card" res={96} />
                </span>
                <span className="swap-name">{nameParts(p).last}</span>
                <span className="swap-role">
                  {p.pos} · {p.starter ? 'Titular' : 'Suplente'}
                </span>
                <span className="swap-stats">
                  <span>
                    <b style={{ color }}>{p.rating}</b>
                    <small>VAL</small>
                  </span>
                  <span>
                    <b>{Math.round((lo + hi) / 2)}</b>
                    <small>PROM</small>
                  </span>
                  <span>
                    <b>{p.age}</b>
                    <small>EDAD</small>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

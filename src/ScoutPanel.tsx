import { useState } from 'react'
import type { Club } from './types'
import type { GameState, ScoutOrder } from './game'
import type { Position } from './sample'
import { MISSION_COST } from './config'
import { formatMoney } from './data'
import { scoutChance } from './notices'

const POSITIONS: { id: Position; label: string }[] = [
  { id: 'POR', label: 'Portero' },
  { id: 'DEF', label: 'Defensa' },
  { id: 'MED', label: 'Mediocampista' },
  { id: 'DEL', label: 'Delantero' },
]

const AGE_PRESETS = [
  { label: 'Juveniles', min: 16, max: 20 },
  { label: 'Jóvenes', min: 21, max: 25 },
  { label: 'En su pico', min: 26, max: 30 },
  { label: 'Veteranos', min: 31, max: 38 },
]

const AGES = Array.from({ length: 23 }, (_, i) => 16 + i)

interface Props {
  club: Club
  game: GameState
  onScout: (order: ScoutOrder) => void
}

export default function ScoutPanel({ club, game, onScout }: Props) {
  const [pos, setPos] = useState<Position>('DEL')
  const [minRating, setMinRating] = useState(65)
  const [minPotential, setMinPotential] = useState(75)
  const [ageMin, setAgeMin] = useState(16)
  const [ageMax, setAgeMax] = useState(38)

  const order: ScoutOrder = { pos, minRating, minPotential, ageMin, ageMax }
  const chance = Math.round(scoutChance(game.investments.scouts, order) * 100)
  const noFunds = club.budget < MISSION_COST

  function changeAgeMin(value: number) {
    setAgeMin(value)
    if (value > ageMax) setAgeMax(value)
  }

  function changeAgeMax(value: number) {
    setAgeMax(value)
    if (value < ageMin) setAgeMin(value)
  }

  if (game.scoutOrder) {
    const o = game.scoutOrder
    const label = POSITIONS.find((p) => p.id === o.pos)?.label ?? o.pos
    return (
      <div className="card">
        <h2>🔭 Cazatalentos</h2>
        <p>
          Los ojeadores están buscando: <strong>{label}</strong> de {o.ageMin} a {o.ageMax} años, valoración{' '}
          {o.minRating}+ y potencial {o.minPotential}+. Traerán noticias en la próxima parada.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>🔭 Cazatalentos</h2>
      <p className="hint">
        Dile a tus ojeadores qué jugador buscas. El potencial es el máximo del rango que puede alcanzar. El resultado
        llega en la próxima parada.
      </p>

      <div className="scout-form">
        <div className="field">
          <label htmlFor="scout-pos">Posición</label>
          <select id="scout-pos" value={pos} onChange={(e) => setPos(e.target.value as Position)}>
            {POSITIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="scout-rating">Valoración mínima</label>
          <select id="scout-rating" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            {[60, 65, 70, 75, 80].map((v) => (
              <option key={v} value={v}>
                {v}+
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="scout-pot">Potencial mínimo</label>
          <select id="scout-pot" value={minPotential} onChange={(e) => setMinPotential(Number(e.target.value))}>
            {[65, 70, 75, 80, 85, 90].map((v) => (
              <option key={v} value={v}>
                {v}+
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="scout-age-min">Edad mínima</label>
          <select id="scout-age-min" value={ageMin} onChange={(e) => changeAgeMin(Number(e.target.value))}>
            {AGES.map((a) => (
              <option key={a} value={a}>
                {a} años
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="scout-age-max">Edad máxima</label>
          <select id="scout-age-max" value={ageMax} onChange={(e) => changeAgeMax(Number(e.target.value))}>
            {AGES.map((a) => (
              <option key={a} value={a}>
                {a} años
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="levels">
        {AGE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={'level' + (ageMin === p.min && ageMax === p.max ? ' active' : '')}
            onClick={() => {
              setAgeMin(p.min)
              setAgeMax(p.max)
            }}
          >
            {p.label} ({p.min}–{p.max})
          </button>
        ))}
      </div>

      <p className="hint">
        Costo de la misión: {formatMoney(MISSION_COST)}. Probabilidad de éxito con esta petición: {chance}%.
      </p>
      <button type="button" className="btn inline" disabled={noFunds} onClick={() => onScout(order)}>
        Enviar a los ojeadores
      </button>
      {noFunds && <p className="hint">Presupuesto insuficiente.</p>}
    </div>
  )
}

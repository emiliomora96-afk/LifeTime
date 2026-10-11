import { useState } from 'react'
import type { Club } from './types'
import type { LeagueState } from './engine'
import { getUserSquad, getUserTeam } from './engine'
import type { SimPlayer } from './players'
import { phaseOf, potentialLabel } from './players'
import type { Position } from './sample'
import { FORMATION, POSITION_ORDER, pickStarters, squadStrength } from './squads'
import PageHead from './PageHead'

const PITCH_Y: Record<Position, number> = { POR: 88, DEF: 69, MED: 47, DEL: 18 }

const PHASES = {
  crece: { label: '↗ Crece', cls: 'phase-up' },
  pico: { label: '→ En su pico', cls: 'phase-peak' },
  declive: { label: '↘ En declive', cls: 'phase-down' },
}

function xPositions(n: number): number[] {
  if (n === 1) return [50]
  return Array.from({ length: n }, (_, i) => 14 + (72 * i) / (n - 1))
}

function average(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length
}

interface Props {
  club: Club
  league: LeagueState
  onSwap: (idA: string, idB: string) => void
  onAutoLineup: () => void
}

export default function Team({ club, league, onSwap, onAutoLineup }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const squad = getUserSquad(league)
  const team = getUserTeam(league)
  const manual = team?.autoLineup === false
  const starters = squad.filter((p) => p.starter)

  const currentStrength = squadStrength(squad)
  const bestStrength = squadStrength(pickStarters(squad))

  const selected = squad.find((p) => p.id === selectedId)

  // Se puede cambiar con alguien de la misma posición que tenga el rol contrario
  function canSwap(p: SimPlayer): boolean {
    return !!selected && p.id !== selected.id && p.pos === selected.pos && p.starter !== selected.starter
  }

  function handlePick(p: SimPlayer) {
    if (selected && canSwap(p)) {
      onSwap(selected.id, p.id)
      setSelectedId(null)
      return
    }
    setSelectedId(selectedId === p.id ? null : p.id)
  }

  const sorted = [...squad].sort(
    (a, b) => POSITION_ORDER.indexOf(a.pos) - POSITION_ORDER.indexOf(b.pos) || b.rating - a.rating,
  )

  const tokens: { player: SimPlayer; x: number; y: number }[] = []
  for (const pos of POSITION_ORDER) {
    const line = starters.filter((p) => p.pos === pos).sort((a, b) => b.rating - a.rating)
    const xs = xPositions(line.length)
    line.forEach((player, i) => tokens.push({ player, x: xs[i], y: PITCH_Y[pos] }))
  }

  return (
    <div className="page">
      <PageHead
        icon="👕"
        title="Equipo"
        subtitle="Tu plantilla real. El potencial es un rango que se cierra con los años y desaparece hacia los 27."
      />

      <div className="kpis">
        <div className="kpi">
          <span>Formación</span>
          <strong>{FORMATION}</strong>
        </div>
        <div className="kpi">
          <span>Valoración del once</span>
          <strong>{currentStrength.toFixed(1)}</strong>
        </div>
        <div className="kpi">
          <span>Edad media</span>
          <strong>{average(squad.map((p) => p.age)).toFixed(1)} años</strong>
        </div>
        <div className="kpi">
          <span>Plantilla</span>
          <strong>{squad.length} jugadores</strong>
        </div>
      </div>

      <div className="card">
        <div className="lineup-head">
          <div>
            <h2>Alineación</h2>
            <p className="hint lineup-mode">
              {manual
                ? 'Manual: tú eliges el once. Los fichajes nuevos empiezan de suplentes.'
                : 'Automática: el entrenador elige siempre el mejor once.'}
            </p>
          </div>
          <button type="button" className="mini-btn" disabled={!manual} onClick={onAutoLineup}>
            Mejor once automático
          </button>
        </div>

        {manual && bestStrength > currentStrength && (
          <p className="notice-inline">
            Tu once tiene valoración {currentStrength.toFixed(1)}. El mejor once posible tendría{' '}
            {bestStrength.toFixed(1)}.
          </p>
        )}

        <p className="hint">
          {selected
            ? `Elige con quién cambiar a ${selected.name} (jugadores de la misma posición resaltados en verde), o vuelve a tocarlo para cancelar.`
            : 'Toca un jugador del campo o de la tabla y luego aquel con quien quieres cambiarlo. Solo se puede cambiar entre jugadores de la misma posición.'}
        </p>

        <div className="pitch">
          <div className="pitch-box top" />
          <div className="pitch-box bottom" />
          {tokens.map(({ player, x, y }) => (
            <button
              key={player.id}
              type="button"
              className={
                'token' +
                (selected?.id === player.id ? ' selected' : '') +
                (canSwap(player) ? ' target' : '')
              }
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => handlePick(player)}
            >
              <div
                className="token-badge"
                style={{
                  background: club.primaryColor,
                  color: club.secondaryColor,
                  borderColor: club.secondaryColor,
                }}
              >
                {player.rating}
              </div>
              <div className="token-name">{player.name.split(' ').slice(-1)[0]}</div>
            </button>
          ))}
        </div>
        <p className="hint center">El número es la valoración actual.</p>
      </div>

      <div className="card">
        <h2>Plantilla completa</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th className="num">Potencial</th>
                <th>Fase</th>
                <th>Rol</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const phase = PHASES[phaseOf(p)]
                const isSelected = selected?.id === p.id
                const isTarget = canSwap(p)
                return (
                  <tr key={p.id} className={(isSelected ? 'row-selected' : '') + (isTarget ? ' row-target' : '')}>
                    <td>
                      <span className="pos">{p.pos}</span>
                    </td>
                    <td>{p.name}</td>
                    <td className="num">{p.age}</td>
                    <td className="num">{p.rating}</td>
                    <td className="num">
                      <strong>{potentialLabel(p)}</strong>
                    </td>
                    <td className={phase.cls}>{phase.label}</td>
                    <td>{p.starter ? 'Titular' : 'Suplente'}</td>
                    <td className="num">
                      {isSelected ? (
                        <button type="button" className="mini-btn" onClick={() => handlePick(p)}>
                          Cancelar
                        </button>
                      ) : isTarget ? (
                        <button type="button" className="mini-btn" onClick={() => handlePick(p)}>
                          Intercambiar
                        </button>
                      ) : !selected ? (
                        <button type="button" className="mini-btn" onClick={() => handlePick(p)}>
                          Mover
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

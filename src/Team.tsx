import { useRef, useState } from 'react'
import type { Club } from './types'
import type { LeagueState } from './engine'
import { getUserSquad, getUserTeam } from './engine'
import type { SimPlayer } from './players'
import { nameParts, phaseOf, potentialLabel } from './players'
import { PHASES, gainClass, gainLabel } from './playerView'
import PlayerCard from './PlayerCard'
import type { Position } from './sample'
import { FORMATION, POSITION_ORDER, pickStarters, squadStrength } from './squads'
import PageHead from './PageHead'

type Tab = Position | 'TODOS'

const TABS: { id: Tab; label: string }[] = [
  { id: 'POR', label: 'Porteros' },
  { id: 'DEF', label: 'Defensas' },
  { id: 'MED', label: 'Medios' },
  { id: 'DEL', label: 'Delanteros' },
  { id: 'TODOS', label: 'Todos' },
]

const PITCH_Y: Record<Position, number> = { POR: 88, DEF: 69, MED: 47, DEL: 18 }

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
  const [swapMode, setSwapMode] = useState(false)
  const [tab, setTab] = useState<Tab>('POR')
  const cardRef = useRef<HTMLDivElement>(null)

  const squad = getUserSquad(league)
  const team = getUserTeam(league)
  const manual = team?.autoLineup === false
  const starters = squad.filter((p) => p.starter)

  const currentStrength = squadStrength(squad)
  const bestStrength = squadStrength(pickStarters(squad))

  const selected = squad.find((p) => p.id === selectedId)

  // En modo cambio: alguien de la misma posición que tenga el rol contrario
  function canSwap(p: SimPlayer): boolean {
    return swapMode && !!selected && p.id !== selected.id && p.pos === selected.pos && p.starter !== selected.starter
  }

  function handlePick(p: SimPlayer, fromTable = false) {
    if (selected && canSwap(p)) {
      onSwap(selected.id, p.id)
      setSwapMode(false) // la ficha se queda en el jugador que movías
      return
    }
    setSwapMode(false)
    if (selectedId === p.id) {
      setSelectedId(null)
      return
    }
    setSelectedId(p.id)
    if (tab !== 'TODOS') setTab(p.pos) // la lista de abajo sigue al jugador que tocas
    if (fromTable) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function closeCard() {
    setSelectedId(null)
    setSwapMode(false)
  }

  const sorted = [...squad].sort(
    (a, b) => POSITION_ORDER.indexOf(a.pos) - POSITION_ORDER.indexOf(b.pos) || b.rating - a.rating,
  )
  const shown = tab === 'TODOS' ? sorted : sorted.filter((p) => p.pos === tab)

  function toggleSwap() {
    // Al empezar un cambio, la lista muestra la posición del jugador para ver a quién puede cambiar
    if (!swapMode && selected && tab !== 'TODOS') setTab(selected.pos)
    setSwapMode((v) => !v)
  }

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
          {swapMode && selected
            ? `Elige con quién cambiar a ${selected.name}: los jugadores resaltados en verde, o cancela desde su ficha.`
            : 'Toca un jugador del campo o de la plantilla para ver su ficha. Desde ahí puedes cambiarlo de lugar.'}
        </p>

        <div className="lineup-body">
          <div>
            <div className="pitch">
              <div className="pitch-box top" />
              <div className="pitch-box bottom" />
              {tokens.map(({ player, x, y }) => (
                <button
                  key={player.id}
                  type="button"
                  className={
                    'token' + (selected?.id === player.id ? ' selected' : '') + (canSwap(player) ? ' target' : '')
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
                  <div className="token-name">{nameParts(player).last}</div>
                </button>
              ))}
            </div>
            <p className="hint center">El número es la valoración actual.</p>
          </div>

          <div ref={cardRef}>
            <PlayerCard
              player={selected}
              club={club}
              swapMode={swapMode}
              onToggleSwap={toggleSwap}
              onClose={closeCard}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Plantilla completa</h2>
        <p className="hint">
          Los titulares con potencial alto pueden subir hasta 4 puntos por temporada y los suplentes hasta 3. Un joven
          que se queda en el banco se retrasa y llega a su pico más tarde.
        </p>
        <div className="tabs">
          {TABS.map((t) => {
            const count = t.id === 'TODOS' ? squad.length : squad.filter((p) => p.pos === t.id).length
            return (
              <button
                key={t.id}
                type="button"
                className={'tab' + (tab === t.id ? ' active' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label} ({count})
              </button>
            )
          })}
        </div>
        <div className="table-scroll">
          <table className="data-table squad-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th className="num">Potencial</th>
                <th>Fase</th>
                <th>Rol</th>
                <th className="num">Jornadas de titular</th>
                <th className="num">Último año</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const phase = PHASES[phaseOf(p)]
                const slow = phaseOf(p) === 'crece' && !p.starter
                const isSelected = selected?.id === p.id
                const isTarget = canSwap(p)
                return (
                  <tr
                    key={p.id}
                    className={(isSelected ? 'row-selected' : '') + (isTarget ? ' row-target' : '')}
                    onClick={() => handlePick(p, true)}
                  >
                    <td>
                      <span className="pos">{p.pos}</span>
                    </td>
                    <td>
                      {p.name}
                      {p.nat ? <span className="nat-code"> {p.nat}</span> : null}
                    </td>
                    <td className="num">{p.age}</td>
                    <td className="num">{p.rating}</td>
                    <td className="num">
                      <strong>{potentialLabel(p)}</strong>
                    </td>
                    <td className={phase.cls}>{slow ? '↗ Crece despacio' : phase.label}</td>
                    <td>{p.starter ? 'Titular' : 'Suplente'}</td>
                    <td className="num">{p.starts ?? 0}</td>
                    <td className={'num ' + gainClass(p.lastGain)}>{gainLabel(p.lastGain)}</td>
                    <td className="num">
                      {isTarget ? (
                        <button type="button" className="mini-btn">
                          Intercambiar
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

import { useRef, useState } from 'react'
import type { Club } from './types'
import type { LeagueState } from './engine'
import { getUserSquad, getUserTeam } from './engine'
import type { SimPlayer } from './players'
import { nameParts } from './players'
import { deltaClass, deltaText } from './playerView'
import PlayerCard from './PlayerCard'
import PlayerFace from './PlayerFace'
import PitchBackground from './PitchBackground'
import SwapPicker from './SwapPicker'
import SquadPanel from './SquadPanel'
import ErrorBoundary from './ErrorBoundary'
import type { PosTab } from './SquadPanel'
import type { Position } from './sample'
import { FORMATION, POSITION_ORDER, pickStarters, squadStrength } from './squads'
import PageHead from './PageHead'
import { auraOf } from './aura'

const PITCH_Y: Record<Position, number> = { POR: 90, DEF: 71, MED: 47, DEL: 13 }

function xPositions(n: number): number[] {
  if (n === 1) return [50]
  return Array.from({ length: n }, (_, i) => 12 + (76 * i) / (n - 1))
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
  const [tab, setTab] = useState<PosTab>('TODOS')
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
    if (fromTable && !window.matchMedia('(max-width: 800px)').matches) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  function closeCard() {
    setSelectedId(null)
    setSwapMode(false)
  }

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
            ? `Elige con quién cambiar a ${selected.name}: toca una tarjeta del panel o un jugador resaltado en verde. Puedes cancelar.`
            : 'Toca un jugador del campo o de la plantilla para ver su ficha. Desde ahí puedes cambiarlo de lugar.'}
        </p>

        <div className="lineup-body">
          <div>
            <div className="pitch pitch-anime">
              <PitchBackground />
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
                  <div className="token-badge">
                    <PlayerFace player={player} />
                    <span
                      className="token-val"
                      style={{ background: 'rgba(10, 18, 36, 0.92)', color: auraOf(player.rating).color, borderColor: auraOf(player.rating).color }}
                    >
                      {player.rating}
                    </span>
                  </div>
                  {deltaText(player.lastGain) && (
                    <span className={'token-delta ' + deltaClass(player.lastGain)}>{deltaText(player.lastGain)}</span>
                  )}
                  <div className="token-name">{nameParts(player).last}</div>
                </button>
              ))}
            </div>
            <p className="hint center">
              El número es la valoración actual. El +/− muestra lo que cambió en la última temporada.
            </p>
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

          {swapMode && selected && (
            <SwapPicker
              selected={selected}
              candidates={squad.filter(canSwap)}
              onPick={(p) => handlePick(p)}
              onCancel={() => setSwapMode(false)}
            />
          )}

          <ErrorBoundary name="la plantilla" fallback={<p className="hint">No se pudo mostrar la plantilla completa.</p>}>
          <SquadPanel
            squad={squad}
            selectedId={selected?.id}
            swapMode={swapMode}
            tab={tab}
            onTab={setTab}
            canSwap={canSwap}
            onPick={handlePick}
          />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

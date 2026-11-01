import './squad.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SimPlayer } from './players'
import { nameParts, potentialLabel, potentialRange } from './players'
import type { Position } from './sample'
import { deltaClass, deltaText } from './playerView'
import { auraOf, inkOn } from './aura'
import PlayerFace from './PlayerFace'
import PlayerChip from './PlayerChip'

export type PosTab = Position | 'TODOS'
type SortKey = 'val' | 'ageAsc' | 'ageDesc' | 'pot'
type View = 'cards' | 'list'

const TABS: { id: PosTab; label: string; long: string }[] = [
  { id: 'TODOS', label: 'Todos', long: 'Todos' },
  { id: 'POR', label: 'POR', long: 'Porteros' },
  { id: 'DEF', label: 'DEF', long: 'Defensas' },
  { id: 'MED', label: 'MED', long: 'Medios' },
  { id: 'DEL', label: 'DEL', long: 'Delanteros' },
]

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'val', label: 'Val (mayor a menor)' },
  { id: 'pot', label: 'Potencial (mayor a menor)' },
  { id: 'ageAsc', label: 'Edad (más jóvenes)' },
  { id: 'ageDesc', label: 'Edad (más veteranos)' },
]

// Carga progresiva: cuántas tarjetas / filas se dibujan de golpe (cada retrato es un canvas)
const BATCH_CARDS = 12
const BATCH_LIST = 30

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches

function potMid(p: SimPlayer): number {
  const [lo, hi] = potentialRange(p)
  return (lo + hi) / 2
}

export function sortSquad(list: SimPlayer[], key: SortKey): SimPlayer[] {
  const byVal = (a: SimPlayer, b: SimPlayer) => b.rating - a.rating
  const out = [...list]
  switch (key) {
    case 'val':
      return out.sort(byVal)
    case 'pot':
      return out.sort((a, b) => potMid(b) - potMid(a) || byVal(a, b))
    case 'ageAsc':
      return out.sort((a, b) => a.age - b.age || byVal(a, b))
    case 'ageDesc':
      return out.sort((a, b) => b.age - a.age || byVal(a, b))
  }
}

interface Props {
  squad: SimPlayer[]
  selectedId?: string
  swapMode: boolean
  tab: PosTab
  onTab: (t: PosTab) => void
  canSwap: (p: SimPlayer) => boolean
  onPick: (p: SimPlayer, fromTable?: boolean) => void
}

interface CardProps {
  p: SimPlayer
  selected: boolean
  target: boolean
  showPot: boolean
  onPick: () => void
}

// Tarjeta grande: retrato con aura, Val destacado (color del tramo), posición, edad y nombre. Al tocar abre la ficha.
function SquadCard({ p, selected, target, showPot, onPick }: CardProps) {
  const { first, last } = nameParts(p)
  const aura = auraOf(p.rating)
  const delta = deltaText(p.lastGain)
  const style = { '--val-bg': aura.color, '--val-ink': inkOn(aura.color) } as CSSProperties
  return (
    <button
      type="button"
      className={'sq-card' + (selected ? ' selected' : '') + (target ? ' target' : '')}
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`${p.name}, ${p.pos}, ${p.age} años, valoración ${p.rating}${p.starter ? ', titular' : ', suplente'}`}
    >
      <span className="sq-photo">
        <PlayerFace player={p} shape="card" res={128} />
        <span className="sq-val" style={style}>
          {p.rating}
        </span>
        <span className="sq-pos">{p.pos}</span>
        {delta && <span className={'sq-delta ' + deltaClass(p.lastGain)}>{delta}</span>}
        {target && <span className="sq-swap">Cambiar</span>}
      </span>
      <span className="sq-name">
        {first && last ? <small>{first}</small> : null}
        <strong>{last || first}</strong>
      </span>
      <span className="sq-meta">
        {p.age} años · {p.starter ? 'Titular' : 'Suplente'}
      </span>
      {showPot && <span className="sq-pot">Pot. {potentialLabel(p)}</span>}
    </button>
  )
}

export default function SquadPanel({ squad, selectedId, swapMode, tab, onTab, canSwap, onPick }: Props) {
  const [view, setView] = useState<View>(() => (isPhone() ? 'cards' : 'list'))
  const [sort, setSort] = useState<SortKey>('val')
  const batch = view === 'cards' ? BATCH_CARDS : BATCH_LIST
  const [limit, setLimit] = useState(batch)
  const sentinel = useRef<HTMLDivElement>(null)

  const shown = useMemo(() => {
    const base = tab === 'TODOS' ? squad : squad.filter((p) => p.pos === tab)
    return sortSquad(base, sort)
  }, [squad, tab, sort])

  // Al cambiar filtro, orden o vista, se vuelve a empezar con el primer lote
  useEffect(() => setLimit(batch), [tab, sort, view, batch])

  const visible = shown.slice(0, limit)
  const more = shown.length - visible.length

  // Carga progresiva: cuando llegas al final, se dibujan más (sin botón; el botón queda como respaldo)
  useEffect(() => {
    const el = sentinel.current
    if (!el || more <= 0 || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setLimit((n) => n + batch),
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [more, batch, visible.length])

  return (
    <div className="squad-panel">
      <h3>Plantilla completa</h3>

      <div className="sq-tools">
        <div className="sq-chips" role="group" aria-label="Filtrar por posición">
          {TABS.map((t) => {
            const count = t.id === 'TODOS' ? squad.length : squad.filter((p) => p.pos === t.id).length
            return (
              <button
                key={t.id}
                type="button"
                className={'sq-chip' + (tab === t.id ? ' active' : '')}
                aria-pressed={tab === t.id}
                title={t.long}
                onClick={() => onTab(t.id)}
              >
                {t.label} <span className="sq-count">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="sq-row2">
          <label className="sq-sort">
            <span>Ordenar</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sq-toggle" role="group" aria-label="Tipo de vista">
            <button type="button" className={view === 'cards' ? 'active' : ''} aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
              ▦ Tarjetas
            </button>
            <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>
              ☰ Lista
            </button>
          </div>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="sq-grid">
          {visible.map((p) => (
            <SquadCard
              key={p.id}
              p={p}
              selected={selectedId === p.id}
              target={canSwap(p)}
              showPot={sort === 'pot'}
              onPick={() => onPick(p, true)}
            />
          ))}
        </div>
      ) : (
        <div className="squad-scroll">
          <table className="data-table squad-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th className="num">Potencial</th>
                <th>Rol</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const isSelected = selectedId === p.id
                const isTarget = canSwap(p)
                const aura = auraOf(p.rating)
                return (
                  <tr
                    key={p.id}
                    className={(isSelected ? 'row-selected' : '') + (isTarget ? ' row-target' : '')}
                    onClick={() => onPick(p, true)}
                  >
                    <td>
                      <span className="pos">{p.pos}</span>
                    </td>
                    <td>
                      <span className="name-cell">
                        <PlayerChip player={p} />
                        <span>
                          {p.name}
                          {p.nat ? <span className="nat-code"> {p.nat}</span> : null}
                        </span>
                      </span>
                    </td>
                    <td className="num">{p.age}</td>
                    <td className="num">
                      <strong className="val-num" style={{ color: aura.color }}>
                        {p.rating}
                      </strong>
                      {deltaText(p.lastGain) && <span className={deltaClass(p.lastGain)}>{deltaText(p.lastGain)}</span>}
                    </td>
                    <td className="num">
                      <strong>{potentialLabel(p)}</strong>
                    </td>
                    <td>{p.starter ? 'Titular' : 'Suplente'}</td>
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
      )}

      {more > 0 && (
        <div ref={sentinel} className="sq-more">
          <button type="button" className="btn secondary" onClick={() => setLimit((n) => n + batch)}>
            Mostrar más ({more})
          </button>
        </div>
      )}
      {shown.length === 0 && <p className="hint">No hay jugadores en esta posición.</p>}
      {swapMode && <p className="hint">Toca un jugador resaltado en verde para hacer el cambio.</p>}

      <p className="hint">
        Los titulares pueden subir hasta 4 puntos por temporada (hasta 5 si su potencial es alto) y los suplentes hasta 3.
        Un joven que se queda en el banco se retrasa y llega a su pico más tarde. Fase, jornadas de titular y último año
        están en la ficha del jugador.
      </p>
    </div>
  )
}

import './vitrina.css'
import type { Legacy } from './legacy'
import type { EuropeId } from './europe'
import { europeInfo } from './europe'
import { COPA, SUPERCOPA } from './domestic'
import { activeLeague } from './activeLeague'
import { BALON } from './balonDeOro'
import TrophyImg from './TrophyImg'
import { aspectOf } from './trophyAspect'
import type { TrophyId } from './trophyAspect'

/* ==========================================================================
   Vitrina de trofeos del Palmarés.
   Cada título ganado añade un trofeo a su repisa y se ven todos: cuantos más hay,
   más se montan unos sobre otros (como un abanico), hasta llenar el hueco. Debajo
   va el número grande con la cantidad ganada. Lo que aún no se ganó aparece como
   una sombra, para que se vea qué falta por conseguir.
   ========================================================================== */

interface Slot {
  id: TrophyId
  name: string
  count: number
  note?: string
  unit?: [string, string] // cómo se llama cada pieza (por defecto: título / títulos)
  winners?: { name: string; season: number }[] // quién ganó cada pieza y en qué temporada (se ve bajo el trofeo)
}

interface Shelf {
  title: string
  slots: Slot[]
}

const MAX_WINNERS = 6 // ganadores que se listan bajo un trofeo individual (los más recientes)
const MAX_HEIGHT = 124 // alto de un trofeo solo
const ROOM = 250 // ancho disponible por hueco (los trofeos se reducen para caber)
const OVERLAP = 0.4 // parte del ancho que tapa el trofeo siguiente cuando hay pocos
const SPREAD_FROM = 5 // hasta este número de trofeos en una fila se dibujan enteros; con más se montan unos sobre otros
const MIN_STEP = 2 // separación mínima (px) entre un trofeo y el siguiente dentro de una fila
const ROW_MAX = 10 // trofeos por fila: con más, se forma otra fila por detrás, un poco más arriba
const MAX_ROWS = 4 // filas de profundidad
const MAX_PIECES = ROW_MAX * MAX_ROWS // tope de trofeos dibujados (con tantos ya se ve el montón completo; el número de abajo es el real)
const RISE = 11 // cuánto sube cada fila de atrás (px)

// Alto de cada trofeo para que los apilados quepan en el hueco (hasta SPREAD_FROM; con más, el alto ya no baja)
function trophyHeight(id: TrophyId, shown: number): number {
  const n = Math.max(1, Math.min(shown, SPREAD_FROM))
  const widthUnits = aspectOf(id) * (1 + (1 - OVERLAP) * (n - 1))
  return Math.max(48, Math.min(MAX_HEIGHT, Math.floor(ROOM / widthUnits)))
}

// Separación entre trofeos: la normal con pocos; con muchos se cierra para que todos quepan en el hueco
function trophyStep(w: number, shown: number): number {
  const normal = Math.round(w * (1 - OVERLAP))
  if (shown <= SPREAD_FROM) return normal
  return Math.max(MIN_STEP, Math.min(normal, (ROOM - w) / (shown - 1)))
}

function buildShelves(l: Legacy): Shelf[] {
  const eu = (id: EuropeId): Slot => ({ id, name: europeInfo(id).name, count: l.euroTitles[id] ?? 0 })
  const copaLost = Math.max(0, l.copaFinals - l.copaTitles)
  return [
    { title: 'Europa', slots: [eu('champions'), eu('europa'), eu('conferencia')] },
    {
      title: activeLeague().name,
      slots: [
        { id: 'liga', name: activeLeague().id === 'esp' ? 'Liga · 1.ª división' : `${activeLeague().leagueTitle} · 1.ª división`, count: l.leagueTitles },
        {
          id: 'copa',
          name: COPA.name,
          count: l.copaTitles,
          note: copaLost > 0 ? `${copaLost} ${copaLost === 1 ? 'final perdida' : 'finales perdidas'}` : undefined,
        },
        { id: 'supercopa', name: SUPERCOPA.name, count: l.supercopaTitles },
      ],
    },
    {
      title: 'Premios individuales',
      slots: [
        {
          id: 'balon',
          name: BALON.name,
          count: l.balonWins.length,
          unit: ['premio', 'premios'],
          winners: l.balonWins.map((w) => ({ name: w.name, season: w.season })),
        },
      ],
    },
  ]
}

function titlesText(n: number, unit: [string, string] = ['título', 'títulos']): string {
  if (n === 0) return 'Sin ganar'
  return n === 1 ? `1 ${unit[0]}` : `${n} ${unit[1]}`
}

function SlotView({ slot }: { slot: Slot }) {
  const shown = Math.min(slot.count, MAX_PIECES)
  const rowCount = Math.max(1, Math.min(MAX_ROWS, Math.ceil(shown / ROW_MAX)))
  const perRow = Math.ceil(shown / rowCount)
  const h = trophyHeight(slot.id, perRow)
  const w = Math.round(h * aspectOf(slot.id))
  const step = trophyStep(w, perRow)
  // Fila 0 = la de delante (la más baja); las demás van detrás, más arriba y algo más oscuras
  const rows = Array.from({ length: rowCount }, (_, r) => Math.max(0, Math.min(perRow, shown - r * perRow)))

  return (
    <div className="vt-slot" data-won={slot.count > 0}>
      <div className="vt-stage">
        {slot.count === 0 ? (
          <span className="vt-piece vt-ghost">
            <TrophyImg id={slot.id} height={MAX_HEIGHT} />
          </span>
        ) : (
          rows.map((n, r) => (
            <div
              key={r}
              className="vt-rowbox"
              data-back={r > 0}
              style={{ zIndex: MAX_ROWS - r, transform: `translate(${r % 2 === 1 ? Math.round(step / 2) : 0}px, ${-r * RISE}px)` }}
            >
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className="vt-piece" style={{ marginLeft: i === 0 ? 0 : step - w, zIndex: i + 1 }}>
                  <TrophyImg id={slot.id} height={h} label={r === 0 && i === 0 ? `${slot.name}: ${titlesText(slot.count, slot.unit)}` : ''} />
                </span>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="vt-plate">
        <strong>{slot.name}</strong>
        {slot.count > 0 ? (
          <div className="vt-total" aria-hidden="true">
            <b>{slot.count}</b>
            <small>{slot.count === 1 ? (slot.unit ?? ['título', 'títulos'])[0] : (slot.unit ?? ['título', 'títulos'])[1]}</small>
          </div>
        ) : (
          <span>{titlesText(0, slot.unit)}</span>
        )}
        {slot.note && <em>{slot.note}</em>}
        {slot.winners && slot.winners.length > 0 && (
          <ul className="vt-winners">
            {[...slot.winners].reverse().slice(0, MAX_WINNERS).map((w) => (
              <li key={w.season}>
                <b>{w.name}</b>
                <i>Temporada {w.season}</i>
              </li>
            ))}
            {slot.winners.length > MAX_WINNERS && <li className="vt-winners-more">y {slot.winners.length - MAX_WINNERS} más</li>}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function Vitrina({ legacy }: { legacy: Legacy }) {
  const shelves = buildShelves(legacy)
  return (
    <div className="vt-case">
      <div className="vt-glass">
        {shelves.map((shelf) => (
          <div className="vt-shelf" key={shelf.title}>
            <div className="vt-shelf-title">{shelf.title}</div>
            <div className="vt-row">
              {shelf.slots.map((slot) => (
                <SlotView key={slot.id} slot={slot} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="vt-extra">
        <span>
          Ligas de 2.ª división: <strong>{legacy.secondTitles}</strong>
        </span>
        {legacy.euroFinals > 0 && (
          <span>
            Finales europeas jugadas: <strong>{legacy.euroFinals}</strong>
          </span>
        )}
      </div>
    </div>
  )
}

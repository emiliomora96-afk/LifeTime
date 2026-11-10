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
   Cada título ganado añade un trofeo a su repisa. Hasta MAX_SHOWN se ven
   apilados; a partir de ahí se muestra la etiqueta ×N. Lo que aún no se ganó
   aparece como una sombra, para que se vea qué falta por conseguir.
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

const MAX_SHOWN = 5 // trofeos que se dibujan por hueco
const MAX_WINNERS = 6 // ganadores que se listan bajo un trofeo individual (los más recientes)
const MAX_HEIGHT = 124 // alto de un trofeo solo
const ROOM = 250 // ancho disponible por hueco (los trofeos se reducen para caber)
const OVERLAP = 0.4 // parte del ancho que tapa el trofeo siguiente

// Alto de cada trofeo para que los apilados quepan en el hueco
function trophyHeight(id: TrophyId, shown: number): number {
  const n = Math.max(1, shown)
  const widthUnits = aspectOf(id) * (1 + (1 - OVERLAP) * (n - 1))
  return Math.max(48, Math.min(MAX_HEIGHT, Math.floor(ROOM / widthUnits)))
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
  const shown = Math.min(slot.count, MAX_SHOWN)
  const h = trophyHeight(slot.id, shown)
  const w = Math.round(h * aspectOf(slot.id))
  const step = Math.round(w * (1 - OVERLAP))

  return (
    <div className="vt-slot" data-won={slot.count > 0}>
      <div className="vt-stage">
        {slot.count === 0 ? (
          <span className="vt-piece vt-ghost">
            <TrophyImg id={slot.id} height={MAX_HEIGHT} />
          </span>
        ) : (
          Array.from({ length: shown }, (_, i) => (
            <span key={i} className="vt-piece" style={{ marginLeft: i === 0 ? 0 : step - w, zIndex: i + 1 }}>
              <TrophyImg id={slot.id} height={h} label={i === 0 ? `${slot.name}: ${titlesText(slot.count, slot.unit)}` : ''} />
            </span>
          ))
        )}
        {slot.count > MAX_SHOWN && <span className="vt-more">×{slot.count}</span>}
      </div>
      <div className="vt-plate">
        <strong>{slot.name}</strong>
        <span>{titlesText(slot.count, slot.unit)}</span>
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

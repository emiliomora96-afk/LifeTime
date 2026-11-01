import './domestic.css'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Club } from './types'
import type { SeasonRecord } from './game'
import { formatMoney } from './data'
import {
  COPA,
  COPA_ROUNDS,
  REACH_TEXT,
  SUPERCOPA,
  cupIncome,
  entrantMap,
  entrantName,
  userCopaRecord,
  userSupercopaRecord,
  userTies,
} from './domestic'
import type { CupEntrant, CupRecord, CupTie, CupTournament, DomesticSeason } from './domestic'
import { europeInfo } from './europe'
import { activeLeague } from './activeLeague'
import TrophyImg, { preloadTrophy } from './TrophyImg'
import type { TrophyId } from './trophyAspect'

/* ---------- Animación de copas ganadas ---------- */
interface Trophy {
  id: TrophyId
  name: string
}

// Los títulos que ganó tu club esa temporada, en el orden en que se muestran:
// Liga (1.ª división), Copa del Rey, Supercopa de España y el torneo europeo
export function seasonTrophies(record: Pick<SeasonRecord, 'champion' | 'division' | 'copa' | 'supercopa' | 'euro'>): Trophy[] {
  const list: Trophy[] = []
  if (record.champion && record.division === 1) list.push({ id: 'liga', name: activeLeague().leagueTitle })
  if (record.copa?.champion) list.push({ id: 'copa', name: COPA.name })
  if (record.supercopa?.champion) list.push({ id: 'supercopa', name: SUPERCOPA.name })
  if (record.euro?.champion) list.push({ id: record.euro.comp, name: europeInfo(record.euro.comp).name })
  return list
}

const SECONDS_PER_TROPHY = 1000

interface ShowProps {
  trophies: Trophy[]
  season: number
  onDone: () => void // al terminar (o al tocar la pantalla) se pasa a la temporada siguiente
}

// Cada título ganado ocupa la pantalla 1 segundo, uno detrás de otro. Un toque la salta.
export function CupTrophyShow({ trophies, season, onDone }: ShowProps) {
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const current = trophies[index]
  const currentId = current?.id

  // La animación de cada trofeo empieza cuando su imagen ya está cargada (con un máximo de espera)
  useEffect(() => {
    if (!currentId) return
    let alive = true
    setReady(false)
    const fallback = window.setTimeout(() => alive && setReady(true), 2500)
    preloadTrophy(currentId).then(() => {
      if (!alive) return
      window.clearTimeout(fallback)
      setReady(true)
    })
    return () => {
      alive = false
      window.clearTimeout(fallback)
    }
  }, [index, currentId])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      if (index + 1 >= trophies.length) onDone()
      else setIndex(index + 1)
    }, SECONDS_PER_TROPHY)
    return () => window.clearTimeout(timer)
    // onDone cambia en cada render pero solo debe dispararse una vez, al acabar el último trofeo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, ready])

  if (!current) return null

  // Se pinta en el body: así ningún contenedor de la página puede recortarlo ni moverlo
  return createPortal(
    <div className="cup-show" onClick={onDone} role="dialog" aria-label={`Título: ${current.name}`}>
      {ready && (
        <div className="cup-show-item" key={`${index}:${current.id}`} data-cup={current.id}>
          <div className="cup-show-trophy">
            <TrophyImg id={current.id} height={230} label={current.name} />
          </div>
          <div className="cup-show-name">{current.name}</div>
          <div className="cup-show-sub">¡Campeón! · Temporada {season}</div>
        </div>
      )}
    </div>,
    document.body,
  )
}

/* ---------- Resumen de las copas ---------- */
function score(tie: CupTie): string {
  return `${tie.hg}-${tie.ag}${tie.pk ? ` (pen. ${tie.pk[0]}-${tie.pk[1]})` : tie.et ? ' (prórroga)' : ''}`
}

function TieRow({ tie, map, club, label }: { tie: CupTie; map: Map<string, CupEntrant>; club: Club; label: string }) {
  const home = map.get(tie.home)
  const away = map.get(tie.away)
  if (!home || !away) return null
  const won = tie.winner === 'user'
  return (
    <li className="dc-tie">
      <span className="dc-round">{label}</span>
      <span className="dc-match">
        <span className={home.user ? 'dc-me' : ''}>{entrantName(home, club.name)}</span> {score(tie)}{' '}
        <span className={away.user ? 'dc-me' : ''}>{entrantName(away, club.name)}</span>
      </span>
      <span className={'dc-result ' + (won ? 'win' : 'loss')}>{won ? (tie.round === 'final' ? 'Campeón' : 'Pasas') : 'Eliminado'}</span>
    </li>
  )
}

function statusText(record: CupRecord | null, hideTitles = false): string {
  if (!record) return 'No participa'
  if (hideTitles && record.reach === 'final') return 'Llegó a la final'
  return REACH_TEXT[record.reach]
}

interface CardProps {
  club: Club
  domestic: DomesticSeason
  division: 1 | 2
  // En el cierre no se revela si ganaste: los títulos salen de sorpresa al empezar la temporada
  hideTitles?: boolean
}

export function DomesticSummaryCard({ club, domestic, division, hideTitles = false }: CardProps) {
  const copaRec = userCopaRecord(domestic)
  const superRec = userSupercopaRecord(domestic)
  const copaMap = entrantMap(domestic.copa)
  const superMap = entrantMap(domestic.supercopa)
  const income = hideTitles ? [] : cupIncome(domestic, division)
  // Las finales no se muestran en el cierre: ganarlas o perderlas se sabría por el marcador
  const shownTies = (t: CupTournament) => userTies(t).filter((x) => !(hideTitles && x.round === 'final'))
  const roundLabel = (round: string) => COPA_ROUNDS.find((r) => r.id === round)?.label ?? ''
  const winnerOf = (t: CupTournament, map: Map<string, CupEntrant>) => {
    const e = map.get(t.champion)
    return e ? entrantName(e, club.name) : '—'
  }

  return (
    <div className="card">
      <h2>Copas nacionales</h2>

      <div className="dc-head">
        <strong>
          {COPA.icon} {COPA.name}
        </strong>
        <span className={'dc-badge' + (hideTitles ? '' : copaRec?.champion ? ' gold' : copaRec?.reach === 'final' ? ' silver' : '')}>
          {statusText(copaRec, hideTitles)}
        </span>
      </div>
      {!hideTitles && (
        <p className="hint dc-line">
          Campeón: <strong>{winnerOf(domestic.copa, copaMap)}</strong>
        </p>
      )}
      <ul className="dc-ties">
        {shownTies(domestic.copa).map((t) => (
          <TieRow key={t.round} tie={t} map={copaMap} club={club} label={roundLabel(t.round)} />
        ))}
      </ul>

      <div className="dc-head dc-gap">
        <strong>
          {SUPERCOPA.icon} {SUPERCOPA.name}
        </strong>
        <span className={'dc-badge' + (hideTitles ? '' : superRec?.champion ? ' gold' : superRec?.reach === 'final' ? ' silver' : '')}>
          {superRec ? statusText(superRec, hideTitles) : 'No clasificado'}
        </span>
      </div>
      {!hideTitles && (
        <p className="hint dc-line">
          Campeón: <strong>{winnerOf(domestic.supercopa, superMap)}</strong>
        </p>
      )}
      <ul className="plain-list dc-list">
        {domestic.supercopa.entrants.map((e) => (
          <li key={e.id}>
            <span className={e.user ? 'dc-me' : ''}>{entrantName(e, club.name)}</span>
            <span className="hint dc-reason">{domestic.supercopa.reasons[e.id]}</span>
          </li>
        ))}
      </ul>
      {superRec && (
        <ul className="dc-ties">
          {shownTies(domestic.supercopa).map((t) => (
            <TieRow key={t.round} tie={t} map={superMap} club={club} label={t.round === 'final' ? 'Final' : 'Semifinal'} />
          ))}
        </ul>
      )}
      {!superRec && (
        <p className="hint">
          {activeLeague().superFormat === 'four'
            ? 'La juegan los dos primeros de Liga y los dos finalistas de Copa. Si un club repite, entra el siguiente de la Liga.'
            : 'Un solo partido entre el campeón de Liga y el campeón de Copa. Si es el mismo club, juega contra el ' +
              (activeLeague().superDouble === 'cupFinalist' ? 'finalista de Copa.' : 'subcampeón de Liga.')}
        </p>
      )}

      {income.length > 0 && (
        <ul className="plain-list dc-money">
          {income.map((line) => (
            <li key={line.label}>
              <span>{line.label}</span>
              <strong className="dc-income">+{formatMoney(line.amount)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Líneas cortas para el resumen que se ve al empezar la temporada siguiente
export function CupSeasonLines({ record }: { record: SeasonRecord }) {
  if (!record.copa && !record.supercopa) return null
  return (
    <ul className="plain-list dc-list">
      {record.copa && (
        <li>
          <span>
            {COPA.icon} {COPA.name}
          </span>
          <strong>
            {record.copa.champion ? '🏆 ' : ''}
            {REACH_TEXT[record.copa.reach]}
          </strong>
        </li>
      )}
      {record.supercopa && (
        <li>
          <span>
            {SUPERCOPA.icon} {SUPERCOPA.name}
          </span>
          <strong>
            {record.supercopa.champion ? '🏆 ' : ''}
            {REACH_TEXT[record.supercopa.reach]}
          </strong>
        </li>
      )}
    </ul>
  )
}

import { useState } from 'react'
import type { Club } from './types'
import { BASE_STOPS, EVENT_STOPS, ROUNDS_PER_SEASON } from './config'
import type { Notice, NoticeOption } from './config'
import type { GameState } from './game'
import type { Tactic } from './engine'
import { getUserSquad, userSeasonResult } from './engine'
import type { SimPlayer } from './players'
import { EUROPE, QUALIFIED_POSITIONS, SUPERCUP, europeInfo, homeQualifiers, userQualification } from './europe'
import { formatMoney } from './data'
import { seasonExpenses, seasonIncome, total } from './finance'
import type { Line } from './finance'
import PageHead from './PageHead'
import TacticPanel from './TacticPanel'
import type { SectionId } from './sections'
import TournamentScreen, { TournamentSummaryCard } from './TournamentScreen'
import { euroRecord, userParticipates } from './tournament'
import ChampionsScreen, { ChampionsSummaryCard, ChampionsWinterCard } from './ChampionsScreen'
import { clRecord, clUser, clUserQualified } from './champions'
import { COPA, SUPERCOPA, userCopaRecord, userSupercopaRecord } from './domestic'
import { europeFinalIncome } from './euroIncome'
import { CupSeasonLines, CupTrophyShow, DomesticSummaryCard, seasonTrophies } from './DomesticCups'
import TrophyImg from './TrophyImg'
import NoticePlayer from './NoticePlayer'
import MiniBoard from './MiniBoard'
import ActionBar from './ActionBar'
import ErrorBoundary from './ErrorBoundary'

// En el cierre los premios de liga y copas van en una sola línea: así el balance no delata si ganaste algún título
// (los nombres de las copas dependen de la liga de la partida, por eso se arman al usarlos)
const prizeLabels = () => ['Premio por posición', 'Premio por título de liga', `${COPA.name}: premios`, SUPERCOPA.name]
function groupPrizes(lines: Line[]): Line[] {
  const PRIZE_LABELS = prizeLabels()
  const prizes = lines.filter((l) => PRIZE_LABELS.includes(l.label))
  const rest = lines.filter((l) => !PRIZE_LABELS.includes(l.label))
  const first = lines.findIndex((l) => PRIZE_LABELS.includes(l.label))
  if (prizes.length === 0) return lines
  const merged: Line = { label: 'Premios de liga y copas', amount: total(prizes) }
  const before = lines.slice(0, first).filter((l) => !PRIZE_LABELS.includes(l.label))
  return [...before, merged, ...rest.slice(before.length)]
}

// Jugador del que trata un aviso. Los avisos nuevos lo traen guardado; los de partidas ya guardadas
// se reconstruyen: por las opciones (ojeadores, venta, salida) o por el id del aviso (lesión, contrato).
function noticePlayerOf(notice: Notice, squad: SimPlayer[]): SimPlayer | undefined {
  if (notice.player) return notice.player
  const scouted = notice.options.find((o) => o.addPlayer)?.addPlayer
  if (scouted) return scouted
  const ids = notice.options.map((o) => o.removePlayerId ?? o.leaveAtEndId).filter((x): x is string => !!x)
  return squad.find((p) => ids.includes(p.id) || notice.id.endsWith('-' + p.id))
}

// La táctica está oculta por ahora: el club siempre juega 'equilibrada' (ver handleContinue en App.tsx).
// Para volver a mostrar el panel, cambia esto a true.
const SHOW_TACTIC = false

// Temporadas cuyos títulos ya se celebraron (una vez por temporada y partida)
const celebrated = new Set<string>()

interface Props {
  club: Club
  game: GameState
  onAnswer: (notice: Notice, option: NoticeOption) => void
  onContinue: () => void
  onTactic: (tactic: Tactic) => void
  onGoTo?: (id: SectionId) => void
}

export default function StopScreen({ club, game, onAnswer, onContinue, onTactic, onGoTo }: Props) {
  const [, setCelebrated] = useState(0) // solo fuerza el repintado cuando termina la animación
  const baseIndex = BASE_STOPS.findIndex((s) => s.id === game.baseStop)
  const base = BASE_STOPS[baseIndex] ?? BASE_STOPS[0]
  const event = game.eventId ? EVENT_STOPS.find((e) => e.id === game.eventId) : undefined
  const nextBase = BASE_STOPS[baseIndex + 1]

  // Lifetime Champions League, parada de inicio: la fase de liga completa (solo si tu club participa)
  const cl = game.champions && game.champions.season === game.season ? game.champions : null
  if (event?.id === 'champions-liga') {
    if (cl && clUser(cl)) {
      return <ChampionsScreen club={club} state={cl} phase="liga" history={game.history} onFinish={onContinue} />
    }
    return (
      <div className="page">
        <PageHead icon={event.icon} title={`${event.name} · Temporada ${game.season}`} subtitle="Esta temporada no hay Champions para tu club." />
        <div className="card continue-card">
          <strong>Sin novedades</strong>
          <button type="button" className="btn inline only-desktop" onClick={onContinue}>
            Continuar →
          </button>
        </div>
        <ActionBar label="Continuar" onClick={onContinue} />
      </div>
    )
  }

  // Paso 9: parada del torneo europeo. El motor ya calculó todo; aquí solo se presenta.
  if (event?.id === 'torneo') {
    const ts = game.tournament
    // Champions, parada final: playoff, octavos, cuartos, semifinales y final (si tu club sigue en la competición)
    if (cl && clUser(cl) && clUserQualified(cl)) {
      return <ChampionsScreen club={club} state={cl} phase="eliminatorias" history={game.history} onFinish={onContinue} />
    }
    if (ts && userParticipates(ts)) {
      return <TournamentScreen club={club} tournament={ts} history={game.history} onFinish={onContinue} />
    }
    return (
      <div className="page">
        <PageHead
          icon={event.icon}
          title={`${event.name} · Temporada ${game.season}`}
          subtitle={ts || cl ? 'Tu club no participa: solo se muestra la final y el campeón.' : 'Esta temporada no hay torneo europeo.'}
        />
        {cl ? (
          <ChampionsSummaryCard club={club} state={cl} />
        ) : ts ? (
          <TournamentSummaryCard club={club} tournament={ts} />
        ) : (
          <div className="card">
            <p>Sin novedades.</p>
          </div>
        )}
        <div className="card continue-card">
          <div>
            <strong>Torneo terminado</strong>
            <p className="hint">Después de esta parada, la temporada sigue su curso.</p>
          </div>
          <button type="button" className="btn inline only-desktop" onClick={onContinue}>
            Continuar →
          </button>
        </div>
        <ActionBar label="Continuar" onClick={onContinue} />
      </div>
    )
  }

  const pendingRequired = game.notices.filter((n) => n.required && game.answers[n.id] === undefined).length

  const income = total(seasonIncome(game))
  const expenses = total(seasonExpenses(game))
  const net = income - expenses

  const isClosing = !event && base.id === 'cierre'
  const result = isClosing ? userSeasonResult(game.league) : null
  const lastSeason = !event && base.id === 'verano' ? game.history[game.history.length - 1] : undefined
  // Copas nacionales: se simularon al llegar al cierre. Al terminar la temporada (ya en la siguiente, o al acabar la carrera) se celebran.
  const domestic = isClosing && game.domestic && game.domestic.season === game.season ? game.domestic : null
  const euroFinal = event?.id === 'gala' ? europeFinalIncome(game) : []
  // Títulos de la temporada: se celebran nada más llegar a la jornada 38, antes de enseñar el cierre
  const closingTrophies =
    isClosing && result
      ? seasonTrophies({
          ...result,
          copa: domestic ? userCopaRecord(domestic) : null,
          supercopa: domestic ? userSupercopaRecord(domestic) : null,
          euro:
            clRecord(game.champions, game.season) ??
            (game.tournament && game.tournament.season === game.season ? euroRecord(game.tournament) : null),
        })
      : []
  const euroPending = isClosing && game.europe?.season === game.season && game.europe.user !== null
  const qualification = isClosing ? userQualification(game.league) : null
  const qualifiers = isClosing ? homeQualifiers(game.league) : null
  const euroNow = !event && base.id === 'verano' && game.europe && game.europe.season === game.season ? game.europe : null
  const euroComp = euroNow?.user ? europeInfo(euroNow.user) : null

  // Mientras suena la animación no se ve nada más: ni el resultado ni las copas
  const showKey = `${game.seed}:${game.season}`
  if (isClosing && closingTrophies.length > 0 && !celebrated.has(showKey)) {
    return (
      <CupTrophyShow
        trophies={closingTrophies}
        season={game.season}
        onDone={() => {
          celebrated.add(showKey)
          setCelebrated((n) => n + 1)
        }}
      />
    )
  }

  let hint: string
  if (pendingRequired > 0) {
    hint = `Faltan ${pendingRequired} decisión${pendingRequired === 1 ? '' : 'es'} obligatoria${pendingRequired === 1 ? '' : 's'} para poder continuar.`
  } else if (event) {
    hint = 'Después de esta parada, la temporada sigue su curso.'
  } else if (nextBase) {
    hint = `Al continuar se simularán las jornadas ${game.round + 1} a ${nextBase.round}.`
  } else {
    hint = 'Al continuar se aplica el balance, se cierran los ascensos y descensos y empieza la temporada siguiente.'
  }

  const continueLabel = event ? 'Continuar' : nextBase ? `Simular jornadas ${game.round + 1}–${nextBase.round}` : 'Cerrar la temporada'

  return (
    <div className="page">
      <PageHead
        icon={event ? event.icon : '🚩'}
        title={`${event ? event.name : base.name} · Temporada ${game.season}`}
        subtitle={event ? event.intro : `${base.when} · ${base.actions}`}
      />

      <div className="badges">
        <span className="badge">{event ? 'Parada por evento' : 'Parada base'}</span>
        <span className="badge">
          Jornada {game.round} / {ROUNDS_PER_SEASON}
        </span>
        <span className="badge">{game.league.userDivision}.ª división</span>
        {!event && <span className="badge">Duración objetivo: {base.duration}</span>}
      </div>

      {!event && !isClosing && !game.finished && (
        <ErrorBoundary name="la pizarra" fallback={null}>
          <MiniBoard club={club} league={game.league} onOpenTable={() => onGoTo?.('tabla')} />
        </ErrorBoundary>
      )}

      {game.finished && (
        <div className="card">
          <h2>Carrera completada</h2>
          <p>Terminaste las 30 temporadas. Tu club ya tiene su legado: títulos, jugadores históricos y un resumen para compartir.</p>
          {onGoTo && (
            <button type="button" className="btn inline" onClick={() => onGoTo('legado')}>
              Ver el legado del club →
            </button>
          )}
        </div>
      )}

      {!event && !game.finished && base.id === 'invierno' && cl && clUser(cl) && <ChampionsWinterCard state={cl} />}

      {euroFinal.length > 0 && (
        <div className="card">
          <h2>Ingresos europeos</h2>
          <ul className="plain-list">
            {euroFinal.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <strong style={{ color: '#22c55e' }}>+{formatMoney(line.amount)}</strong>
              </li>
            ))}
            <li>
              <span>Total cobrado al terminar el torneo</span>
              <strong style={{ color: '#22c55e' }}>+{formatMoney(total(euroFinal))}</strong>
            </li>
          </ul>
          <p className="hint">Ya sumado al presupuesto.</p>
        </div>
      )}

      {lastSeason && (
        <div className="card">
          <h2>Temporada {lastSeason.season}</h2>
          {lastSeason.champion && lastSeason.division === 1 && (
            <div className="trophy-banner">
              <TrophyImg id="liga" size={96} label="Liga de 1.ª división" />
            </div>
          )}
          <p>
            Terminaste {lastSeason.position}.º en la {lastSeason.division}.ª división con {lastSeason.points} puntos.
            {lastSeason.champion && ' ¡Campeón de liga!'}
            {lastSeason.promoted && ' Ascendiste de categoría.'}
            {lastSeason.relegated && ' Descendiste de categoría.'}
          </p>
          <CupSeasonLines record={lastSeason} />
        </div>
      )}

      {result && (
        <div className="card">
          <h2>Resultado de la temporada</h2>
          <ul className="plain-list">
            <li>
              <span>Puntos</span>
              <strong>
                {result.points} en la {result.division}.ª división
              </strong>
            </li>
            {result.promoted && (
              <li>
                <span>Categoría</span>
                <strong className="pill-up">⬆ Ascenso a 1.ª división</strong>
              </li>
            )}
            {result.relegated && (
              <li>
                <span>Categoría</span>
                <strong className="pill-down">⬇ Descenso a 2.ª división</strong>
              </li>
            )}
          </ul>
          <p className="hint">La posición final y los títulos se revelan al empezar la próxima temporada.</p>
        </div>
      )}

      {domestic && <DomesticSummaryCard club={club} domestic={domestic} division={game.league.userDivision} hideTitles />}

      {qualification && qualifiers && (
        <div className="card">
          <h2>Clasificación a Europa</h2>
          <p>
            {qualification.competition ? (
              <>
                <strong>Clasificas a la {europeInfo(qualification.competition).icon}{' '}
                {europeInfo(qualification.competition).name}</strong> de la próxima temporada.
              </>
            ) : qualification.division === 1 ? (
              <>
                No clasificas a Europa. Hay que acabar entre los {QUALIFIED_POSITIONS} primeros.
              </>
            ) : (
              <>
                Estás en 2.ª división. Para jugar en Europa primero hay que subir y acabar entre los {QUALIFIED_POSITIONS} primeros de 1.ª.
              </>
            )}
          </p>
          <ul className="plain-list">
            {EUROPE.map((c) => (
              <li key={c.id}>
                <span>
                  <TrophyImg id={c.id} size={28} /> {c.name}
                </span>
                <strong>{qualifiers[c.id].map((q) => q.name ?? club.name).join(', ')}</strong>
              </li>
            ))}
            <li>
              <span>
                <TrophyImg id="supercup" size={28} /> {SUPERCUP.name}
              </span>
              <strong>Campeones de {SUPERCUP.between.map((id) => europeInfo(id).short).join(' y ')}</strong>
            </li>
          </ul>
        </div>
      )}

      {euroNow && (
        <div className="card">
          <h2>Europa esta temporada</h2>
          {euroComp ? (
            <p>
              Tu club juega la <strong><TrophyImg id={euroComp.id} size={24} /> {euroComp.name}</strong>, con {euroNow.fields[euroComp.id].length} clubes.{' '}
              {euroComp.id === 'champions'
                ? 'La fase de liga se juega al salir de esta parada; el playoff y las eliminatorias, en la parada final de la temporada.'
                : 'El torneo se juega al final de la temporada, partido a partido.'}
            </p>
          ) : (
            <p>Tu club no juega en Europa esta temporada.</p>
          )}
        </div>
      )}

      <h2 className="section-title">Avisos</h2>
      {game.notices.length === 0 ? (
        <div className="card">
          <p>Sin novedades en este tramo.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {game.notices.map((notice) => {
            const chosenId = game.answers[notice.id]
            const locked = chosenId !== undefined
            return (
              <div className="card decision" key={notice.id}>
                <div className="notice-head">
                  <h3>
                    {notice.icon} {notice.title}
                  </h3>
                  <span className={'tag ' + (notice.required ? 'req' : 'opt')}>
                    {notice.required ? 'Requiere decisión' : 'Opcional'}
                  </span>
                </div>
                {(() => {
                  const who = noticePlayerOf(notice, getUserSquad(game.league))
                  return who ? <NoticePlayer player={who} /> : null
                })()}
                <p>{notice.text}</p>
                <div className="options">
                  {notice.options.map((opt) => {
                    const cost = opt.budget ?? 0
                    const noFunds = cost < 0 && club.budget + cost < 0
                    const chosen = chosenId === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={'option' + (chosen ? ' chosen' : '')}
                        disabled={locked || noFunds}
                        onClick={() => onAnswer(notice, opt)}
                      >
                        <div className="option-head">
                          <strong>{opt.label}</strong>
                          {cost !== 0 && (
                            <span className={'cost ' + (cost > 0 ? 'up' : 'down')}>
                              {cost > 0 ? '+' : '−'}
                              {formatMoney(Math.abs(cost))}
                            </span>
                          )}
                        </div>
                        {opt.detail && <span className="hint">{opt.detail}</span>}
                        {noFunds && !locked && <span className="hint">Presupuesto insuficiente</span>}
                      </button>
                    )
                  })}
                </div>
                {locked && <p className="hint">Decisión tomada.</p>}
              </div>
            )
          })}
        </div>
      )}

      {SHOW_TACTIC && !event && (base.id === 'verano' || base.id === 'invierno') && (
        <TacticPanel tactic={game.tactic} onChange={onTactic} />
      )}

      {isClosing && (
        <div className="card">
          <h2>Balance de la temporada</h2>
          <ul className="plain-list">
            {groupPrizes(seasonIncome(game)).map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <strong>{formatMoney(line.amount)}</strong>
              </li>
            ))}
            <li>
              <span>Ingresos totales</span>
              <strong>{formatMoney(income)}</strong>
            </li>
            <li>
              <span>Gastos (salarios e inversiones)</span>
              <strong>{formatMoney(expenses)}</strong>
            </li>
            <li>
              <span>Balance</span>
              <strong style={{ color: net >= 0 ? '#22c55e' : '#ef4444' }}>{formatMoney(net)}</strong>
            </li>
          </ul>
          <p className="hint">
            Se aplica al presupuesto al continuar.
            {euroPending && ' Los premios de las eliminatorias europeas y del título se cobran al terminar el torneo europeo.'}
          </p>
        </div>
      )}

      <div className="card continue-card">
        <div>
          <strong>
            {game.notices.length === 0
              ? 'Todo en orden'
              : `Avisos respondidos: ${Object.keys(game.answers).length} de ${game.notices.length}`}
          </strong>
          <p className="hint">{hint}</p>
        </div>
        <button
          type="button"
          className="btn inline only-desktop"
          disabled={game.finished || pendingRequired > 0}
          onClick={onContinue}
        >
          Continuar →
        </button>
      </div>
      <ActionBar
        label={game.finished ? 'Carrera completada' : pendingRequired > 0 ? `Faltan ${pendingRequired} decisión${pendingRequired === 1 ? '' : 'es'}` : continueLabel}
        note={pendingRequired > 0 ? 'Responde los avisos obligatorios para seguir.' : undefined}
        disabled={game.finished || pendingRequired > 0}
        onClick={onContinue}
      />
    </div>
  )
}

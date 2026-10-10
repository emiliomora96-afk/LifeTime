import type { Club } from './types'
import { BASE_STOPS, EVENT_STOPS, ROUNDS_PER_SEASON } from './config'
import type { InvestArea, Notice, NoticeOption } from './config'
import type { GameState, ScoutOrder } from './game'
import type { Tactic } from './engine'
import { userSeasonResult } from './engine'
import { prestigeChange } from './economy'
import { formatMoney } from './data'
import { seasonExpenses, seasonIncome, total } from './finance'
import PageHead from './PageHead'
import Investments from './Investments'
import ScoutPanel from './ScoutPanel'
import TacticPanel from './TacticPanel'

interface Props {
  club: Club
  game: GameState
  onAnswer: (notice: Notice, option: NoticeOption) => void
  onContinue: () => void
  onInvest: (area: InvestArea, level: number) => void
  onScout: (order: ScoutOrder) => void
  onTactic: (tactic: Tactic) => void
}

export default function StopScreen({ club, game, onAnswer, onContinue, onInvest, onScout, onTactic }: Props) {
  const baseIndex = BASE_STOPS.findIndex((s) => s.id === game.baseStop)
  const base = BASE_STOPS[baseIndex] ?? BASE_STOPS[0]
  const event = game.eventId ? EVENT_STOPS.find((e) => e.id === game.eventId) : undefined
  const nextBase = BASE_STOPS[baseIndex + 1]

  const pendingRequired = game.notices.filter((n) => n.required && game.answers[n.id] === undefined).length

  const income = total(seasonIncome(game))
  const expenses = total(seasonExpenses(game))
  const net = income - expenses

  const isClosing = !event && base.id === 'cierre'
  const result = isClosing ? userSeasonResult(game.league) : null
  const lastSeason = !event && base.id === 'verano' ? game.history[game.history.length - 1] : undefined

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

      {game.finished && (
        <div className="card">
          <h2>Carrera completada</h2>
          <p>Terminaste las 30 temporadas. El resumen del legado llega en el Paso 10.</p>
        </div>
      )}

      {lastSeason && (
        <div className="card">
          <h2>Temporada {lastSeason.season}</h2>
          <p>
            Terminaste {lastSeason.position}.º en la {lastSeason.division}.ª división con {lastSeason.points} puntos.
            {lastSeason.champion && ' ¡Campeón de liga!'}
            {lastSeason.promoted && ' Ascendiste de categoría.'}
            {lastSeason.relegated && ' Descendiste de categoría.'}
          </p>
        </div>
      )}

      {result && (
        <div className="card">
          <h2>Resultado de la temporada</h2>
          <ul className="plain-list">
            <li>
              <span>Posición final</span>
              <strong>
                {result.position}.º en la {result.division}.ª división ({result.points} puntos)
              </strong>
            </li>
            {result.champion && (
              <li>
                <span>Título</span>
                <strong>🏆 ¡Campeón de liga!</strong>
              </li>
            )}
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
            <li>
              <span>Prestigio</span>
              <strong>
                {prestigeChange(result) >= 0 ? '+' : ''}
                {prestigeChange(result)}
              </strong>
            </li>
          </ul>
          <p className="hint">La clasificación a Europa se calcula en el Paso 8.</p>
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

      {!event && (base.id === 'verano' || base.id === 'invierno') && (
        <TacticPanel tactic={game.tactic} onChange={onTactic} />
      )}

      {!event && (
        <>
          <ScoutPanel club={club} game={game} onScout={onScout} />
          <Investments game={game} onInvest={onInvest} />
        </>
      )}

      {isClosing && (
        <div className="card">
          <h2>Balance de la temporada</h2>
          <ul className="plain-list">
            {seasonIncome(game).map((line) => (
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
          <p className="hint">Se aplica al presupuesto al continuar.</p>
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
          className="btn inline"
          disabled={game.finished || pendingRequired > 0}
          onClick={onContinue}
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}

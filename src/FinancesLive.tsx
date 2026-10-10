import type { Club } from './types'
import type { GameState } from './game'
import type { InvestArea } from './config'
import { formatMoney } from './data'
import { seasonExpenses, seasonIncome, total } from './finance'
import PageHead from './PageHead'
import Investments from './Investments'

interface Props {
  club: Club
  game: GameState
  onInvest: (area: InvestArea, level: number) => void
}

export default function FinancesLive({ club, game, onInvest }: Props) {
  const income = seasonIncome(game)
  const expenses = seasonExpenses(game)
  const inTotal = total(income)
  const outTotal = total(expenses)
  const balance = inTotal - outTotal

  return (
    <div className="page">
      <PageHead
        icon="💰"
        title="Finanzas"
        subtitle="Proyección de la temporada con tus inversiones y contratos actuales."
      />

      <div className="kpis">
        <div className="kpi">
          <span>Presupuesto</span>
          <strong>{formatMoney(club.budget)}</strong>
        </div>
        <div className="kpi">
          <span>Ingresos</span>
          <strong>{formatMoney(inTotal)}</strong>
        </div>
        <div className="kpi">
          <span>Gastos</span>
          <strong>{formatMoney(outTotal)}</strong>
        </div>
        <div className="kpi">
          <span>Balance proyectado</span>
          <strong style={{ color: balance >= 0 ? '#22c55e' : '#ef4444' }}>{formatMoney(balance)}</strong>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Ingresos</h2>
          <ul className="plain-list">
            {income.map((i) => (
              <li key={i.label}>
                <span>{i.label}</span>
                <strong>{formatMoney(i.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Gastos</h2>
          <ul className="plain-list">
            {expenses.map((e) => (
              <li key={e.label}>
                <span>{e.label}</span>
                <strong>{formatMoney(e.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Investments game={game} onInvest={onInvest} />
    </div>
  )
}
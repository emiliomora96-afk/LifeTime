import type { Club } from './types'
import { formatMoney } from './data'
import { BOARD, EXPENSES, INCOME } from './sample'
import PageHead from './PageHead'

export function Finances({ club }: { club: Club }) {
  const income = INCOME.reduce((a, b) => a + b.amount, 0)
  const expenses = EXPENSES.reduce((a, b) => a + b.amount, 0)
  const balance = income - expenses

  return (
    <div className="page">
      <PageHead icon="💰" title="Finanzas" subtitle="Datos de ejemplo. Cifras anuales estimadas." />

      <div className="kpis">
        <div className="kpi">
          <span>Presupuesto</span>
          <strong>{formatMoney(club.budget)}</strong>
        </div>
        <div className="kpi">
          <span>Ingresos</span>
          <strong>{formatMoney(income)}</strong>
        </div>
        <div className="kpi">
          <span>Gastos</span>
          <strong>{formatMoney(expenses)}</strong>
        </div>
        <div className="kpi">
          <span>Balance</span>
          <strong style={{ color: balance >= 0 ? '#22c55e' : '#ef4444' }}>{formatMoney(balance)}</strong>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Ingresos</h2>
          <ul className="plain-list">
            {INCOME.map((i) => (
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
            {EXPENSES.map((e) => (
              <li key={e.label}>
                <span>{e.label}</span>
                <strong>{formatMoney(e.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function Board({ club }: { club: Club }) {
  return (
    <div className="page">
      <PageHead icon="🏛️" title="Directiva" subtitle="Datos de ejemplo. Lo que la directiva espera de ti." />

      <div className="grid-2">
        <div className="card">
          <h2>Dirigentes de {club.name}</h2>
          <ul className="plain-list">
            <li>
              <span>Presidente</span>
              <strong>{BOARD.president}</strong>
            </li>
            <li>
              <span>Director deportivo</span>
              <strong>{BOARD.sportingDirector}</strong>
            </li>
          </ul>
        </div>
        <div className="card">
          <h2>Confianza</h2>
          <p className="objective">{BOARD.confidence}%</p>
          <div className="bar">
            <span style={{ width: `${BOARD.confidence}%` }} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Objetivos de la temporada</h2>
        <ul className="plain-list goals">
          {BOARD.goals.map((g) => (
            <li key={g.text}>
              <div className="goal-text">
                <span>{g.text}</span>
                <span className="hint">{g.progress}%</span>
              </div>
              <div className="bar">
                <span style={{ width: `${g.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
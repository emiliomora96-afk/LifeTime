import type { Club } from './types'
import { formatMoney } from './data'
import { BOARD, EXPENSES, INCOME, MARKET_TARGETS, OFFERS_RECEIVED, PROSPECTS } from './sample'
import PageHead from './PageHead'

export function Market() {
  return (
    <div className="page">
      <PageHead icon="🔁" title="Mercado" subtitle="Datos de ejemplo. Las acciones se activan en pasos posteriores." />

      <div className="card">
        <h2>Jugadores objetivo</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th>Club</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th className="num">Precio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {MARKET_TARGETS.map((t) => (
                <tr key={t.id}>
                  <td><span className="pos">{t.pos}</span></td>
                  <td>{t.name}</td>
                  <td>{t.club}</td>
                  <td className="num">{t.age}</td>
                  <td className="num">{t.rating}</td>
                  <td className="num">{formatMoney(t.price)}</td>
                  <td className="num"><button type="button" className="mini-btn" disabled>Ofertar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Ofertas recibidas</h2>
        <ul className="plain-list">
          {OFFERS_RECEIVED.map((o) => (
            <li key={o.id}>
              <div>
                <strong>{o.player}</strong>
                <div className="hint">Oferta de {o.from}: {formatMoney(o.amount)}</div>
              </div>
              <div className="row-btns">
                <button type="button" className="mini-btn" disabled>Aceptar</button>
                <button type="button" className="mini-btn" disabled>Rechazar</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function Youth() {
  return (
    <div className="page">
      <PageHead icon="🌱" title="Cantera" subtitle="Datos de ejemplo. Los juveniles con más potencial del club." />

      <div className="card">
        <h2>Promesas</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th>Potencial</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {PROSPECTS.map((p) => (
                <tr key={p.id}>
                  <td><span className="pos">{p.pos}</span></td>
                  <td>{p.name}</td>
                  <td className="num">{p.age}</td>
                  <td className="num">{p.rating}</td>
                  <td className="stars">{'★'.repeat(p.potential) + '☆'.repeat(5 - p.potential)}</td>
                  <td className="num"><button type="button" className="mini-btn" disabled>Subir al primer equipo</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

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
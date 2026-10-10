import type { Club } from './types'
import { FORMATION, STARTERS, SUBS, conditionColor } from './sample'
import PageHead from './PageHead'

function avg(nums: number[]): number {
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

export default function Team({ club }: { club: Club }) {
  const all = [...STARTERS, ...SUBS]

  return (
    <div className="page">
      <PageHead icon="👕" title="Equipo" subtitle="Datos de ejemplo. El once inicial y los suplentes." />

      <div className="kpis">
        <div className="kpi">
          <span>Formación</span>
          <strong>{FORMATION}</strong>
        </div>
        <div className="kpi">
          <span>Valoración del once</span>
          <strong>{avg(STARTERS.map((p) => p.rating))}</strong>
        </div>
        <div className="kpi">
          <span>Condición media</span>
          <strong>{avg(all.map((p) => p.condition))}%</strong>
        </div>
        <div className="kpi">
          <span>Plantilla</span>
          <strong>{all.length} jugadores</strong>
        </div>
      </div>

      <div className="card">
        <h2>Once inicial</h2>
        <div className="pitch">
          <div className="pitch-box top" />
          <div className="pitch-box bottom" />
          {STARTERS.map((p) => (
            <div key={p.id} className="token" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <div
                className="token-badge"
                style={{
                  background: club.primaryColor,
                  color: club.secondaryColor,
                  borderColor: club.secondaryColor,
                }}
              >
                {p.rating}
              </div>
              <div className="token-name">{p.name.split(' ').slice(-1)[0]}</div>
              <div className="cond">
                <span style={{ width: `${p.condition}%`, background: conditionColor(p.condition) }} />
              </div>
            </div>
          ))}
        </div>
        <p className="hint center">El número es la valoración. La barra es la condición física.</p>
      </div>

      <div className="card">
        <h2>Suplentes</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th className="num">Edad</th>
                <th className="num">Valoración</th>
                <th>Condición</th>
              </tr>
            </thead>
            <tbody>
              {SUBS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="pos">{p.pos}</span>
                  </td>
                  <td>{p.name}</td>
                  <td className="num">{p.age}</td>
                  <td className="num">{p.rating}</td>
                  <td>
                    <div className="cond wide">
                      <span style={{ width: `${p.condition}%`, background: conditionColor(p.condition) }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
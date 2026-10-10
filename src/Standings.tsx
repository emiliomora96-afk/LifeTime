import { useState } from 'react'
import type { Club } from './types'
import type { LeagueState, Level } from './engine'
import { getTable } from './season'
import PageHead from './PageHead'

function zoneClass(level: Level, i: number): string {
  if (level === 1) {
    if (i < 4) return 'zone-europe'
    if (i >= 17) return 'zone-down'
  } else {
    if (i < 3) return 'zone-up'
    if (i >= 17) return 'zone-down'
  }
  return ''
}

export default function Standings({ club, league }: { club: Club; league: LeagueState }) {
  const [tab, setTab] = useState<Level>(league.userDivision)
  const rows = getTable(league, tab)
  const played = league.divisions[tab].played

  return (
    <div className="page">
      <PageHead
        icon="📊"
        title="Clasificación"
        subtitle="Calculada por el motor de simulación. Las zonas de ascenso (3 primeros) y descenso (3 últimos) son provisorias hasta definir las reglas."
      />

      <div className="card">
        <div className="tabs">
          <button type="button" className={'tab' + (tab === 1 ? ' active' : '')} onClick={() => setTab(1)}>
            1.ª división
          </button>
          <button type="button" className={'tab' + (tab === 2 ? ' active' : '')} onClick={() => setTab(2)}>
            2.ª división
          </button>
        </div>

        {played === 0 && <p className="hint">Aún no se ha jugado ninguna jornada: orden por nivel de los equipos.</p>}

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club</th>
                <th className="num">PJ</th>
                <th className="num">G</th>
                <th className="num">E</th>
                <th className="num">P</th>
                <th className="num">GF</th>
                <th className="num">GC</th>
                <th className="num">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={zoneClass(tab, i) + (r.name === null ? ' me' : '')}>
                  <td>{i + 1}</td>
                  <td>{r.name ?? club.name}</td>
                  <td className="num">{r.played}</td>
                  <td className="num">{r.won}</td>
                  <td className="num">{r.drawn}</td>
                  <td className="num">{r.lost}</td>
                  <td className="num">{r.gf}</td>
                  <td className="num">{r.ga}</td>
                  <td className="num">
                    <strong>{r.points}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="legend">
          {tab === 1 ? (
            <>
              <span><i className="lg europe" /> Clasificación a Europa</span>
              <span><i className="lg down" /> Descenso</span>
            </>
          ) : (
            <>
              <span><i className="lg up" /> Ascenso</span>
              <span><i className="lg down" /> Descenso</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

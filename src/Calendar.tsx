import { useState } from 'react'
import type { Club } from './types'
import type { LeagueState } from './engine'
import type { Fixture } from './sample'
import { getUserFixtures } from './season'
import PageHead from './PageHead'

type Tab = 'resultados' | 'proximos'

function outcome(f: Fixture, clubName: string): 'G' | 'E' | 'P' {
  const atHome = f.home === clubName
  const mine = (atHome ? f.homeGoals : f.awayGoals) ?? 0
  const theirs = (atHome ? f.awayGoals : f.homeGoals) ?? 0
  if (mine > theirs) return 'G'
  if (mine === theirs) return 'E'
  return 'P'
}

export default function Calendar({ club, league }: { club: Club; league: LeagueState }) {
  const [tab, setTab] = useState<Tab>('resultados')
  const fixtures = getUserFixtures(league, club.name)
  const results = fixtures.filter((f) => f.played).reverse()
  const upcoming = fixtures.filter((f) => !f.played).slice(0, 10)
  const list = tab === 'resultados' ? results : upcoming

  return (
    <div className="page">
      <PageHead
        icon="📅"
        title="Calendario y resultados"
        subtitle={`Partidos simulados por el motor. ${results.length} de ${fixtures.length} jornadas jugadas.`}
      />

      <div className="card">
        <div className="tabs">
          <button type="button" className={'tab' + (tab === 'resultados' ? ' active' : '')} onClick={() => setTab('resultados')}>
            Resultados
          </button>
          <button type="button" className={'tab' + (tab === 'proximos' ? ' active' : '')} onClick={() => setTab('proximos')}>
            Próximos partidos
          </button>
        </div>

        {list.length === 0 ? (
          <p className="hint">
            {tab === 'resultados' ? 'Aún no se ha jugado ninguna jornada.' : 'No quedan partidos esta temporada.'}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table calendar-table">
              <thead>
                <tr>
                  <th>Jor.</th>
                  <th>Local</th>
                  <th className="center">Marcador</th>
                  <th>Visitante</th>
                  {tab === 'resultados' && <th className="center">Res.</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.round}>
                    <td>{f.round}</td>
                    <td className={f.home === club.name ? 'mine' : ''}>{f.home}</td>
                    <td className="center">{f.played ? `${f.homeGoals} - ${f.awayGoals}` : 'vs'}</td>
                    <td className={f.away === club.name ? 'mine' : ''}>{f.away}</td>
                    {tab === 'resultados' && (
                      <td className="center">
                        <span className={'result tag-' + outcome(f, club.name).toLowerCase()}>
                          {outcome(f, club.name)}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

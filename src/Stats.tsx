import { useState } from 'react'
import type { Club } from './types'
import type { LeagueState, Level } from './engine'
import type { StatRow } from './sample'
import { getClubStats, getTopPlayers } from './season'
import PageHead from './PageHead'

function RankCard({
  title,
  rows,
  clubName,
  decimals = 0,
}: {
  title: string
  rows: StatRow[]
  clubName: string
  decimals?: number
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="hint">Aún no hay datos.</p>
      ) : (
        <ol className="rank">
          {rows.map((r, i) => (
            <li key={r.name + i} className={r.club === null ? 'me' : ''}>
              <span className="rank-pos">{i + 1}</span>
              <div className="rank-info">
                <strong>{r.name}</strong>
                <span className="hint">{r.club ?? clubName}</span>
              </div>
              <strong>{r.value.toFixed(decimals)}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default function Stats({ club, league }: { club: Club; league: LeagueState }) {
  const [tab, setTab] = useState<Level>(league.userDivision)
  const clubStats = getClubStats(league)

  return (
    <div className="page">
      <PageHead
        icon="🏆"
        title="Estadísticas y premios"
        subtitle="Goles y asistencias repartidos por el motor según posición, valoración y minutos."
      />

      <div className="tabs">
        <button type="button" className={'tab' + (tab === 1 ? ' active' : '')} onClick={() => setTab(1)}>
          1.ª división
        </button>
        <button type="button" className={'tab' + (tab === 2 ? ' active' : '')} onClick={() => setTab(2)}>
          2.ª división
        </button>
      </div>

      <div className="grid-3">
        <RankCard title="Goleadores" rows={getTopPlayers(league, tab, 'goals')} clubName={club.name} />
        <RankCard title="Asistentes" rows={getTopPlayers(league, tab, 'assists')} clubName={club.name} />
        <RankCard
          title="Mejor jugador (provisorio)"
          rows={getTopPlayers(league, tab, 'best')}
          clubName={club.name}
          decimals={1}
        />
      </div>

      <div className="card">
        <h2>Estadísticas de {club.name} (promedio por partido)</h2>
        {clubStats === null ? (
          <p className="hint">Aún no se ha jugado ningún partido.</p>
        ) : (
          <div className="kpis">
            <div className="kpi">
              <span>Posesión</span>
              <strong>{clubStats.possession.toFixed(0)}%</strong>
            </div>
            <div className="kpi">
              <span>Tiros</span>
              <strong>{clubStats.shots.toFixed(1)}</strong>
            </div>
            <div className="kpi">
              <span>A puerta</span>
              <strong>{clubStats.onTarget.toFixed(1)}</strong>
            </div>
            <div className="kpi">
              <span>Córners</span>
              <strong>{clubStats.corners.toFixed(1)}</strong>
            </div>
            <div className="kpi">
              <span>Faltas</span>
              <strong>{clubStats.fouls.toFixed(1)}</strong>
            </div>
            <div className="kpi">
              <span>Amarillas</span>
              <strong>{clubStats.yellow.toFixed(1)}</strong>
            </div>
            <div className="kpi">
              <span>Rojas</span>
              <strong>{clubStats.red.toFixed(2)}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Premios de la temporada</h2>
        <p>Los premios se entregan en la parada de Cierre. Los nombres definitivos están pendientes de definir.</p>
      </div>
    </div>
  )
}

import './standings.css'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Club } from './types'
import type { LeagueState, Level } from './engine'
import { getTable } from './season'
import PageHead from './PageHead'
import Crest from './Crest'
import TrophyImg from './TrophyImg'
import { EUROPE } from './europe'
import { ZONE_COLOR, zoneOf } from './zones'
import type { Zone } from './zones'
import type { TrophyId } from './trophyAspect'

// Rango de posiciones de una competición europea: "1.º–4.º"
function range(positions: number[]): string {
  const a = positions[0]
  const b = positions[positions.length - 1]
  return a === b ? `${a}.º` : `${a}.º–${b}.º`
}

interface KeyItem {
  zone: Zone
  label: string
  positions: string
  trophy?: TrophyId
  arrow?: string
}

function legendFor(level: Level): KeyItem[] {
  if (level === 1) {
    return [
      ...EUROPE.map((c) => ({ zone: c.id as Zone, label: c.name, positions: range(c.positions), trophy: c.id as TrophyId })),
      { zone: 'down' as Zone, label: 'Descenso a 2.ª división', positions: '18.º–20.º', arrow: '▼' },
    ]
  }
  return [
    { zone: 'up', label: 'Ascenso a 1.ª división', positions: '1.º–3.º', arrow: '▲' },
    { zone: 'down', label: 'Descenso', positions: '18.º–20.º', arrow: '▼' },
  ]
}

export default function Standings({ club, league }: { club: Club; league: LeagueState }) {
  const [tab, setTab] = useState<Level>(league.userDivision)
  const rows = getTable(league, tab)
  const played = league.divisions[tab].played
  const teams = league.divisions[tab].teams

  function colorsOf(name: string | null): [string, string] {
    if (name === null) return [club.primaryColor, club.secondaryColor]
    return teams.find((t) => t.name === name)?.colors ?? ['#475569', '#cbd5e1']
  }

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
          <table className="data-table standings-table">
            <thead>
              <tr>
                <th className="st-pos">#</th>
                <th>Club</th>
                <th className="num hide-sm">PJ</th>
                <th className="num">
                  <span className="lbl-lg">G</span>
                  <span className="lbl-sm">V</span>
                </th>
                <th className="num">E</th>
                <th className="num">
                  <span className="lbl-lg">P</span>
                  <span className="lbl-sm">D</span>
                </th>
                <th className="num hide-sm">GF</th>
                <th className="num hide-sm">GC</th>
                <th className="num hide-sm">DG</th>
                <th className="num show-sm">PJ</th>
                <th className="num st-pts-h">
                  <span className="lbl-lg">Pts</span>
                  <span className="lbl-sm">PTOS</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const zone = zoneOf(tab, i)
                const [c1, c2] = colorsOf(r.name)
                const diff = r.gf - r.ga
                const style = zone ? ({ '--zone': ZONE_COLOR[zone] } as CSSProperties) : undefined
                return (
                  <tr key={i} className={r.name === null ? 'me' : ''} data-zone={zone ?? undefined} style={style}>
                    <td className="st-pos">
                      <span className="pos-badge">{i + 1}</span>
                    </td>
                    <td>
                      <span className="club-cell">
                        <Crest name={r.name ?? club.name} shape={r.name === null ? club.crestShape : 'classic'} primary={c1} secondary={c2} size={20} />
                        <span className="club-name">{r.name ?? club.name}</span>
                        {tab === 1 && zone && zone !== 'down' && (
                          <span className="club-trophy" title={EUROPE.find((c) => c.id === zone)?.name}>
                            <TrophyImg id={zone as TrophyId} height={16} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="num hide-sm">{r.played}</td>
                    <td className="num">{r.won}</td>
                    <td className="num">{r.drawn}</td>
                    <td className="num">{r.lost}</td>
                    <td className="num hide-sm">{r.gf}</td>
                    <td className="num hide-sm">{r.ga}</td>
                    <td className={'num hide-sm dg' + (diff > 0 ? ' pos' : diff < 0 ? ' neg' : '')}>{diff > 0 ? `+${diff}` : diff}</td>
                    <td className="num show-sm">{r.played}</td>
                    <td className="num st-pts">
                      <strong>{r.points}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="st-legend">
          {legendFor(tab).map((k) => (
            <div className="st-key" key={k.zone} style={{ '--zone': ZONE_COLOR[k.zone] } as CSSProperties}>
              <span className="st-key-icon">
                {k.trophy ? <TrophyImg id={k.trophy} height={30} /> : <b>{k.arrow}</b>}
              </span>
              <span className="st-key-text">
                <strong>{k.label}</strong>
                <small>{k.positions}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { Club, CrestShape } from './types'
import {
  COLOR_PRESETS,
  CREST_SHAPES,
  START_BUDGET,
  START_DIVISION,
  formatMoney,
} from './data'
import Crest from './Crest'
import { LEAGUES, LEAGUE_IDS, DEFAULT_LEAGUE, leagueDef } from './leagues'
import type { LeagueId } from './leagues'

interface Props {
  onCreate: (club: Club) => void
}

export default function CreateClub({ onCreate }: Props) {
  const [leagueId, setLeagueId] = useState<LeagueId>(DEFAULT_LEAGUE)
  const league = leagueDef(leagueId)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [stadium, setStadium] = useState('')
  const [primaryColor, setPrimaryColor] = useState(COLOR_PRESETS[0].primary)
  const [secondaryColor, setSecondaryColor] = useState(COLOR_PRESETS[0].secondary)
  const [crestShape, setCrestShape] = useState<CrestShape>('classic')

  const valid = name.trim() !== '' && city.trim() !== '' && stadium.trim() !== ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onCreate({
      league: league.name,
      leagueId,
      division: START_DIVISION,
      name: name.trim(),
      city: city.trim(),
      primaryColor,
      secondaryColor,
      crestShape,
      stadium: stadium.trim(),
      budget: START_BUDGET,
    })
  }

  return (
    <div className="screen">
      <h1>Crea tu club</h1>
      <p className="subtitle">Empiezas desde abajo. El resto del camino lo escribes tú.</p>

      <form className="layout" onSubmit={handleSubmit}>
        <div className="card">
          <h2>Datos del club</h2>

          <div className="field">
            <label htmlFor="league">Liga</label>
            <select id="league" value={leagueId} onChange={(e) => setLeagueId(e.target.value as LeagueId)}>
              {LEAGUE_IDS.map((id) => (
                <option key={id} value={id}>
                  {LEAGUES[id].flag} {LEAGUES[id].name} · {LEAGUES[id].div1Name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="name">Nombre del club</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Unión Deportiva Horizonte"
              maxLength={40}
            />
          </div>

          <div className="field">
            <label htmlFor="city">Ciudad</label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej: Valencia"
              maxLength={30}
            />
          </div>

          <div className="field">
            <label htmlFor="stadium">Estadio</label>
            <input
              id="stadium"
              type="text"
              value={stadium}
              onChange={(e) => setStadium(e.target.value)}
              placeholder="Ej: Estadio Municipal"
              maxLength={40}
            />
          </div>

          <div className="field">
            <span className="label">Colores</span>
            <div className="presets">
              {COLOR_PRESETS.map((p) => {
                const selected = p.primary === primaryColor && p.secondary === secondaryColor
                return (
                  <button
                    key={p.name}
                    type="button"
                    title={p.name}
                    className={'preset' + (selected ? ' selected' : '')}
                    style={{ background: `linear-gradient(135deg, ${p.primary} 50%, ${p.secondary} 50%)` }}
                    onClick={() => {
                      setPrimaryColor(p.primary)
                      setSecondaryColor(p.secondary)
                    }}
                  />
                )
              })}
            </div>
            <div className="row custom-colors">
              <label className="color-pick">
                Principal
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </label>
              <label className="color-pick">
                Secundario
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="field">
            <span className="label">Forma del escudo</span>
            <div className="shapes">
              {CREST_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={'shape' + (crestShape === s.id ? ' selected' : '')}
                  onClick={() => setCrestShape(s.id)}
                >
                  <Crest name={name} shape={s.id} primary={primaryColor} secondary={secondaryColor} size={48} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card summary">
          <h2>Resumen</h2>
          <div className="crest-preview">
            <Crest name={name} shape={crestShape} primary={primaryColor} secondary={secondaryColor} size={130} />
          </div>
          <p className="club-name">{name.trim() || 'Nombre del club'}</p>
          <dl>
            <dt>Ciudad</dt>
            <dd>{city.trim() || '—'}</dd>
            <dt>Estadio</dt>
            <dd>{stadium.trim() || '—'}</dd>
            <dt>Liga</dt>
            <dd>
              {league.flag} {league.name}
            </dd>
            <dt>Categoría</dt>
            <dd>
              {START_DIVISION}.ª división · {league.div2Name}
            </dd>
            <dt>Presupuesto inicial</dt>
            <dd>{formatMoney(START_BUDGET)}</dd>
          </dl>
          <button type="submit" className="btn" disabled={!valid}>
            Empezar la aventura
          </button>
          {!valid && <p className="hint">Completa nombre, ciudad y estadio para continuar.</p>}
        </div>
      </form>
    </div>
  )
}
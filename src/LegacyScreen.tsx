import './legacy.css'
import { useRef, useState } from 'react'
import type { Club } from './types'
import type { GameState } from './game'
import { TOTAL_SEASONS } from './config'
import { COPA, SUPERCOPA } from './domestic'
import { formatMoney } from './data'
import { buildLegacy, legacyText, seasonLine } from './legacy'
import { exportSave, importSave, saveFileName } from './save'
import PageHead from './PageHead'
import Crest from './Crest'
import Vitrina from './Vitrina'

interface Props {
  club: Club
  game: GameState
  onImport: (club: Club, game: GameState) => void
  onNewGame: () => void
}

// Tarjeta para compartir como imagen (se dibuja en un canvas, sin librerías)
function shareImage(club: Club, game: GameState): string {
  const l = buildLegacy(game)
  const c = document.createElement('canvas')
  c.width = 1080
  c.height = 1350
  const g = c.getContext('2d')
  if (!g) return ''
  const grad = g.createLinearGradient(0, 0, 0, c.height)
  grad.addColorStop(0, '#16264a')
  grad.addColorStop(1, '#0b1220')
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = club.primaryColor
  g.fillRect(0, 0, c.width, 18)
  g.fillStyle = club.secondaryColor
  g.fillRect(0, 18, c.width, 8)

  g.textAlign = 'center'
  g.fillStyle = '#8fa0c2'
  g.font = '600 34px system-ui, sans-serif'
  g.fillText('LIFETIME · LEGADO', 540, 110)
  g.fillStyle = '#e6ecf8'
  g.font = '800 72px system-ui, sans-serif'
  g.fillText(club.name.slice(0, 26), 540, 230)
  g.fillStyle = '#fbbf24'
  g.font = '700 48px system-ui, sans-serif'
  g.fillText(l.verdict.title, 540, 310)
  g.fillStyle = '#8fa0c2'
  g.font = '400 32px system-ui, sans-serif'
  g.fillText(`${l.seasons} de ${TOTAL_SEASONS} temporadas`, 540, 360)

  const boxes: [string, number][] = [
    ['Ligas de 1.ª', l.leagueTitles],
    ['Copas nacionales', l.copaTitles + l.supercopaTitles],
    ['Títulos europeos', l.euroTitleCount],
    ['Ascensos', l.promotions],
  ]
  boxes.forEach(([label, n], i) => {
    const x = 90 + i * 235
    g.fillStyle = '#111a2e'
    g.fillRect(x, 430, 215, 200)
    g.strokeStyle = '#223052'
    g.lineWidth = 3
    g.strokeRect(x, 430, 215, 200)
    g.fillStyle = '#e6ecf8'
    g.font = '800 96px system-ui, sans-serif'
    g.fillText(String(n), x + 107, 550)
    g.fillStyle = '#8fa0c2'
    g.font = '400 25px system-ui, sans-serif'
    g.fillText(label, x + 107, 600)
  })

  g.textAlign = 'left'
  g.fillStyle = '#8fa0c2'
  g.font = '600 30px system-ui, sans-serif'
  g.fillText('LEYENDAS DEL CLUB', 90, 720)
  g.fillStyle = '#e6ecf8'
  g.font = '600 38px system-ui, sans-serif'
  l.legends.slice(0, 5).forEach((p, i) => {
    g.fillText(`${i + 1}. ${p.name} (${p.pos})`, 90, 785 + i * 90)
    g.fillStyle = '#8fa0c2'
    g.font = '400 28px system-ui, sans-serif'
    g.fillText(`${p.goals} goles · ${p.titles} títulos · valoración ${p.peak}`, 120, 822 + i * 90)
    g.fillStyle = '#e6ecf8'
    g.font = '600 38px system-ui, sans-serif'
  })
  g.textAlign = 'center'
  g.fillStyle = '#8fa0c2'
  g.font = '400 28px system-ui, sans-serif'
  g.fillText(`Prestigio final: ${game.prestige}`, 540, 1290)
  return c.toDataURL('image/png')
}

function download(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function LegacyScreen({ club, game, onImport, onNewGame }: Props) {
  const l = buildLegacy(game)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const done = game.finished

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(legacyText(club, game, club.budget))
      setMsg({ ok: true, text: 'Resumen copiado. Pégalo donde quieras.' })
    } catch {
      setMsg({ ok: false, text: 'No se pudo copiar. Revisa los permisos del navegador.' })
    }
  }

  function handleImage() {
    const url = shareImage(club, game)
    if (!url) return setMsg({ ok: false, text: 'No se pudo crear la imagen.' })
    download(url, `legado-${saveFileName(club, game).replace(/^lifetime-|\.json$/g, '')}.png`)
    setMsg({ ok: true, text: 'Imagen descargada.' })
  }

  function handleExport() {
    const blob = new Blob([exportSave(club, game)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    download(url, saveFileName(club, game))
    URL.revokeObjectURL(url)
    setMsg({ ok: true, text: 'Partida exportada. Guarda el archivo en un lugar seguro.' })
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    const result = importSave(await file.text())
    if (fileRef.current) fileRef.current.value = ''
    if (!result.ok) return setMsg({ ok: false, text: result.error })
    if (!window.confirm('Se reemplazará la partida actual por la del archivo. ¿Continuar?')) return
    onImport(result.club, result.game)
    setMsg({ ok: true, text: 'Partida cargada.' })
  }

  return (
    <div className="page">
      <PageHead
        icon="📜"
        title={done ? 'Legado del club' : 'Palmarés y legado'}
        subtitle={
          done
            ? 'Terminaste las 30 temporadas. Esta es la historia de tu club.'
            : `Lo que llevas conseguido (${l.seasons} de ${TOTAL_SEASONS} temporadas). Al terminar la carrera queda como tu legado.`
        }
      />

      <section className="card lg-hero">
        <div className="lg-crest">
          <Crest name={club.name} shape={club.crestShape} primary={club.primaryColor} secondary={club.secondaryColor} size={72} />
        </div>
        <h2>{club.name}</h2>
        <p>
          {club.city} · {club.stadium}
        </p>
        <p className="lg-verdict">{l.verdict.title}</p>
        <p>{l.verdict.text}</p>
      </section>

      <section className="card">
        <h2>Palmarés</h2>
        <Vitrina legacy={l} />
        <div className="kpis" style={{ marginTop: 14 }}>
          <div className="kpi">
            <span>Ascensos / descensos</span>
            <strong>
              {l.promotions} / {l.relegations}
            </strong>
          </div>
          <div className="kpi">
            <span>Temporadas en 1.ª</span>
            <strong>{l.seasonsFirst}</strong>
          </div>
          <div className="kpi">
            <span>Mejor puesto en 1.ª</span>
            <strong>{l.bestPosition ? `${l.bestPosition}.º` : '—'}</strong>
          </div>
          <div className="kpi">
            <span>Temporadas en Europa</span>
            <strong>{l.euroSeasons}</strong>
          </div>
          <div className="kpi">
            <span>Presupuesto</span>
            <strong>{formatMoney(club.budget)}</strong>
          </div>
          <div className="kpi">
            <span>Prestigio</span>
            <strong>{game.prestige}</strong>
          </div>
        </div>
        {l.firstTitle && (
          <p className="hint">
            ⭐ {l.firstTitle.label}: temporada {l.firstTitle.season}.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Jugadores históricos</h2>
        {l.legends.length === 0 ? (
          <p className="hint">Aún no hay historia: aparecerán al cerrar la primera temporada.</p>
        ) : (
          <ol className="rank">
            {l.legends.slice(0, 8).map((p, i) => (
              <li key={p.id}>
                <span className="rank-pos">{i + 1}</span>
                <div className="rank-info">
                  <strong>
                    {p.name} <span className="hint">({p.pos})</span>
                  </strong>
                  <span className="hint">
                    Temporadas {p.firstSeason}–{p.lastSeason} · {p.goals} goles · {p.assists} asistencias · {p.titles}{' '}
                    {p.titles === 1 ? 'título' : 'títulos'}
                  </span>
                </div>
                <strong title="Mejor valoración">{p.peak}</strong>
              </li>
            ))}
          </ol>
        )}
        {l.topScorer && l.topScorer.goals > 0 && (
          <p className="hint">
            👟 Máximo goleador histórico: {l.topScorer.name} ({l.topScorer.goals} goles).
          </p>
        )}
      </section>

      <section className="card">
        <h2>Temporada a temporada</h2>
        {game.history.length === 0 ? (
          <p className="hint">Todavía no se cerró ninguna temporada.</p>
        ) : (
          <div className="lg-scroll">
            <table className="lg-timeline">
              <thead>
                <tr>
                  <th>Temp.</th>
                  <th>Resultado</th>
                  <th>Mejor jugador</th>
                  <th>Goleador</th>
                </tr>
              </thead>
              <tbody>
                {game.history.map((r) => (
                  <tr key={r.season} className={r.champion || r.euro?.champion || r.copa?.champion || r.supercopa?.champion ? 'title' : ''}>
                    <td>{r.season}</td>
                    <td>
                      {r.champion || r.euro?.champion ? '🏆 ' : ''}
                      {r.copa?.champion ? `${COPA.icon} ` : ''}
                      {r.supercopa?.champion ? `${SUPERCOPA.icon} ` : ''}
                      {seasonLine(r)}
                    </td>
                    <td>{r.bestPlayer ? `${r.bestPlayer.name} (${r.bestPlayer.rating})` : '—'}</td>
                    <td>{r.topScorer ? `${r.topScorer.name} (${r.topScorer.goals})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Compartir</h2>
        <div className="lg-actions">
          <button type="button" className="btn inline" onClick={handleCopy}>
            📋 Copiar resumen
          </button>
          <button type="button" className="btn inline secondary" onClick={handleImage}>
            🖼️ Descargar imagen
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Guardado de la partida</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          El juego guarda solo en este navegador después de cada paso. Si vas a borrar el historial del navegador o cambiar de
          equipo, exporta la partida a un archivo y vuelve a importarla.
        </p>
        <div className="lg-actions">
          <button type="button" className="btn inline secondary" onClick={handleExport}>
            💾 Exportar partida
          </button>
          <button type="button" className="btn inline secondary" onClick={() => fileRef.current?.click()}>
            📂 Importar partida
          </button>
          {done ? (
            <button type="button" className="btn inline" onClick={onNewGame}>
              🔄 Empezar una partida nueva
            </button>
          ) : (
            <button
              type="button"
              className="btn inline danger lg-reset"
              onClick={() => {
                if (window.confirm('¿Borrar el club y empezar una partida nueva? Se pierde el progreso.')) onNewGame()
              }}
            >
              🗑️ Nueva partida
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
        {msg && <p className={'lg-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</p>}
      </section>
    </div>
  )
}

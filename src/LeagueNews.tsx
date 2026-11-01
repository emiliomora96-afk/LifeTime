import type { GameState } from './game'
import { formatMoney } from './data'

// Noticias de la liga (Paso 10): lo que hicieron los demás clubes en su última ventana de fichajes
export default function LeagueNewsCard({ game }: { game: GameState }) {
  const moves = game.news
  if (!moves || moves.length === 0) return null
  const transfers = moves.filter((m) => m.kind === 'fichaje').slice(0, 6)
  const youth = moves.filter((m) => m.kind === 'cantera').slice(0, 3)
  const window = moves[0].window === 'invierno' ? 'invierno' : 'verano'

  return (
    <div className="card">
      <h2>📰 Noticias de la liga · mercado de {window}</h2>
      {transfers.length > 0 && (
        <ul className="plain-list">
          {transfers.map((m, i) => (
            <li key={`${m.player}-${i}`}>
              <span>
                <strong>{m.player}</strong> ({m.pos}, {m.age} años, {m.rating})
                <br />
                <span className="hint">
                  {m.from} → <strong>{m.to}</strong>
                </span>
              </span>
              <strong>{formatMoney(m.fee ?? 0)}</strong>
            </li>
          ))}
        </ul>
      )}
      {youth.length > 0 && (
        <>
          <p className="hint">🌱 Joyas de cantera que suben al primer equipo:</p>
          <ul className="plain-list">
            {youth.map((m, i) => (
              <li key={`${m.player}-y${i}`}>
                <span>
                  <strong>{m.player}</strong> ({m.pos}, {m.age} años)
                </span>
                <span className="hint">{m.to}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

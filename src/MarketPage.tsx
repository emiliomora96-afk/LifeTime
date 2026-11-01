import './market.css'
import PlayerChip from './PlayerChip'
import LeagueNewsCard from './LeagueNews'
import { useMemo, useState } from 'react'
import PageHead from './PageHead'
import type { Club } from './types'
import type { GameState } from './game'
import type { Position } from './sample'
import { formatMoney } from './data'
import { getUserSquad } from './engine'
import type { Listing, MarketOffer } from './market'
import { buyBlocker, listMarket, marketOpen, quickSalePrice, sellBlocker } from './market'
import { nameParts, potentialLabel } from './players'
import type { SimPlayer } from './players'
import { POSITION_ORDER, MAX_SQUAD } from './squads'

type Tab = Position | 'TODOS'

const TABS: { id: Tab; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'POR', label: 'Porteros' },
  { id: 'DEF', label: 'Defensas' },
  { id: 'MED', label: 'Medios' },
  { id: 'DEL', label: 'Delanteros' },
]

const LIST_SIZE = 25

interface Props {
  club: Club
  game: GameState
  onBuy: (listing: Listing) => void
  onSell: (player: SimPlayer) => void
  onAcceptOffer: (offer: MarketOffer) => void
  onRejectOffer: (offer: MarketOffer) => void
}

export default function Market({ club, game, onBuy, onSell, onAcceptOffer, onRejectOffer }: Props) {
  const [tab, setTab] = useState<Tab>('TODOS')
  const [onlyAffordable, setOnlyAffordable] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)

  const open = marketOpen(game)
  const squad = getUserSquad(game.league)
  const listings = useMemo(() => listMarket(game.league), [game.league])

  const shown = listings
    .filter((l) => (tab === 'TODOS' || l.player.pos === tab) && (!onlyAffordable || l.price <= club.budget))
    .sort((a, b) => b.player.rating - a.player.rating || a.price - b.price)
    .slice(0, LIST_SIZE)

  const mySquad = [...squad].sort(
    (a, b) => POSITION_ORDER.indexOf(a.pos) - POSITION_ORDER.indexOf(b.pos) || b.rating - a.rating,
  )

  // Primer toque: pide confirmar. Segundo toque: ejecuta.
  function ask(key: string, action: () => void) {
    if (confirm === key) {
      setConfirm(null)
      action()
    } else setConfirm(key)
  }

  return (
    <div className="page">
      <PageHead
        icon="🔁"
        title="Mercado"
        subtitle="Ficha y vende jugadores. El mercado solo abre en las paradas de Verano e Invierno."
      />

      <div className={'market-status' + (open ? ' open' : '')}>
        {open
          ? `Mercado abierto · Presupuesto ${formatMoney(club.budget)} · Plantilla ${squad.length} / ${MAX_SQUAD}`
          : 'Mercado cerrado. Vuelve a la parada de Verano o de Invierno para fichar y vender.'}
      </div>

      <LeagueNewsCard game={game} />

      {game.offers.length > 0 && open ? (
        <div className="card">
          <h2>Ofertas recibidas</h2>
          <ul className="plain-list">
            {game.offers.map((o) => {
              const p = squad.find((s) => s.id === o.playerId)
              if (!p) return null
              const blocker = sellBlocker(game, p)
              return (
                <li key={o.id}>
                  <div>
                    <strong>{p.name}</strong> <span className="pos">{p.pos}</span>
                    <div className="hint">
                      Oferta de {o.teamName}: {formatMoney(o.amount)} (valoración {p.rating}, {p.age} años)
                      {blocker ? ` · ${blocker}` : ''}
                    </div>
                  </div>
                  <div className="row-btns">
                    <button
                      type="button"
                      className="mini-btn"
                      disabled={blocker !== null}
                      onClick={() => ask('o' + o.id, () => onAcceptOffer(o))}
                    >
                      {confirm === 'o' + o.id ? '¿Confirmar?' : 'Aceptar'}
                    </button>
                    <button type="button" className="mini-btn danger" onClick={() => onRejectOffer(o)}>
                      Rechazar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="card">
        <h2>Fichar jugadores</h2>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={'tab' + (tab === t.id ? ' active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="market-check">
          <input type="checkbox" checked={onlyAffordable} onChange={(e) => setOnlyAffordable(e.target.checked)} />
          Solo los que puedo pagar
        </label>
        <div className="table-scroll">
          <table className="data-table market-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th>Club</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th className="num">Potencial</th>
                <th className="num">Precio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const blocker = buyBlocker(game, club.budget, l)
                const key = 'b' + l.player.id
                return (
                  <tr key={l.player.id}>
                    <td>
                      <span className="pos">{l.player.pos}</span>
                    </td>
                    <td>
                      <span className="name-cell">
                        <PlayerChip player={l.player} />
                        <span>
                          {l.player.name}
                          {l.player.nat ? <span className="nat-code"> {l.player.nat}</span> : null}
                        </span>
                      </span>
                    </td>
                    <td>
                      {l.teamName}
                      <span className="nat-code"> {l.division}.ª</span>
                    </td>
                    <td className="num" data-label="Edad">{l.player.age}</td>
                    <td className="num" data-label="Val.">{l.player.rating}</td>
                    <td className="num" data-label="Potencial">{potentialLabel(l.player)}</td>
                    <td className="num" data-label="Precio">{formatMoney(l.price)}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="mini-btn"
                        data-haptic="confirm"
                        disabled={blocker !== null}
                        title={blocker ?? undefined}
                        onClick={() => ask(key, () => onBuy(l))}
                      >
                        {confirm === key ? '¿Confirmar?' : 'Fichar'}
                      </button>
                      {blocker ? <small className="blocker">{blocker}</small> : null}
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="hint center">
                    No hay jugadores con ese filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Se muestran los {LIST_SIZE} mejores de cada filtro. Los gigantes piden un 30% más por sus jugadores. El club
          rival repone la plaza con otro jugador.
        </p>
      </div>

      <div className="card">
        <h2>Vender jugadores</h2>
        <div className="table-scroll">
          <table className="data-table market-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th className="num">Edad</th>
                <th className="num">Val.</th>
                <th className="num">Potencial</th>
                <th>Rol</th>
                <th className="num">Venta directa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mySquad.map((p) => {
                const blocker = sellBlocker(game, p)
                const key = 's' + p.id
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="pos">{p.pos}</span>
                    </td>
                    <td>
                      <span className="name-cell">
                        <PlayerChip player={p} />
                        <span>{nameParts(p).first + ' ' + nameParts(p).last}</span>
                      </span>
                    </td>
                    <td className="num" data-label="Edad">{p.age}</td>
                    <td className="num" data-label="Val.">{p.rating}</td>
                    <td className="num" data-label="Potencial">{potentialLabel(p)}</td>
                    <td data-label="Rol">{p.starter ? 'Titular' : 'Suplente'}</td>
                    <td className="num" data-label="Venta directa">{formatMoney(quickSalePrice(p))}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="mini-btn danger"
                        disabled={blocker !== null}
                        title={blocker ?? undefined}
                        onClick={() => ask(key, () => onSell(p))}
                      >
                        {confirm === key ? '¿Confirmar?' : 'Vender'}
                      </button>
                      {blocker ? <small className="blocker">{blocker}</small> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">
          La venta directa paga un 15% menos que el valor de mercado. Esperar una oferta suele pagar más. Debes
          conservar al menos 2 porteros, 5 defensas, 4 medios y 4 delanteros.
        </p>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import CreateClub from './CreateClub'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import MoreSheet from './MoreSheet'
import ActionBar from './ActionBar'
import TopBar from './TopBar'
import Dashboard from './Dashboard'
import StopScreen from './StopScreen'
import FinancesLive from './FinancesLive'
import Team from './Team'
import Standings from './Standings'
import Calendar from './Calendar'
import Stats from './Stats'
import { Board } from './Management'
import Market from './MarketPage'
import Academy from './AcademyPage'
import LegacyScreen from './LegacyScreen'
import type { Club } from './types'
import type { SectionId } from './sections'
import { MISSION_COST } from './config'
import type { InvestArea, Notice, NoticeOption } from './config'
import { SAVE_KEY, START_BUDGET } from './data'
import { DEFAULT_LEAGUE, isLeagueId } from './leagues'
import { GAME_KEY, advance, hasCompatibleSave, initialGame, loadGame, saveGame } from './game'
import type { GameState, ScoutOrder } from './game'
import { addUserPlayer, getUserSquad, removeUserPlayer, setUserAutoLineup, swapUserStarters } from './engine'
import type { Listing, MarketOffer } from './market'
import { buyBlocker, buyPlayer, quickBuyer, quickSalePrice, sellBlocker, sellPlayer } from './market'
import type { SimPlayer } from './players'
import { MAX_SQUAD } from './squads'
import type { Tactic } from './engine'
import { seasonExpenses, seasonIncome, total } from './finance'
import { europeFinalIncome } from './euroIncome'

function loadClub(): Club | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as Club) : null
  } catch {
    return null
  }
}

function persistClub(club: Club): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(club))
  } catch {
    // Si el navegador no deja guardar, el club igual se usa en esta sesión
  }
}

export default function App() {
  // Si la partida guardada es de una versión vieja (el mundo cambió), el club arranca de cero con su presupuesto inicial
  const [club, setClub] = useState<Club | null>(() => {
    const saved = loadClub()
    return saved && !hasCompatibleSave() ? { ...saved, budget: START_BUDGET } : saved
  })
  const [game, setGame] = useState<GameState>(loadGame)
  const [section, setSection] = useState<SectionId>('inicio')
  const [moreOpen, setMoreOpen] = useState(false)

  // Autoguardado: partida y club se guardan juntos después de cada cambio
  useEffect(() => {
    saveGame(game)
    if (club) persistClub(club)
  }, [game, club])

  // Al terminar la temporada 30 se abre el legado
  useEffect(() => {
    if (game.finished) setSection('legado')
  }, [game.finished])

  function updateBudget(current: Club, delta: number) {
    const updated = { ...current, budget: current.budget + delta }
    persistClub(updated)
    setClub(updated)
  }

  function handleCreate(newClub: Club) {
    persistClub(newClub)
    setGame(initialGame(undefined, isLeagueId(newClub.leagueId) ? newClub.leagueId : DEFAULT_LEAGUE))
    setClub(newClub)
  }

  function handleReset() {
    try {
      localStorage.removeItem(SAVE_KEY)
      localStorage.removeItem(GAME_KEY)
    } catch {
      // nada
    }
    setGame(initialGame())
    setSection('inicio')
    setClub(null)
  }

  function handleImport(importedClub: Club, importedGame: GameState) {
    persistClub(importedClub)
    saveGame(importedGame)
    setClub(importedClub)
    setGame(importedGame)
    setSection('inicio')
  }

  function handleSelect(id: SectionId) {
    setSection(id)
    window.scrollTo(0, 0)
  }

  function handleAnswer(notice: Notice, option: NoticeOption) {
    if (!club || game.answers[notice.id] !== undefined) return
    const cost = option.budget ?? 0
    if (cost < 0 && club.budget + cost < 0) return
    if (cost !== 0) updateBudget(club, cost)

    let league = game.league
    if (option.addPlayer) league = addUserPlayer(league, option.addPlayer)
    if (option.removePlayerId) league = removeUserPlayer(league, option.removePlayerId)
    const leaving = option.leaveAtEndId ? [...game.leaving, option.leaveAtEndId] : game.leaving

    setGame({
      ...game,
      league,
      leaving,
      answers: { ...game.answers, [notice.id]: option.id },
    })
  }

  function handleInvest(area: InvestArea, level: number) {
    setGame({ ...game, investments: { ...game.investments, [area]: level } })
  }

  function handleScout(order: ScoutOrder) {
    if (!club || game.scoutOrder || club.budget < MISSION_COST) return
    updateBudget(club, -MISSION_COST)
    setGame({ ...game, scoutOrder: order })
  }

  function handleTactic(tactic: Tactic) {
    setGame({ ...game, tactic })
  }

  function handleSwap(idA: string, idB: string) {
    setGame({ ...game, league: swapUserStarters(game.league, idA, idB) })
  }

  function handleAutoLineup() {
    setGame({ ...game, league: setUserAutoLineup(game.league) })
  }

  /* ---------- Mercado ---------- */
  function handleBuy(listing: Listing) {
    if (!club || buyBlocker(game, club.budget, listing) !== null) return
    updateBudget(club, -listing.price)
    setGame({ ...game, league: buyPlayer(game.league, listing, game.seed) })
  }

  function completeSale(player: SimPlayer, teamId: number, amount: number) {
    if (!club || sellBlocker(game, player) !== null) return
    updateBudget(club, amount)
    setGame({
      ...game,
      league: sellPlayer(game.league, player.id, teamId, amount),
      offers: game.offers.filter((o) => o.playerId !== player.id),
      leaving: game.leaving.filter((id) => id !== player.id),
    })
  }

  function handleSell(player: SimPlayer) {
    completeSale(player, quickBuyer(game, player.id).id, quickSalePrice(player))
  }

  function handleAcceptOffer(offer: MarketOffer) {
    const player = getUserSquad(game.league).find((p) => p.id === offer.playerId)
    if (player) completeSale(player, offer.teamId, offer.amount)
  }

  function handleRejectOffer(offer: MarketOffer) {
    setGame({ ...game, offers: game.offers.filter((o) => o.id !== offer.id) })
  }

  /* ---------- Cantera ---------- */
  function handlePromote(player: SimPlayer) {
    if (getUserSquad(game.league).length >= MAX_SQUAD) return
    setGame({
      ...game,
      league: addUserPlayer(game.league, player),
      academy: game.academy.filter((p) => p.id !== player.id),
    })
  }

  function handleRelease(player: SimPlayer) {
    setGame({ ...game, academy: game.academy.filter((p) => p.id !== player.id) })
  }

  function handleContinue() {
    // Al salir del Cierre se aplica el balance de la temporada (con la posición final)
    if (club && game.eventId === null && game.baseStop === 'cierre') {
      const net = total(seasonIncome(game)) - total(seasonExpenses(game))
      updateBudget(club, net)
    }
    // Al terminar el torneo europeo se cobran las eliminatorias y el título (lo anterior ya entró con el balance del cierre)
    if (club && game.eventId === 'torneo') {
      const prize = total(europeFinalIncome(game))
      if (prize > 0) updateBudget(club, prize)
    }
    // La táctica está oculta por ahora: siempre se juega 'equilibrada'
    setGame(advance(game.tactic === 'equilibrada' ? game : { ...game, tactic: 'equilibrada' }))
    window.scrollTo(0, 0)
  }

  if (!club) return <CreateClub onCreate={handleCreate} />

  const pendingNotices = game.notices.filter((n) => game.answers[n.id] === undefined).length

  function renderSection(c: Club) {
    switch (section) {
      case 'inicio':
        return <Dashboard club={c} game={game} onGoTo={handleSelect} />
      case 'parada':
        return (
          <StopScreen
            club={c}
            game={game}
            onAnswer={handleAnswer}
            onContinue={handleContinue}
            onTactic={handleTactic}
            onGoTo={handleSelect}
          />
        )
      case 'equipo':
        return <Team club={c} league={game.league} onSwap={handleSwap} onAutoLineup={handleAutoLineup} />
      case 'tabla':
        return <Standings club={c} league={game.league} />
      case 'calendario':
        return <Calendar club={c} league={game.league} />
      case 'mercado':
        return (
          <Market
            club={c}
            game={game}
            onBuy={handleBuy}
            onSell={handleSell}
            onAcceptOffer={handleAcceptOffer}
            onRejectOffer={handleRejectOffer}
          />
        )
      case 'cantera':
        return <Academy club={c} game={game} onPromote={handlePromote} onRelease={handleRelease} onScout={handleScout} />
      case 'finanzas':
        return <FinancesLive club={c} game={game} onInvest={handleInvest} />
      case 'directiva':
        return <Board club={c} />
      case 'estadisticas':
        return <Stats club={c} league={game.league} />
      case 'legado':
        return <LegacyScreen club={c} game={game} onImport={handleImport} onNewGame={handleReset} />
    }
  }

  return (
    <div className="app">
      <div className="main">
        <div className="head">
          <TopBar club={club} game={game} onBudget={() => handleSelect('finanzas')} onMenu={() => setMoreOpen(true)} />
          <Sidebar current={section} onSelect={handleSelect} onReset={handleReset} />
        </div>
        <main className="content">{renderSection(club)}</main>
      </div>
      {/* Móvil: botón principal fijo sobre la barra inferior. En la Parada lo pone la propia pantalla (Simular/Continuar). */}
      {section !== 'parada' && (
        <ActionBar
          icon="🚩"
          label={game.finished ? 'Ver el legado' : pendingNotices > 0 ? `Ir a la parada (${pendingNotices})` : 'Ir a la parada'}
          onClick={() => handleSelect(game.finished ? 'legado' : 'parada')}
        />
      )}
      <MobileNav current={section} onSelect={handleSelect} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onSelect={handleSelect} onReset={handleReset} />
    </div>
  )
}

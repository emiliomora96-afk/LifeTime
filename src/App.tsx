import { useEffect, useState } from 'react'
import CreateClub from './CreateClub'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Dashboard from './Dashboard'
import StopScreen from './StopScreen'
import FinancesLive from './FinancesLive'
import Team from './Team'
import Standings from './Standings'
import Calendar from './Calendar'
import Stats from './Stats'
import { Board, Market, Youth } from './Management'
import type { Club } from './types'
import type { SectionId } from './sections'
import { MISSION_COST } from './config'
import type { InvestArea, Notice, NoticeOption } from './config'
import { SAVE_KEY } from './data'
import { GAME_KEY, advance, initialGame, loadGame, saveGame } from './game'
import type { GameState, ScoutOrder } from './game'
import { addUserPlayer, removeUserPlayer, setUserAutoLineup, swapUserStarters } from './engine'
import type { Tactic } from './engine'
import { seasonExpenses, seasonIncome, total } from './finance'

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
  const [club, setClub] = useState<Club | null>(loadClub)
  const [game, setGame] = useState<GameState>(loadGame)
  const [section, setSection] = useState<SectionId>('inicio')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    saveGame(game)
  }, [game])

  function updateBudget(current: Club, delta: number) {
    const updated = { ...current, budget: current.budget + delta }
    persistClub(updated)
    setClub(updated)
  }

  function handleCreate(newClub: Club) {
    persistClub(newClub)
    setGame(initialGame())
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
    setMenuOpen(false)
    setClub(null)
  }

  function handleSelect(id: SectionId) {
    setSection(id)
    setMenuOpen(false)
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

  function handleContinue() {
    // Al salir del Cierre se aplica el balance de la temporada (con la posición final)
    if (club && game.eventId === null && game.baseStop === 'cierre') {
      const net = total(seasonIncome(game)) - total(seasonExpenses(game))
      updateBudget(club, net)
    }
    setGame(advance(game))
    window.scrollTo(0, 0)
  }

  if (!club) return <CreateClub onCreate={handleCreate} />

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
            onInvest={handleInvest}
            onScout={handleScout}
            onTactic={handleTactic}
          />
        )
      case 'equipo':
        return <Team club={c} league={game.league} onSwap={handleSwap} onAutoLineup={handleAutoLineup} />
      case 'tabla':
        return <Standings club={c} league={game.league} />
      case 'calendario':
        return <Calendar club={c} league={game.league} />
      case 'mercado':
        return <Market />
      case 'cantera':
        return <Youth />
      case 'finanzas':
        return <FinancesLive club={c} game={game} onInvest={handleInvest} />
      case 'directiva':
        return <Board club={c} />
      case 'estadisticas':
        return <Stats club={c} league={game.league} />
    }
  }

  return (
    <div className="app">
      <Sidebar
        current={section}
        open={menuOpen}
        onSelect={handleSelect}
        onClose={() => setMenuOpen(false)}
        onReset={handleReset}
      />
      <div className="main">
        <TopBar club={club} game={game} onMenu={() => setMenuOpen(true)} />
        <main className="content">{renderSection(club)}</main>
      </div>
    </div>
  )
}

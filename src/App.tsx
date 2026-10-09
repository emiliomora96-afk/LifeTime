import { useState } from 'react'
import CreateClub from './CreateClub'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Dashboard from './Dashboard'
import type { Club } from './types'
import { SECTIONS } from './sections'
import type { SectionId } from './sections'
import { SAVE_KEY } from './data'

function loadClub(): Club | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as Club) : null
  } catch {
    return null
  }
}

function SectionPlaceholder({ id }: { id: SectionId }) {
  const section = SECTIONS.find((s) => s.id === id)
  return (
    <div className="card">
      <h2>
        {section?.icon} {section?.label}
      </h2>
      <p>Esta sección se diseña en el Paso 3, con datos de ejemplo.</p>
    </div>
  )
}

export default function App() {
  const [club, setClub] = useState<Club | null>(loadClub)
  const [section, setSection] = useState<SectionId>('inicio')
  const [menuOpen, setMenuOpen] = useState(false)

  function handleCreate(newClub: Club) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(newClub))
    } catch {
      // Si el navegador no deja guardar, el club igual se usa en esta sesión
    }
    setClub(newClub)
  }

  function handleReset() {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      // nada
    }
    setSection('inicio')
    setMenuOpen(false)
    setClub(null)
  }

  function handleSelect(id: SectionId) {
    setSection(id)
    setMenuOpen(false)
  }

  if (!club) return <CreateClub onCreate={handleCreate} />

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
        <TopBar club={club} onMenu={() => setMenuOpen(true)} />
        <main className="content">
          {section === 'inicio' ? (
            <Dashboard club={club} onGoTo={handleSelect} />
          ) : (
            <SectionPlaceholder id={section} />
          )}
        </main>
      </div>
    </div>
  )
}
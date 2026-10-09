import { useState } from 'react'
import CreateClub from './CreateClub'
import Crest from './Crest'
import type { Club } from './types'
import { SAVE_KEY, formatMoney } from './data'

function loadClub(): Club | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as Club) : null
  } catch {
    return null
  }
}

export default function App() {
  const [club, setClub] = useState<Club | null>(loadClub)

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
    setClub(null)
  }

  if (!club) return <CreateClub onCreate={handleCreate} />

  // Pantalla temporal: en el Paso 2 se reemplaza por la página principal
  return (
    <div className="screen">
      <div className="card created">
        <Crest name={club.name} shape={club.crestShape} primary={club.primaryColor} secondary={club.secondaryColor} size={130} />
        <h1>{club.name}</h1>
        <p className="subtitle">
          {club.city} · {club.stadium} · {club.division}.ª división de {club.league}
        </p>
        <p>Presupuesto: {formatMoney(club.budget)}</p>
        <p className="hint">Club creado y guardado. La página principal llega en el Paso 2.</p>
        <button type="button" className="btn secondary" onClick={handleReset}>
          Borrar club y empezar de nuevo
        </button>
      </div>
    </div>
  )
}
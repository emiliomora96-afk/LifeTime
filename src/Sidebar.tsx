import { SECTIONS } from './sections'
import type { SectionId } from './sections'

interface Props {
  current: SectionId
  open: boolean
  onSelect: (id: SectionId) => void
  onClose: () => void
  onReset: () => void
}

export default function Sidebar({ current, open, onSelect, onClose, onReset }: Props) {
  function handleReset() {
    if (window.confirm('¿Borrar el club y empezar una partida nueva? Se pierde el progreso.')) {
      onReset()
    }
  }

  return (
    <>
      {open && <div className="overlay" onClick={onClose} />}
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">LIFETIME</div>
        <nav className="nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'nav-item' + (current === s.id ? ' active' : '')}
              onClick={() => onSelect(s.id)}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="nav-item" onClick={handleReset}>
            <span>🗑️</span>
            Nueva partida
          </button>
        </div>
      </aside>
    </>
  )
}
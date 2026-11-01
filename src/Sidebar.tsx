import { useRef } from 'react'
import { MENU, SECTIONS, SUB_LABEL, menuOf } from './sections'
import type { SectionId } from './sections'

interface Props {
  current: SectionId
  onSelect: (id: SectionId) => void
  onReset: () => void
}

// Menú horizontal, justo encima del contenido. Equipo, Competición y Club agrupan sus secciones en subpestañas.
export default function Sidebar({ current, onSelect, onReset }: Props) {
  const group = menuOf(current)
  // Al volver a una entrada se abre la última subpestaña que se estaba usando
  const last = useRef<Record<string, SectionId>>({})
  last.current[group.id] = current

  function handleReset() {
    if (window.confirm('¿Borrar el club y empezar una partida nueva? Se pierde el progreso.')) {
      onReset()
    }
  }

  return (
    <nav className="navbar" aria-label="Menú principal">
      <div className="navbar-row">
        <div className="brand">LIFETIME</div>
        <div className="nav-tabs">
          {MENU.map((m) => (
            <button
              key={m.id}
              type="button"
              className={'nav-item' + (m.id === group.id ? ' active' : '')}
              onClick={() => onSelect(last.current[m.id] ?? m.children[0])}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" className="nav-reset" title="Nueva partida" onClick={handleReset}>
          <span>🗑️</span>
          <em>Nueva partida</em>
        </button>
      </div>
      {group.children.length > 1 && (
        <div className={'subnav' + (group.id === 'equipo' ? ' subnav-dup' : '')}>
          {group.children.map((id) => {
            const section = SECTIONS.find((x) => x.id === id)
            return (
              <button
                key={id}
                type="button"
                className={'sub-item' + (id === current ? ' active' : '')}
                onClick={() => onSelect(id)}
              >
                <span>{section?.icon}</span>
                {SUB_LABEL[id] ?? section?.label}
              </button>
            )
          })}
        </div>
      )}
    </nav>
  )
}

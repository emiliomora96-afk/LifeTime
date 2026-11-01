import type { ReactNode } from 'react'
import type { SectionId } from './sections'

interface Item {
  id: string
  label: string
  go: SectionId
  /** Secciones que dejan este botón marcado */
  match: SectionId[]
  icon: ReactNode
}

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const ITEMS: Item[] = [
  { id: 'inicio', label: 'Inicio', go: 'inicio', match: ['inicio'], icon: svg(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>) },
  { id: 'plantilla', label: 'Plantilla', go: 'equipo', match: ['equipo'], icon: svg(<><path d="M8 3l-5 3 2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z" /></>) },
  { id: 'mercado', label: 'Mercado', go: 'mercado', match: ['mercado'], icon: svg(<><path d="M7 7h13l-3-3" /><path d="M17 17H4l3 3" /></>) },
  { id: 'cantera', label: 'Cantera', go: 'cantera', match: ['cantera'], icon: svg(<><path d="M12 21v-8" /><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z" /><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z" /></>) },
  { id: 'competiciones', label: 'Competiciones', go: 'tabla', match: ['tabla', 'calendario'], icon: svg(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4v1a4 4 0 0 0 4 4" /><path d="M16 6h4v1a4 4 0 0 1-4 4" /><path d="M12 13v4" /><path d="M8 20h8" /></>) },
]

interface Props {
  current: SectionId
  onSelect: (id: SectionId) => void
}

// Barra inferior fija (solo móvil): 5 secciones con icono y etiqueta.
export default function MobileNav({ current, onSelect }: Props) {
  return (
    <nav className="mobile-nav only-mobile" aria-label="Secciones">
      {ITEMS.map((it) => {
        const active = it.match.includes(current)
        return (
          <button
            key={it.id}
            type="button"
            className={'mnav-item' + (active ? ' active' : '')}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(it.go)}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

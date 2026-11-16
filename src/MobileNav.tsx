import type { SectionId } from './sections'
import inicioImg from './assets/nav/inicio.webp'
import plantillaImg from './assets/nav/plantilla.webp'
import mercadoImg from './assets/nav/mercado.webp'
import canteraImg from './assets/nav/cantera.webp'
import competicionesImg from './assets/nav/competiciones.webp'

interface Item {
  id: string
  label: string
  go: SectionId
  /** Secciones que dejan este botón marcado */
  match: SectionId[]
  icon: string
}

const ITEMS: Item[] = [
  { id: 'inicio', label: 'Inicio', go: 'inicio', match: ['inicio'], icon: inicioImg },
  { id: 'plantilla', label: 'Plantilla', go: 'equipo', match: ['equipo'], icon: plantillaImg },
  { id: 'mercado', label: 'Mercado', go: 'mercado', match: ['mercado'], icon: mercadoImg },
  { id: 'cantera', label: 'Cantera', go: 'cantera', match: ['cantera'], icon: canteraImg },
  { id: 'competiciones', label: 'Competiciones', go: 'tabla', match: ['tabla', 'calendario'], icon: competicionesImg },
]

interface Props {
  current: SectionId
  onSelect: (id: SectionId) => void
}

// Barra inferior fija (solo móvil): 5 secciones con icono 3D enmarcado y etiqueta.
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
            <span className="mnav-frame" aria-hidden="true">
              <img className="mnav-icon" src={it.icon} alt="" width={192} height={192} draggable={false} />
            </span>
            <span className="mnav-label">{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

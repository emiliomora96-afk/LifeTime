import { useEffect } from 'react'
import type { SectionId } from './sections'
import Button from './Button'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (id: SectionId) => void
  onReset: () => void
}

const LINKS: { id: SectionId; icon: string; label: string; note: string }[] = [
  { id: 'parada', icon: '🚩', label: 'Parada actual', note: 'Avisos y decisiones' },
  { id: 'finanzas', icon: '💰', label: 'Finanzas', note: 'Presupuesto e inversiones' },
  { id: 'directiva', icon: '🏛️', label: 'Directiva', note: 'Objetivos del club' },
  { id: 'estadisticas', icon: '🏆', label: 'Estadísticas y premios', note: 'Goleadores y títulos' },
  { id: 'legado', icon: '📜', label: 'Palmarés y legado', note: 'Historia del club' },
]

// Hoja desde abajo con las secciones que no caben en la barra inferior (solo móvil).
export default function MoreSheet({ open, onClose, onSelect, onReset }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-wrap only-mobile" role="dialog" aria-modal="true" aria-label="Más secciones">
      <button type="button" className="sheet-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grip" aria-hidden="true" />
        <ul className="sheet-list">
          {LINKS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="sheet-link"
                onClick={() => {
                  onSelect(l.id)
                  onClose()
                }}
              >
                <span className="sheet-ico" aria-hidden="true">{l.icon}</span>
                <span className="sheet-txt">
                  <strong>{l.label}</strong>
                  <small>{l.note}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="danger"
          block
          icon="🗑️"
          onClick={() => {
            if (window.confirm('¿Borrar el club y empezar una partida nueva? Se pierde el progreso.')) {
              onClose()
              onReset()
            }
          }}
        >
          Nueva partida
        </Button>
      </div>
    </div>
  )
}

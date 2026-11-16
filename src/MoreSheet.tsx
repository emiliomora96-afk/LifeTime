import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { SectionId } from './sections'
import Button from './Button'
import paradaImg from './assets/nav/parada.webp'
import finanzasImg from './assets/nav/finanzas.webp'
import directivaImg from './assets/nav/directiva.webp'
import estadisticasImg from './assets/nav/estadisticas.webp'
import legadoImg from './assets/nav/legado.webp'
import reiniciarImg from './assets/nav/reiniciar.webp'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (id: SectionId) => void
  onReset: () => void
}

const LINKS: { id: SectionId; icon: string; label: string; note: string; accent: string }[] = [
  { id: 'parada', icon: paradaImg, label: 'Parada actual', note: 'Avisos y decisiones', accent: '#fb7185' },
  { id: 'finanzas', icon: finanzasImg, label: 'Finanzas', note: 'Presupuesto e inversiones', accent: '#f59e0b' },
  { id: 'directiva', icon: directivaImg, label: 'Directiva', note: 'Objetivos del club', accent: '#4ade80' },
  { id: 'estadisticas', icon: estadisticasImg, label: 'Estadísticas y premios', note: 'Goleadores y títulos', accent: '#facc15' },
  { id: 'legado', icon: legadoImg, label: 'Palmarés y legado', note: 'Historia del club', accent: '#fdba74' },
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
          {LINKS.map((l, i) => (
            <li key={l.id} style={{ '--acc': l.accent, '--i': i } as CSSProperties}>
              <button
                type="button"
                className="sheet-link"
                onClick={() => {
                  onSelect(l.id)
                  onClose()
                }}
              >
                <span className="sheet-ico" aria-hidden="true">
                  <img src={l.icon} alt="" width={192} height={192} draggable={false} />
                </span>
                <span className="sheet-txt">
                  <strong>{l.label}</strong>
                  <small>{l.note}</small>
                </span>
                <span className="sheet-chev" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="danger"
          block
          icon={<img className="sheet-reset-ico" src={reiniciarImg} alt="" width={192} height={192} draggable={false} />}
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

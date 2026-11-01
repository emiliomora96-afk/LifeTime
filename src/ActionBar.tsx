import type { ReactNode } from 'react'
import Button from './Button'

interface Props {
  label: string
  /** Texto pequeño debajo del botón (por ejemplo, por qué está desactivado) */
  note?: string
  icon?: ReactNode
  disabled?: boolean
  onClick: () => void
}

// Botón principal de acción, fijo sobre la barra de navegación (solo móvil). Siempre en el mismo lugar.
export default function ActionBar({ label, note, icon = '▶', disabled, onClick }: Props) {
  return (
    <div className="action-bar only-mobile">
      <Button variant="primary" size="lg" block icon={icon} disabled={disabled} onClick={onClick}>
        {label}
      </Button>
      {note ? <p className="action-note">{note}</p> : null}
    </div>
  )
}

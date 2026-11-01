import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = degradado con relieve · secondary = contorno · danger = acciones destructivas */
  variant?: ButtonVariant
  /** md = 48 px (por defecto) · sm = 44 px (dentro de filas) · lg = 56 px (acción principal) */
  size?: 'sm' | 'md' | 'lg'
  /** Ocupa todo el ancho */
  block?: boolean
  /** Icono a la izquierda (emoji, texto o <svg>) */
  icon?: ReactNode
}

// Botón único del juego. Los botones antiguos (.btn, .btn.secondary, .mini-btn, .mini-btn.danger…) ya
// se ven igual por CSS (ui.css); este componente es para el código nuevo.
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  const cls = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block ? 'ui-btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} {...rest}>
      {icon ? (
        <span className="ui-btn-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ui-btn-label">{children}</span>
    </button>
  )
}

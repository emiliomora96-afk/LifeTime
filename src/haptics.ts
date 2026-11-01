// Vibración breve en los botones importantes (solo si el dispositivo lo permite y no se pidió menos movimiento).
type Kind = 'tap' | 'confirm' | 'danger'

const PATTERNS: Record<Kind, number | number[]> = {
  tap: 8,
  confirm: 14,
  danger: [16, 40, 16],
}

export function haptic(kind: Kind = 'tap'): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    navigator.vibrate(PATTERNS[kind])
  } catch {
    // sin vibración: no pasa nada
  }
}

// Un solo "oyente" para todo el juego: los botones principales y de peligro (.btn sin .secondary, .ui-btn--primary,
// .ui-btn--danger, .ficha-swap) vibran al tocarlos; también cualquier elemento con data-haptic="confirm|danger|tap".
// Así los botones antiguos (className="btn ...") no hay que tocarlos uno por uno.
export function installHaptics(): void {
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-haptic], .btn, .ui-btn, .ficha-swap, .mini-btn.danger',
      )
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return
      const explicit = el.dataset.haptic as Kind | undefined
      if (explicit) return haptic(explicit)
      if (el.matches('.ui-btn--danger, .danger')) return haptic('danger')
      if (el.matches('.ui-btn--secondary, .btn.secondary')) return
      haptic('confirm')
    },
    { capture: true },
  )
}

import { useEffect, useRef } from 'react'
import './champions.css'
import { INTRO_H, INTRO_MS, INTRO_W, drawIntro } from './clDraw'
import trophySrc from './assets/trophies/champions.png'

/* Animación de inicio de la Lifetime Champions League (5 s):
   0-1,5 s focos que se encienden y el trofeo en silueta · 1,5-4 s zoom lento con destellos · 4-5 s aparece el nombre.
   Solo dibuja; al terminar llama a onDone. */
interface Props {
  title: string
  onDone: () => void
}

export default function ChampionsIntro({ title, onDone }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) {
      done.current()
      return
    }
    // Resolución interna fija 320x427 (por devicePixelRatio); la página solo la escala con CSS
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(INTRO_W * dpr)
    cv.height = Math.round(INTRO_H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let cancelled = false
    let finished = false
    let t0 = -1
    const img = new Image()

    const frame = (now: number) => {
      if (cancelled) return
      if (t0 < 0) t0 = now
      const ms = now - t0
      drawIntro(ctx, INTRO_W, INTRO_H, ms, title, img)
      if (ms >= INTRO_MS) {
        if (!finished) {
          finished = true
          done.current()
        }
        return
      }
      raf = requestAnimationFrame(frame)
    }
    // El reloj arranca cuando el trofeo ya está listo (casi siempre ya está en caché); si falla, se usa la copa dibujada
    const start = () => {
      if (!cancelled) raf = requestAnimationFrame(frame)
    }
    img.onload = start
    img.onerror = start
    img.src = trophySrc
    if (img.complete) start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [title])

  return (
    <div className="cl-intro" role="img" aria-label={title}>
      <canvas ref={canvas} className="cl-canvas" />
    </div>
  )
}

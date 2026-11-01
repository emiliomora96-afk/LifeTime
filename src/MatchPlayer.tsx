import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TGoal } from './tournament'
import type { MatchTimeline } from './clTimeline'
import { HALF_LABEL, PRE_TREMBLE_SECONDS, REBOUND_SECONDS, buildScript, dominanceAt } from './clTimeline'
import type { Frame, WedgeState } from './clDraw'
import { FIELD_H, FIELD_W, drawMatch, drawPenalty } from './clDraw'

/* Reproduce la línea de tiempo del motor en un <canvas>. No decide nada: solo la dibuja.
   El partido no se puede saltar. */

interface Props {
  timeline: MatchTimeline
  goals: TGoal[]
  names: [string, string]
  colors: [string, string]
  crests: [ReactNode, ReactNode]
  label: string // ronda (“Fase de liga · Jornada 3”)
  onDone: () => void
}

interface View {
  hg: number
  ag: number
  clock: string
  tag: string // tiempo o cartel
  scorer: string | null // gol en curso
  pens: [number, number] | null
  kicks: [string[], string[]] | null
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export default function MatchPlayer({ timeline, goals, names, colors, crests, label, onDone }: Props) {
  const script = useMemo(() => buildScript(timeline), [timeline])
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  const [view, setView] = useState<View>({ hg: 0, ag: 0, clock: "0'", tag: HALF_LABEL.h1, scorer: null, pens: null, kicks: null })

  useEffect(() => {
    const cv = canvas.current
    const st = stage.current
    const ctx = cv?.getContext('2d')
    if (!cv || !st || !ctx) return
    const calm = reducedMotion() ? 0.25 : 1
    // Resolución interna fija 340x420 (por devicePixelRatio); la página solo lo escala con CSS
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(FIELD_W * dpr)
    cv.height = Math.round(FIELD_H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Los efectos del gol se acortan junto con su pausa (3 s en modo completo, 1,5 s en rápido)
    const fx = script.pause / 3

    let raf = 0
    let t0 = -1
    let last = 0
    let dom = 0
    let key = ''
    let finished = false
    let idx = 0
    const segs = script.segs

    const frame = (now: number) => {
      if (t0 < 0) t0 = now
      const ms = now - t0
      const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000))
      last = now

      if (ms >= script.total && !finished) {
        finished = true
        done.current()
      }
      const at = Math.min(ms, script.total - 0.001)
      while (idx < segs.length - 1 && at >= segs[idx].end) idx++
      const seg = segs[idx]
      const half = timeline.halves[seg.half]
      const prog = (at - seg.start) / Math.max(1, seg.end - seg.start)

      // Tiempo de juego dentro del tiempo (segundos de pantalla)
      let gameT: number
      if (seg.kind === 'play') gameT = (seg.t0 + (seg.t1 - seg.t0) * prog) * half.seconds
      else if (seg.kind === 'goal') gameT = seg.t0 * half.seconds
      else gameT = half.seconds + (at - seg.start) / 1000

      // Dominio suavizado: la línea de frente nunca salta
      const target = dominanceAt(half, Math.min(1, gameT / half.seconds))
      dom += (target - dom) * (1 - Math.exp(-dt / 0.3))

      // Contraataques visibles ahora
      const wedges: WedgeState[] = []
      half.counters.forEach((c, i) => {
        const start = c.t * half.seconds
        const dur = 1 / c.speed
        const end = start + dur
        const base = { attacker: c.side, lane: c.lane, result: c.result, fail: c.fail, seed: seg.half * 100 + i * 7 + 1 }
        if (gameT < start - PRE_TREMBLE_SECONDS) return
        if (gameT < start) wedges.push({ ...base, phase: 'pre', pre: (gameT - (start - PRE_TREMBLE_SECONDS)) / PRE_TREMBLE_SECONDS, u: 0, tau: 0 })
        else if (gameT < end) wedges.push({ ...base, phase: 'run', pre: 0, u: (gameT - start) / dur, tau: 0 })
        else if (gameT - end < Math.max(REBOUND_SECONDS, 0.5)) wedges.push({ ...base, phase: 'post', pre: 0, u: 1, tau: gameT - end })
      })

      // Temblores: tiro = corto, gol = fuerte que se apaga
      let pitch = 0
      let arena = 0
      let flash = 0
      let flashSide: 0 | 1 | null = null
      for (const im of script.impacts) {
        const tau = (at - im.ms) / 1000 / fx
        if (tau < 0) break
        if (im.kind === 'shot' && tau < 0.45) pitch += 3.2 * Math.exp(-tau / 0.13)
        if (im.kind === 'goal' && tau < 2.4) {
          const a = 14 * Math.exp(-tau / 0.8)
          pitch += a
          arena += a * 0.55
          if (tau < 1.4) {
            const f = Math.exp(-tau / 0.45)
            if (f > flash) {
              flash = f
              flashSide = im.side
            }
          }
        }
      }
      const time = at / 1000
      const wob = (a: number, p: number): [number, number] => [Math.sin(time * 95 + p) * a * calm, Math.cos(time * 83 + p * 2) * a * 0.7 * calm]
      const shake = wob(pitch, 0)
      const big = wob(arena, 1.7)
      st.style.transform = arena > 0.2 ? `translate(${big[0].toFixed(1)}px, ${big[1].toFixed(1)}px)` : ''

      if (seg.kind === 'kick') {
        drawPenalty(ctx, { w: FIELD_W, h: FIELD_H, kick: timeline.kicks[seg.kick], p: prog, colors, time, shake })
      } else {
        const f: Frame = { w: FIELD_H, h: FIELD_W, colors, dom, time, wedges, shake, flash: flash * calm, flashSide, mood: Math.min(1, 0.25 + flash * 0.75) }
        drawMatch(ctx, f)
      }

      // Marcador, reloj y carteles (solo se actualiza lo que cambia)
      let clock = "0'"
      let tag = HALF_LABEL[half.id]
      let scorer: string | null = null
      if (seg.kind === 'play' || seg.kind === 'goal') {
        const [m0, m1] = { h1: [0, 45], h2: [45, 90], e1: [90, 105], e2: [105, 120] }[half.id]
        const frac = seg.kind === 'goal' ? seg.t0 : seg.t0 + (seg.t1 - seg.t0) * prog
        clock = `${seg.kind === 'goal' ? goals[seg.goal].minute : Math.max(m0 + 1, Math.ceil(m0 + frac * (m1 - m0)))}'`
        if (seg.kind === 'goal') {
          const g = goals[seg.goal]
          scorer = `${g.scorer.name}${g.assist ? ` · asist. ${g.assist.name}` : ''}`
        }
      } else if (seg.kind === 'break') {
        tag = seg.label
        clock = ''
      } else {
        tag = 'Penales'
        clock = ''
      }
      let pens: View['pens'] = null
      let kicks: View['kicks'] = null
      if (timeline.kicks.length > 0 && (seg.kind === 'kick' || (seg.kind === 'break' && seg.label === 'Penales'))) {
        const upto = seg.kind === 'kick' ? seg.kick + (prog >= 0.62 ? 1 : 0) : 0
        const p: [number, number] = [0, 0]
        const k: [string[], string[]] = [[], []]
        timeline.kicks.slice(0, upto).forEach((x) => {
          if (x.scored) p[x.side]++
          k[x.side].push(x.scored ? '●' : '○')
        })
        pens = p
        kicks = k
      }
      const next: View = { hg: seg.score[0], ag: seg.score[1], clock, tag, scorer, pens, kicks }
      const nk = JSON.stringify(next)
      if (nk !== key) {
        key = nk
        setView(next)
      }
      if (!finished) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      st.style.transform = ''
    }
  }, [script, timeline, goals, colors])

  return (
    <div className="cl-player">
      <div className="cl-label">{label}</div>
      <div className="cl-board">
        <div className="cl-team">
          {crests[0]}
          <strong>{names[0]}</strong>
        </div>
        <div className="cl-scorebox">
          <div className="cl-score">
            <b key={'h' + view.hg} className={view.hg > 0 ? 'bump' : ''}>{view.hg}</b>
            <i>–</i>
            <b key={'a' + view.ag} className={view.ag > 0 ? 'bump' : ''}>{view.ag}</b>
          </div>
          <div className="cl-clock">
            {view.clock && <span>{view.clock}</span>} {view.tag}
          </div>
        </div>
        <div className="cl-team right">
          {crests[1]}
          <strong>{names[1]}</strong>
        </div>
      </div>
      {view.kicks && view.pens && (
        <div className="cl-shootout" aria-label="Tanda de penales">
          <span>{view.kicks[0].join(' ') || '·'}</span>
          <b>
            {view.pens[0]} – {view.pens[1]}
          </b>
          <span>{view.kicks[1].join(' ') || '·'}</span>
        </div>
      )}
      <div className="cl-stage" ref={stage}>
        <canvas ref={canvas} className="cl-canvas" />
        {view.scorer && (
          <div className="cl-goal" key={view.hg + '-' + view.ag} style={{ animationDuration: `${script.pause}s` }}>
            <strong>¡GOL!</strong>
            <span>{view.scorer}</span>
          </div>
        )}
      </div>
    </div>
  )
}

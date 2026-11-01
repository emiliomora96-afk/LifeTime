import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './champions.css'
import type { Club, CrestShape } from './types'
import type { SeasonRecord } from './game'
import Crest from './Crest'
import { activeLeague } from './activeLeague'
import type { Entrant } from './europe'
import { COUNTRY_NAMES, entrantName, europeInfo } from './europe'
import { REACH_LABEL, TAG_LABEL } from './tournament'
import type { TPlayer } from './tournament'
import type { ClMatch, ClState } from './champions'
import {
  CL_DIRECT,
  CL_LEAGUE_MATCHES,
  CL_PLAYOFF_LAST,
  CL_STAGES,
  CL_STAGE_LABEL,
  CL_STAGE_SHORT,
  clAchievements,
  clChampionEntrant,
  clHeadline,
  clMatchOutcome,
  clPathOf,
  clReach,
  clScorers,
  clSuspenseLine,
  clTable,
  clTieOf,
  clUser,
  clUserMatches,
  clUserPosition,
} from './champions'
import { INTRO_H, INTRO_MS, INTRO_W, drawIntro, fieldColors } from './clDraw'
import { QUICK_GOAL_MS, QUICK_SUSPENSE_SECONDS, SPEED, isAnimated } from './clTimeline'
import MatchPlayer from './MatchPlayer'
import TrophyImg from './TrophyImg'

// El avance dentro de la competición sobrevive a cambiar de sección (se reinicia al recargar la página)
const progress = new Map<string, number>()

const SHAPES: CrestShape[] = ['classic', 'round', 'modern']
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface View {
  s: ClState
  club: Club
  byId: Map<string, Entrant>
  me: Entrant
}

const nameOf = (v: View, id: string): string => {
  const e = v.byId.get(id)
  return e ? entrantName(e, v.club.name) : id
}

function ClubCrest({ e, club, size }: { e: Entrant; club: Club; size: number }) {
  return e.user ? (
    <Crest name={club.name} shape={club.crestShape} primary={club.primaryColor} secondary={club.secondaryColor} size={size} />
  ) : (
    <Crest name={e.name} shape={SHAPES[hash(e.id) % 3]} primary={e.colors[0]} secondary={e.colors[1]} size={size} />
  )
}

const colorsOf = (e: Entrant, club: Club): [string, string] => (e.user ? [club.primaryColor, club.secondaryColor] : e.colors)

function Face({ colors }: { colors: [string, string] }) {
  return (
    <svg className="cl-face" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="14" fill={colors[0]} />
      <circle cx="50" cy="38" r="16" fill={colors[1]} opacity="0.95" />
      <path d="M16 100 C16 70 32 60 50 60 C68 60 84 70 84 100 Z" fill={colors[1]} opacity="0.95" />
    </svg>
  )
}

/* ---------- Barra de rondas ---------- */
function Strip({ current, out }: { current: number; out: boolean }) {
  return (
    <div className="cl-strip">
      {CL_STAGES.map((s, i) => (
        <span key={s} className={'cl-pill' + (i < current ? ' done' : i === current ? (out ? ' out' : ' current') : '')}>
          {CL_STAGE_SHORT[s]}
        </span>
      ))}
    </div>
  )
}

function Top({ stageIndex, out, extra }: { stageIndex: number; out: boolean; extra?: string }) {
  const info = europeInfo('champions')
  return (
    <div className="cl-top">
      <span className="cl-comp">
        {info.icon} {info.name}
      </span>
      <Strip current={stageIndex} out={out} />
      {extra && <span className="cl-count">{extra}</span>}
    </div>
  )
}

/* ---------- Animación de inicio (5 s) ---------- */
function Intro({ onDone }: { onDone: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const canvas = cv.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const title = europeInfo('champions').name
    // Resolución interna fija (por devicePixelRatio); el marco lo escala solo con CSS
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(INTRO_W * dpr)
    canvas.height = Math.round(INTRO_H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0
    let t0 = -1
    let finished = false
    const loop = (now: number) => {
      if (t0 < 0) t0 = now
      const ms = now - t0
      drawIntro(ctx, INTRO_W, INTRO_H, ms, title)
      if (ms >= INTRO_MS) {
        if (!finished) {
          finished = true
          done.current()
        }
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="cl-intro" role="img" aria-label={europeInfo('champions').name}>
      <canvas ref={cv} className="cl-canvas" />
    </div>
  )
}

/* ---------- Tabla de la fase de liga ---------- */
function LeagueTable({ v, upTo }: { v: View; upTo?: number }) {
  const rows = useMemo(() => clTable(v.s.entrants, v.s.league, upTo ?? Infinity), [v.s, upTo])
  return (
    <div className="cl-tablewrap">
      <table className="cl-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Club</th>
            <th>PJ</th>
            <th>DG</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const e = v.byId.get(r.id)
            const zone = i < CL_DIRECT ? 'direct' : i < CL_PLAYOFF_LAST ? 'playoff' : 'out'
            return (
              <tr key={r.id} className={`${zone}${r.id === v.me.id ? ' me' : ''}`}>
                <td>{i + 1}</td>
                <td>
                  <div className="cl-teamcell">
                    {e && <ClubCrest e={e} club={v.club} size={14} />}
                    {nameOf(v, r.id)}
                  </div>
                </td>
                <td>{r.played}</td>
                <td>
                  {r.gf - r.ga > 0 ? '+' : ''}
                  {r.gf - r.ga}
                </td>
                <td>
                  <strong>{r.points}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="cl-legend">
        <span className="direct">1-{CL_DIRECT} octavos</span>
        <span className="playoff">
          {CL_DIRECT + 1}-{CL_PLAYOFF_LAST} playoff
        </span>
        <span className="out">{CL_PLAYOFF_LAST + 1}-36 fuera</span>
      </p>
    </div>
  )
}

/* ---------- Estadísticas ---------- */
function StatRow({ label, a, b, on }: { label: string; a: number; b: number; on: boolean }) {
  return (
    <div className="cl-stat">
      <span>{a}</span>
      <div className="cl-stat-mid">
        <div className="cl-bar">
          <span className="l" style={{ flexGrow: on ? Math.max(a, 0.2) : 1, flexBasis: 0 }} />
          <span className="r" style={{ flexGrow: on ? Math.max(b, 0.2) : 1, flexBasis: 0 }} />
        </div>
        {label}
      </div>
      <span>{b}</span>
    </div>
  )
}

/* ---------- Un partido: suspenso, animación y resultado ---------- */
function roundLabel(m: ClMatch): string {
  if (m.stage === 'liga') return `${CL_STAGE_LABEL.liga} · Jornada ${m.matchday} de ${CL_LEAGUE_MATCHES}`
  if (m.stage === 'final') return CL_STAGE_LABEL.final
  return `${CL_STAGE_LABEL[m.stage]} · ${m.leg === 1 ? 'Ida' : 'Vuelta'}`
}

function MatchView({ v, m, index, onNext, last }: { v: View; m: ClMatch; index: number; onNext: () => void; last: boolean }) {
  // Con animación (ANIMATED_STAGES) o simulación rápida (el resultado, con los goles cayendo uno a uno)
  const animated = isAnimated(m.stage) && m.timeline !== null
  const suspense = animated ? SPEED.completo.suspense : QUICK_SUSPENSE_SECONDS
  const total = m.goals.length
  const [phase, setPhase] = useState<'suspense' | 'play' | 'result'>('suspense')
  const [shown, setShown] = useState(animated ? total : 0)
  const [statsOn, setStatsOn] = useState(false)
  const home = v.byId.get(m.home) as Entrant
  const away = v.byId.get(m.away) as Entrant
  const mine: 0 | 1 = m.home === v.me.id ? 0 : 1
  const rival = mine === 0 ? away : home
  const tie = clTieOf(v.s, m)
  const outcome = clMatchOutcome(m, v.me.id)
  const stageIndex = CL_STAGES.indexOf(m.stage)

  useEffect(() => {
    if (phase !== 'suspense') return
    const id = window.setTimeout(() => setPhase(animated ? 'play' : 'result'), suspense * 1000)
    return () => window.clearTimeout(id)
  }, [phase, animated, suspense])

  useEffect(() => {
    if (phase !== 'result') return
    setStatsOn(false)
    const s = window.setTimeout(() => setStatsOn(true), 80)
    if (animated || total === 0) return () => window.clearTimeout(s)
    // Simulación rápida: los goles van cayendo uno a uno y el marcador sube con ellos
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= total) window.clearInterval(id)
        return Math.min(total, n + 1)
      })
    }, QUICK_GOAL_MS)
    return () => {
      window.clearTimeout(s)
      window.clearInterval(id)
    }
  }, [phase, animated, total])

  const colors = useMemo(() => fieldColors(colorsOf(home, v.club), colorsOf(away, v.club)), [home, away, v.club])
  const crests: [ReactNode, ReactNode] = [<ClubCrest key="h" e={home} club={v.club} size={32} />, <ClubCrest key="a" e={away} club={v.club} size={32} />]
  const label = roundLabel(m)

  if (phase === 'suspense') {
    return (
      <div className="cl">
        <Top stageIndex={stageIndex} out={false} extra={`Partido ${index + 1}`} />
        <div className="cl-card cl-suspense">
          <div className="cl-round">{label}</div>
          <div className="cl-versus">
            <div className={'cl-side left' + (home.user ? ' mine' : '')}>
              <ClubCrest e={home} club={v.club} size={m.stage === 'final' ? 96 : 76} />
              <strong>{nameOf(v, m.home)}</strong>
            </div>
            <div className="cl-vs">VS</div>
            <div className={'cl-side right' + (away.user ? ' mine' : '')}>
              <ClubCrest e={away} club={v.club} size={m.stage === 'final' ? 96 : 76} />
              <strong>{nameOf(v, m.away)}</strong>
            </div>
          </div>
          <div className="cl-wait">
            <span />
          </div>
          <p className="cl-tease">{clSuspenseLine(m, rival.country === activeLeague().code)}</p>
        </div>
      </div>
    )
  }

  if (phase === 'play' && m.timeline) {
    return (
      <div className="cl">
        <Top stageIndex={stageIndex} out={false} extra={`Partido ${index + 1}`} />
        <MatchPlayer
          timeline={m.timeline}
          goals={m.goals}
          names={[nameOf(v, m.home), nameOf(v, m.away)]}
          colors={colors}
          crests={crests}
          label={label}
          onDone={() => setPhase('result')}
        />
        {/* No se puede saltar: el botón se activa en la pantalla de resultado */}
        <div className="cl-actions center">
          <button type="button" className="btn" disabled>
            Continuar →
          </button>
        </div>
      </div>
    )
  }

  /* Resultado */
  const contrib = new Map<string, { p: TPlayer; g: number; a: number }>()
  for (const g of m.goals) {
    if (g.side !== mine) continue
    const s = contrib.get(g.scorer.id) ?? { p: g.scorer, g: 0, a: 0 }
    s.g++
    contrib.set(g.scorer.id, s)
    if (g.assist) {
      const h = contrib.get(g.assist.id) ?? { p: g.assist, g: 0, a: 0 }
      h.a++
      contrib.set(g.assist.id, h)
    }
  }
  const mvp = m.mvp
  const mvpEntrant = mvp ? (mvp.side === 0 ? home : away) : null
  const mvpGoals = mvp ? m.goals.filter((g) => g.side === mvp.side && g.scorer.id === mvp.player.id).length : 0
  const mvpAssists = mvp ? m.goals.filter((g) => g.side === mvp.side && g.assist?.id === mvp.player.id).length : 0
  const st = m.stats
  const position = clUserPosition(v.s)
  const done = shown >= total
  const goals = m.goals.slice(0, shown)
  const hg = done ? m.hg : goals.filter((g) => g.side === 0).length
  const ag = done ? m.ag : goals.filter((g) => g.side === 1).length

  return (
    <div className="cl">
      <Top stageIndex={stageIndex} out={false} extra={`Partido ${index + 1}`} />
      <div className="cl-round">{label}</div>
      <div className={'cl-headline ' + outcome}>{clHeadline(m, v.me.id, tie)}</div>

      <div className="cl-boardr">
        <div className={'cl-side' + (home.user ? ' mine' : '')}>
          <ClubCrest e={home} club={v.club} size={64} />
          <strong>{nameOf(v, m.home)}</strong>
        </div>
        <div className="cl-scorer">
          <b key={'h' + hg} className={hg > 0 ? 'bump' : ''}>{hg}</b>
          <i>–</i>
          <b key={'a' + ag} className={ag > 0 ? 'bump' : ''}>{ag}</b>
        </div>
        <div className={'cl-side' + (away.user ? ' mine' : '')}>
          <ClubCrest e={away} club={v.club} size={64} />
          <strong>{nameOf(v, m.away)}</strong>
        </div>
      </div>
      {done && m.extraTime && !m.pens && <div className="cl-extra">Tras prórroga</div>}
      {done && m.pens && (
        <div className="cl-pens">
          Penales {m.pens[0]} – {m.pens[1]} · pasa {nameOf(v, m.winner as string)}
        </div>
      )}
      {done && tie && tie.legs.length === 2 && (
        <div className="cl-agg">
          {m.leg === 1 ? (
            <>Ida: {nameOf(v, tie.first)} {m.hg}–{m.ag} {nameOf(v, tie.second)}. La vuelta se juega en la parada final.</>
          ) : (
            <>
              Global: {nameOf(v, tie.first)} {tie.agg[0]}–{tie.agg[1]} {nameOf(v, tie.second)}
              {tie.decidedBy === 'penales' ? ' (penales)' : tie.decidedBy === 'prorroga' ? ' (prórroga)' : ''}
            </>
          )}
        </div>
      )}
      {done && m.tags.length > 0 && (
        <div className="cl-tags">
          {m.tags.slice(0, 3).map((t) => (
            <span key={t} className="cl-tag">
              {TAG_LABEL[t]}
            </span>
          ))}
        </div>
      )}

      <div className="cl-cols">
        <div className="cl-card">
          <h3>Goles</h3>
          {total === 0 ? (
            <p className="cl-assist">Sin goles.</p>
          ) : (
            <ul className="cl-goals">
              {goals.map((g, i) => (
                <li key={i} className={g.side === 1 ? 'away' : ''}>
                  <span className="cl-min">
                    {g.minute}'{g.minute > 90 ? ' pr.' : ''}
                  </span>
                  <span>
                    ⚽ <strong>{g.scorer.name}</strong>
                    {g.assist && <span className="cl-assist"> · asist. {g.assist.name}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="cl-card">
          <h3>Estadísticas</h3>
          <StatRow label="Posesión %" a={st.poss} b={100 - st.poss} on={statsOn} />
          <StatRow label="Tiros" a={st.shots[0]} b={st.shots[1]} on={statsOn} />
          <StatRow label="A puerta" a={st.onTarget[0]} b={st.onTarget[1]} on={statsOn} />
          <StatRow label="Córners" a={st.corners[0]} b={st.corners[1]} on={statsOn} />
          <StatRow label="Faltas" a={st.fouls[0]} b={st.fouls[1]} on={statsOn} />
          <StatRow label="Amarillas" a={st.yellow[0]} b={st.yellow[1]} on={statsOn} />
          {(st.red[0] > 0 || st.red[1] > 0) && <StatRow label="Rojas" a={st.red[0]} b={st.red[1]} on={statsOn} />}
        </div>
      </div>

      {done && (
      <div className="cl-card">
        <h3>Protagonistas</h3>
        <div className="cl-players">
          {mvp && mvpEntrant && (
            <div className="cl-player mvp">
              <Face colors={colorsOf(mvpEntrant, v.club)} />
              <div>
                <strong>⭐ {mvp.player.name}</strong>
                <small>
                  Figura · {mvp.player.pos} · {mvp.player.rating}
                  {mvpGoals > 0 && ` · ⚽${mvpGoals}`}
                  {mvpAssists > 0 && ` · 🅰️${mvpAssists}`}
                </small>
              </div>
            </div>
          )}
          {[...contrib.values()]
            .filter((c) => c.p.id !== mvp?.player.id || mvp?.side !== mine)
            .sort((x, y) => y.g - x.g || y.a - x.a)
            .map((c) => (
              <div className="cl-player" key={c.p.id}>
                <Face colors={colorsOf(v.me, v.club)} />
                <div>
                  <strong>{c.p.name}</strong>
                  <small>
                    {c.p.pos} · {c.p.rating}
                    {c.g > 0 && ` · ⚽${c.g}`}
                    {c.a > 0 && ` · 🅰️${c.a}`}
                  </small>
                </div>
              </div>
            ))}
        </div>
        {contrib.size === 0 && <p className="cl-assist">Tu club no marcó en este partido.</p>}
      </div>
      )}

      {done && m.stage === 'liga' && (
        <div className="cl-card">
          <h3>
            Fase de liga · tras la jornada {m.matchday}: vas {clTable(v.s.entrants, v.s.league, m.matchday ?? 8).findIndex((r) => r.id === v.me.id) + 1}.º
            {last ? ` (final: ${position}.º)` : ''}
          </h3>
          <details>
            <summary>Ver la tabla completa</summary>
            <LeagueTable v={v} upTo={m.matchday ?? 8} />
          </details>
        </div>
      )}

      <div className="cl-actions">
        <button type="button" className="btn" onClick={onNext}>
          Continuar →
        </button>
      </div>
    </div>
  )
}

/* ---------- Veredicto de la fase de liga ---------- */
function Verdict({ v, onFinish }: { v: View; onFinish: () => void }) {
  const pos = clUserPosition(v.s)
  const path = clPathOf(pos)
  return (
    <div className="cl">
      <Top stageIndex={0} out={path === 'eliminado'} />
      <div className="cl-card cl-verdict">
        <div className="cl-round">Fin de la fase de liga</div>
        <div className={'cl-headline ' + (path === 'eliminado' ? 'loss' : 'win')}>
          {path === 'directo' && `¡${pos}.º! Pasas directo a octavos`}
          {path === 'playoff' && `${pos}.º: jugarás el playoff`}
          {path === 'eliminado' && `${pos}.º: eliminados en la fase de liga`}
        </div>
        <p className="cl-sub">
          {path === 'eliminado'
            ? 'La Champions sigue sin ti: al final de la temporada verás quién se lleva la copa.'
            : 'Las eliminatorias se juegan en la parada final de la temporada. En invierno puedes reforzar la plantilla.'}
        </p>
      </div>
      <div className="cl-card">
        <h3>Clasificación final de la fase de liga</h3>
        <LeagueTable v={v} />
      </div>
      <div className="cl-actions">
        <button type="button" className="btn" onClick={onFinish}>
          Continuar →
        </button>
      </div>
    </div>
  )
}

/* ---------- Cierre: campeón, logros y celebración ---------- */
function Closing({ v, history, onFinish }: { v: View; history: SeasonRecord[]; onFinish: () => void }) {
  const reach = clReach(v.s)
  const won = reach === 'campeon'
  const champ = clChampionEntrant(v.s) as Entrant
  const final = v.s.rounds[v.s.rounds.length - 1].ties[0].legs[0]
  const info = europeInfo('champions')
  const list = useMemo(() => clAchievements(v.s, history), [v.s, history])
  const best = clScorers(v.s)[0]
  const last = clUserMatches(v.s).slice(-1)[0]

  return (
    <div className="cl">
      {won && (
        <div className="cl-confetti" aria-hidden="true">
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.3}s` }} />
          ))}
        </div>
      )}
      <Top stageIndex={last ? CL_STAGES.indexOf(last.stage) : 0} out={!won} />
      <div className="cl-card cl-closing">
        <div className="cl-trophy">
          <TrophyImg id="champions" size={150} label={info.name} />
        </div>
        <div className="cl-round">{won ? '¡Campeones!' : 'Campeón de la Champions'}</div>
        <ClubCrest e={champ} club={v.club} size={won ? 110 : 90} />
        <div className="cl-champ-name">{nameOf(v, champ.id)}</div>
        <div className="cl-final-line">
          Final: {nameOf(v, final.home)} {final.hg}–{final.ag} {nameOf(v, final.away)}
          {final.pens ? ` (penales ${final.pens[0]}–${final.pens[1]})` : final.extraTime ? ' (prórroga)' : ''}
        </div>
        {reach && <div className={'cl-reach' + (won ? ' win' : '')}>Tu club: {REACH_LABEL[reach]}</div>}
        {won && <p className="cl-sub">¡{v.club.name} levanta la {info.name}!</p>}
        {best && (
          <p className="cl-sub">
            👟 Máximo goleador: <strong>{best.player.name}</strong> ({nameOf(v, best.club)}) · {best.goals} goles
          </p>
        )}
        {list.length > 0 && (
          <ul className="cl-ach">
            {list.map((a, i) => (
              <li key={a} style={{ animationDelay: `${i * 0.15}s` }}>
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="cl-actions">
        <button type="button" className="btn" onClick={onFinish}>
          Continuar →
        </button>
      </div>
    </div>
  )
}

/* ---------- Pantalla de la Champions (cuando tu club participa) ---------- */
interface Props {
  club: Club
  state: ClState
  phase: 'liga' | 'eliminatorias'
  history: SeasonRecord[]
  onFinish: () => void
}

export default function ChampionsScreen({ club, state, phase, history, onFinish }: Props) {
  const me = clUser(state)
  const key = `${state.season}:cl:${phase}`
  const matches = useMemo(
    () => clUserMatches(state).filter((m) => (phase === 'liga' ? m.stage === 'liga' : m.stage !== 'liga')),
    [state, phase],
  )
  // Fase de liga: intro, 8 partidos y veredicto. Eliminatorias: sus partidos y el campeón.
  const offset = phase === 'liga' ? 1 : 0
  const total = matches.length + offset + 1
  const [idx, setIdx] = useState(() => Math.min(progress.get(key) ?? 0, total - 1))

  useEffect(() => {
    progress.set(key, idx)
    window.scrollTo(0, 0)
  }, [key, idx])

  if (!me || matches.length === 0) return null
  const v: View = { s: state, club, byId: new Map(state.entrants.map((e) => [e.id, e])), me }

  // Solo se avanza con “Continuar”: no hay forma de saltarse la competición
  if (phase === 'liga' && idx === 0) return <Intro onDone={() => setIdx(1)} />
  const n = idx - offset
  if (n >= matches.length) {
    return phase === 'liga' ? <Verdict v={v} onFinish={onFinish} /> : <Closing v={v} history={history} onFinish={onFinish} />
  }
  const m = matches[n]
  return <MatchView key={m.id} v={v} m={m} index={n} last={n === matches.length - 1} onNext={() => setIdx(idx + 1)} />
}

/* ---------- Si tu club no juega (o ya cayó): solo el resultado ---------- */
export function ChampionsSummaryCard({ club, state }: { club: Club; state: ClState }) {
  const byId = new Map(state.entrants.map((e) => [e.id, e]))
  const final = state.rounds[state.rounds.length - 1]?.ties[0]
  const info = europeInfo('champions')
  const name = (id: string) => {
    const e = byId.get(id)
    return e ? entrantName(e, club.name) : id
  }
  const champ = clChampionEntrant(state)
  const me = clUser(state)
  if (!final || !champ) return null
  const f = final.legs[0]
  const home = byId.get(f.home) as Entrant
  const away = byId.get(f.away) as Entrant
  return (
    <div className="card">
      <h2>
        {info.icon} Final de la {info.name}
      </h2>
      <div className="cl-mini">
        <ClubCrest e={home} club={club} size={34} />
        <strong>{name(f.home)}</strong>
        <strong>
          {f.hg} – {f.ag}
        </strong>
        <strong>{name(f.away)}</strong>
        <ClubCrest e={away} club={club} size={34} />
      </div>
      {f.pens && (
        <p className="hint center">
          Decidido en los penales ({f.pens[0]}–{f.pens[1]})
        </p>
      )}
      <p className="center">
        🏆 Campeón: <strong>{name(champ.id)}</strong> ({COUNTRY_NAMES[champ.country] ?? champ.country})
      </p>
      <p className="hint center">
        {me
          ? `Tu club cayó en la fase de liga (${clUserPosition(state)}.º) y no siguió en la Champions.`
          : 'Tu club no juega esta competición.'}
      </p>
    </div>
  )
}

/* ---------- Parada de invierno: no hay Champions, es el mercado ---------- */
export function ChampionsWinterCard({ state }: { state: ClState }) {
  const pos = clUserPosition(state)
  if (pos === 0) return null
  const path = clPathOf(pos)
  const style: CSSProperties = { marginTop: 0 }
  return (
    <div className="card" style={style}>
      <h2>🏆 {europeInfo('champions').name}</h2>
      <p>
        {path === 'directo' && `Acabaste la fase de liga ${pos}.º: pasas directo a octavos.`}
        {path === 'playoff' && `Acabaste la fase de liga ${pos}.º: juegas el playoff.`}
        {path === 'eliminado' && `Acabaste la fase de liga ${pos}.º: quedaste eliminado.`}
        {path !== 'eliminado' && ' En invierno no hay Champions: es el momento de reforzar la plantilla antes de las eliminatorias de la parada final.'}
      </p>
    </div>
  )
}

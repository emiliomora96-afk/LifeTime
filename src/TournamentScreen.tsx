import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './tournament.css'
import type { Club, CrestShape } from './types'
import type { SeasonRecord } from './game'
import Crest from './Crest'
import { activeLeague } from './activeLeague'
import type { Entrant, EuropeId } from './europe'
import { COUNTRY_NAMES, entrantName, europeInfo } from './europe'
import type { TMatch, TPlayer, TournamentSeason } from './tournament'
import {
  GROUP_ROUNDS,
  REACH_LABEL,
  STAGES,
  STAGE_LABEL,
  STAGE_SHORT,
  TAG_LABEL,
  achievements,
  groupTable,
  matchHeadline,
  matchOutcome,
  suspenseLine,
  tournamentScorers,
  userEntrant,
  userGroupIndex,
  userMatches,
  userReach,
} from './tournament'
import TrophyImg from './TrophyImg'

const SUSPENSE_MS = 2000 // suspenso antes de cada partido
const GOAL_MS = 300 // ritmo al que van cayendo los goles

// Colores por competición
const THEME: Record<EuropeId, { a: string; b: string; bg: string }> = {
  champions: { a: '#1d4ed8', b: '#fbbf24', bg: '#0b1b4d' },
  europa: { a: '#c2410c', b: '#fdba74', bg: '#3b1405' },
  conferencia: { a: '#15803d', b: '#86efac', bg: '#06280f' },
}

// El avance dentro del torneo sobrevive a cambiar de sección (se reinicia al recargar la página)
const progress = new Map<string, number>()

const SHAPES: CrestShape[] = ['classic', 'round', 'modern']
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function ClubCrest({ e, club, size }: { e: Entrant; club: Club; size: number }) {
  return e.user ? (
    <Crest name={club.name} shape={club.crestShape} primary={club.primaryColor} secondary={club.secondaryColor} size={size} />
  ) : (
    <Crest name={e.name} shape={SHAPES[hash(e.id) % 3]} primary={e.colors[0]} secondary={e.colors[1]} size={size} />
  )
}

// Rostro del jugador (silueta en los colores de su club; el arte anime llegará más adelante)
function Face({ colors }: { colors: [string, string] }) {
  return (
    <svg className="tn-face" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="14" fill={colors[0]} />
      <circle cx="50" cy="38" r="16" fill={colors[1]} opacity="0.95" />
      <path d="M16 100 C16 70 32 60 50 60 C68 60 84 70 84 100 Z" fill={colors[1]} opacity="0.95" />
    </svg>
  )
}

function clubColors(e: Entrant, club: Club): [string, string] {
  return e.user ? [club.primaryColor, club.secondaryColor] : e.colors
}

function themeStyle(comp: EuropeId): CSSProperties {
  const th = THEME[comp]
  return { '--tn-a': th.a, '--tn-b': th.b, '--tn-bg': th.bg } as CSSProperties
}

interface View {
  t: TournamentSeason['main']
  club: Club
  byId: Map<string, Entrant>
  me: Entrant
}

function nameOf(v: View, id: string): string {
  const e = v.byId.get(id)
  return e ? entrantName(e, v.club.name) : id
}

/* ---------- Barra de progreso por rondas ---------- */
function Strip({ current, out }: { current: number; out: boolean }) {
  return (
    <div className="tn-strip">
      {STAGES.map((s, i) => (
        <span key={s} className={'tn-pill' + (i < current ? ' done' : i === current ? (out ? ' out' : ' current') : '')}>
          {STAGE_SHORT[s]}
        </span>
      ))}
    </div>
  )
}

/* ---------- Estadísticas ---------- */
function StatRow({ label, a, b, on }: { label: string; a: number; b: number; on: boolean }) {
  return (
    <div className="tn-stat">
      <span>{a}</span>
      <div className="tn-stat-mid">
        <div className="tn-bar">
          <span className="l" style={{ flexGrow: on ? Math.max(a, 0.2) : 1, flexBasis: 0 }} />
          <span className="r" style={{ flexGrow: on ? Math.max(b, 0.2) : 1, flexBasis: 0 }} />
        </div>
        {label}
      </div>
      <span>{b}</span>
    </div>
  )
}

/* ---------- Tabla del grupo ---------- */
function GroupBlock({ v, m }: { v: View; m: TMatch }) {
  const gi = m.group ?? userGroupIndex(v.t)
  const group = v.t.groups[gi]
  if (!group) return null
  const day = m.matchday ?? GROUP_ROUNDS
  const rows = groupTable(group, day)
  const last = day >= GROUP_ROUNDS
  const myRank = rows.findIndex((r) => r.id === v.me.id)
  return (
    <div className="tn-card">
      <h3>
        Grupo {group.name} · tras la jornada {day}
      </h3>
      <table className="tn-table">
        <thead>
          <tr>
            <th>Club</th>
            <th>PJ</th>
            <th>DG</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const e = v.byId.get(r.id)
            return (
              <tr key={r.id} className={(i < 2 ? 'up ' : '') + (r.id === v.me.id ? 'me' : '')}>
                <td>
                  <div className="tn-teamcell">
                    {e && <ClubCrest e={e} club={v.club} size={16} />}
                    {nameOf(v, r.id)}
                  </div>
                </td>
                <td>{r.played}</td>
                <td>{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                <td>
                  <strong>{r.points}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {last && (
        <p className={'tn-verdict ' + (myRank < 2 ? 'ok' : 'no')}>
          {myRank < 2 ? '✅ ¡Clasificados a cuartos de final!' : '❌ Eliminados en la fase de grupos'}
        </p>
      )}
    </div>
  )
}

/* ---------- Un partido: suspenso y resultado ---------- */
function MatchView({ v, m, index, stageIndex, onNext }: { v: View; m: TMatch; index: number; stageIndex: number; onNext: () => void }) {
  const [phase, setPhase] = useState<'suspense' | 'result'>('suspense')
  const [shown, setShown] = useState(0)
  const [statsOn, setStatsOn] = useState(false)

  const home = v.byId.get(m.home) as Entrant
  const away = v.byId.get(m.away) as Entrant
  const mine: 0 | 1 = m.home === v.me.id ? 0 : 1
  const rival = mine === 0 ? away : home
  const outcome = matchOutcome(m, v.me.id)
  const total = m.goals.length

  useEffect(() => {
    if (phase !== 'suspense') return
    const id = window.setTimeout(() => setPhase('result'), SUSPENSE_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  // Los goles van cayendo uno a uno y el marcador sube con ellos
  useEffect(() => {
    if (phase !== 'result') return
    setStatsOn(false)
    const s = window.setTimeout(() => setStatsOn(true), 80)
    if (total === 0) return () => window.clearTimeout(s)
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= total) window.clearInterval(id)
        return Math.min(total, n + 1)
      })
    }, GOAL_MS)
    return () => {
      window.clearTimeout(s)
      window.clearInterval(id)
    }
  }, [phase, total])

  const done = shown >= total
  const goals = m.goals.slice(0, shown)
  const hg = done ? m.hg : goals.filter((g) => g.side === 0).length
  const ag = done ? m.ag : goals.filter((g) => g.side === 1).length

  const label =
    m.stage === 'group' ? `${STAGE_LABEL.group} · Grupo ${v.t.groups[m.group ?? 0]?.name} · Jornada ${m.matchday}` : STAGE_LABEL[m.stage]

  const top = (
    <div className="tn-top">
      <span className="tn-comp">
        {europeInfo(v.t.comp).icon} {europeInfo(v.t.comp).name}
      </span>
      <Strip current={stageIndex} out={false} />
      <span className="tn-count">Partido {index + 1}</span>
    </div>
  )

  if (phase === 'suspense') {
    return (
      <div className="tn" style={themeStyle(v.t.comp)} data-stage={m.stage}>
        {top}
        <div className="tn-card tn-suspense">
          <div className="tn-round">{label}</div>
          <div className="tn-versus">
            <div className={'tn-side left' + (home.user ? ' mine' : '')}>
              <ClubCrest e={home} club={v.club} size={m.stage === 'final' ? 96 : 76} />
              <strong>{nameOf(v, m.home)}</strong>
            </div>
            <div className="tn-vs">VS</div>
            <div className={'tn-side right' + (away.user ? ' mine' : '')}>
              <ClubCrest e={away} club={v.club} size={m.stage === 'final' ? 96 : 76} />
              <strong>{nameOf(v, m.away)}</strong>
            </div>
          </div>
          <div className="tn-wait">
            <span />
          </div>
          <p className="tn-tease">{suspenseLine(m, rival.country === activeLeague().code)}</p>
        </div>
      </div>
    )
  }

  // Aportes de tu club (goleadores y asistentes) y figura del partido
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

  return (
    <div className="tn" style={themeStyle(v.t.comp)} data-stage={m.stage}>
      {top}
      <div className="tn-round">{label}</div>
      <div className={'tn-headline ' + outcome}>{matchHeadline(m, v.me.id)}</div>

      <div className="tn-board">
        <div className={'tn-side' + (home.user ? ' mine' : '')}>
          <ClubCrest e={home} club={v.club} size={64} />
          <strong>{nameOf(v, m.home)}</strong>
        </div>
        <div className="tn-score">
          <b key={'h' + hg} className={hg > 0 ? 'bump' : ''}>{hg}</b>
          <i>–</i>
          <b key={'a' + ag} className={ag > 0 ? 'bump' : ''}>{ag}</b>
        </div>
        <div className={'tn-side' + (away.user ? ' mine' : '')}>
          <ClubCrest e={away} club={v.club} size={64} />
          <strong>{nameOf(v, m.away)}</strong>
        </div>
      </div>

      {done && m.extraTime && !m.pens && <div className="tn-extra">Tras prórroga</div>}
      {done && m.pens && (
        <div className="tn-pens">
          Penales {m.pens[0]} – {m.pens[1]} · pasa {nameOf(v, m.winner as string)}
        </div>
      )}
      {done && m.tags.length > 0 && (
        <div className="tn-tags">
          {m.tags.slice(0, 3).map((t) => (
            <span key={t} className="tn-tag">{TAG_LABEL[t]}</span>
          ))}
        </div>
      )}

      <div className="tn-cols">
        <div className="tn-card">
          <h3>Goles</h3>
          {total === 0 ? (
            <p className="tn-assist">Sin goles.</p>
          ) : (
            <ul className="tn-goals">
              {goals.map((g, i) => (
                <li key={i} className={g.side === 1 ? 'away' : ''}>
                  <span className="tn-min">{g.minute}'{g.minute > 90 ? ' pr.' : ''}</span>
                  <span>
                    ⚽ <strong>{g.scorer.name}</strong>
                    {g.assist && <span className="tn-assist"> · asist. {g.assist.name}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="tn-card">
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
        <div className="tn-card">
          <h3>Protagonistas</h3>
          <div className="tn-players">
            {mvp && mvpEntrant && (
              <div className="tn-player mvp">
                <Face colors={clubColors(mvpEntrant, v.club)} />
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
                <div className="tn-player" key={c.p.id}>
                  <Face colors={clubColors(v.me, v.club)} />
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
          {contrib.size === 0 && <p className="tn-assist">Tu club no marcó en este partido.</p>}
        </div>
      )}

      {done && m.stage === 'group' && <GroupBlock v={v} m={m} />}

      <div className="tn-actions">
        <button type="button" className="btn" onClick={onNext}>
          Continuar →
        </button>
      </div>
    </div>
  )
}

/* ---------- Cierre: campeón, logros y celebración ---------- */
function Closing({
  v,
  history,
  stageIndex,
  onFinish,
}: {
  v: View
  history: SeasonRecord[]
  stageIndex: number
  onFinish: () => void
}) {
  const reach = userReach(v.t)
  const won = reach === 'campeon'
  const champ = v.byId.get(v.t.champion) as Entrant
  const final = v.t.rounds[v.t.rounds.length - 1].matches[0]
  const info = europeInfo(v.t.comp)
  const list = useMemo(() => achievements(v.t, history), [v.t, history])
  const best = tournamentScorers(v.t)[0]
  const bestClub = best ? v.byId.get(best.club) : undefined

  return (
    <div className="tn" style={themeStyle(v.t.comp)} data-stage="final">
      {won && (
        <div className="tn-confetti" aria-hidden="true">
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.3}s` }} />
          ))}
        </div>
      )}
      <div className="tn-top">
        <span className="tn-comp">
          {info.icon} {info.name}
        </span>
        <Strip current={stageIndex} out={!won} />
      </div>
      <div className="tn-card tn-closing">
        <div className="tn-trophy">
          <TrophyImg id={v.t.comp} size={150} label={info.name} />
        </div>
        <div className="tn-round">{won ? '¡Campeones!' : 'Campeón de la competición'}</div>
        <ClubCrest e={champ} club={v.club} size={won ? 110 : 90} />
        <div className="tn-champ-name">{nameOf(v, v.t.champion)}</div>
        <div className="tn-final-line">
          Final: {nameOf(v, final.home)} {final.hg}–{final.ag} {nameOf(v, final.away)}
          {final.pens ? ` (penales ${final.pens[0]}–${final.pens[1]})` : final.extraTime ? ' (prórroga)' : ''}
        </div>
        {reach && <div className={'tn-reach' + (won ? ' win' : '')}>Tu club: {REACH_LABEL[reach]}</div>}
        {won && <p className="tn-sub">¡{v.club.name} levanta la copa de {info.name}!</p>}
        {best && bestClub && (
          <p className="tn-sub">
            👟 Máximo goleador: <strong>{best.player.name}</strong> ({nameOf(v, best.club)}) · {best.goals} goles
          </p>
        )}
        {list.length > 0 && (
          <ul className="tn-ach">
            {list.map((a, i) => (
              <li key={a} style={{ animationDelay: `${i * 0.15}s` }}>{a}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="tn-actions">
        <button type="button" className="btn" onClick={onFinish}>
          Continuar →
        </button>
      </div>
    </div>
  )
}

/* ---------- Pantalla del torneo (cuando tu club participa) ---------- */
interface Props {
  club: Club
  tournament: TournamentSeason
  history: SeasonRecord[]
  onFinish: () => void
}

export default function TournamentScreen({ club, tournament, history, onFinish }: Props) {
  const t = tournament.main
  const me = userEntrant(t)
  const key = `${t.season}:${t.comp}`
  const matches = useMemo(() => userMatches(t), [t])
  const [idx, setIdx] = useState(() => Math.min(progress.get(key) ?? 0, matches.length))

  useEffect(() => {
    progress.set(key, idx)
    window.scrollTo(0, 0)
  }, [key, idx])

  if (!me || matches.length === 0) return null
  const v: View = { t, club, byId: new Map(t.entrants.map((e) => [e.id, e])), me }

  // Solo se avanza partido a partido: no hay forma de saltarse la competición
  if (idx >= matches.length) {
    const last = matches[matches.length - 1]
    return <Closing v={v} history={history} stageIndex={STAGES.indexOf(last.stage)} onFinish={onFinish} />
  }
  const m = matches[idx]
  return (
    <MatchView
      key={m.id}
      v={v}
      m={m}
      index={idx}
      stageIndex={STAGES.indexOf(m.stage)}
      onNext={() => setIdx(idx + 1)}
    />
  )
}

/* ---------- Si tu club no juega: solo la final y el campeón ---------- */
export function TournamentSummaryCard({ club, tournament }: { club: Club; tournament: TournamentSeason }) {
  const t = tournament.main
  const byId = new Map(t.entrants.map((e) => [e.id, e]))
  const final = t.rounds[t.rounds.length - 1].matches[0]
  const info = europeInfo(t.comp)
  const name = (id: string) => {
    const e = byId.get(id)
    return e ? entrantName(e, club.name) : id
  }
  const home = byId.get(final.home) as Entrant
  const away = byId.get(final.away) as Entrant
  const champ = byId.get(t.champion) as Entrant

  return (
    <div className="card">
      <h2>
        {info.icon} Final de {info.name}
      </h2>
      <div className="tn-mini">
        <ClubCrest e={home} club={club} size={34} />
        <strong>{name(final.home)}</strong>
        <strong>
          {final.hg} – {final.ag}
        </strong>
        <strong>{name(final.away)}</strong>
        <ClubCrest e={away} club={club} size={34} />
      </div>
      {final.pens && (
        <p className="hint center">
          Decidido en los penales ({final.pens[0]}–{final.pens[1]})
        </p>
      )}
      <p className="center">
        🏆 Campeón: <strong>{name(t.champion)}</strong> ({COUNTRY_NAMES[champ.country] ?? champ.country})
      </p>
      <p className="hint center">
        Tu club no juega esta competición. Otros campeones:{' '}
        {(Object.keys(tournament.champions) as EuropeId[])
          .filter((id) => id !== t.comp)
          .map((id) => `${europeInfo(id).icon} ${entrantName(tournament.champions[id], club.name)}`)
          .join(' · ')}
      </p>
    </div>
  )
}

import type { Tactic } from './engine'

const TACTICS: { id: Tactic; label: string; detail: string }[] = [
  { id: 'ofensiva', label: 'Ofensiva', detail: 'Más goles a favor, pero también en contra.' },
  { id: 'equilibrada', label: 'Equilibrada', detail: 'Sin riesgos extra.' },
  { id: 'defensiva', label: 'Defensiva', detail: 'Menos goles en contra, pero también a favor.' },
]

interface Props {
  tactic: Tactic
  onChange: (tactic: Tactic) => void
}

export default function TacticPanel({ tactic, onChange }: Props) {
  const current = TACTICS.find((t) => t.id === tactic)
  return (
    <div className="card">
      <h2>🧠 Táctica</h2>
      <p className="hint">Se aplica a todos los partidos hasta la próxima parada.</p>
      <div className="levels">
        {TACTICS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'level' + (t.id === tactic ? ' active' : '')}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current && <p className="hint">{current.detail}</p>}
    </div>
  )
}

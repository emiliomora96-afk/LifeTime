import type { CrestShape } from './types'

interface Props {
  name: string
  shape: CrestShape
  primary: string
  secondary: string
  size?: number
}

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return letters || '?'
}

export default function Crest({ name, shape, primary, secondary, size = 120 }: Props) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" role="img" aria-label="Escudo del club">
      {shape === 'classic' && (
        <path
          d="M10 10 H90 V60 C90 90 50 112 50 112 C50 112 10 90 10 60 Z"
          fill={primary}
          stroke={secondary}
          strokeWidth="5"
        />
      )}
      {shape === 'round' && (
        <circle cx="50" cy="60" r="44" fill={primary} stroke={secondary} strokeWidth="5" />
      )}
      {shape === 'modern' && (
        <polygon
          points="50,8 92,30 92,80 50,112 8,80 8,30"
          fill={primary}
          stroke={secondary}
          strokeWidth="5"
        />
      )}
      <text
        x="50"
        y="68"
        textAnchor="middle"
        fontSize="28"
        fontWeight="700"
        fill={secondary}
        fontFamily="system-ui, sans-serif"
      >
        {initials(name)}
      </text>
    </svg>
  )
}
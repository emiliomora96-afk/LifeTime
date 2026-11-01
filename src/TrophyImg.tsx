import './trophies.css'
import champions from './assets/trophies/champions.png'
import europa from './assets/trophies/europa-league.png'
import conferencia from './assets/trophies/copa-horizonte.png'
import supercup from './assets/trophies/supercopa-continental.png'
import liga from './assets/trophies/liga-espana.png'
import copa from './assets/trophies/copa-del-rey.png'
import supercopa from './assets/trophies/supercopa-espana.png'
import { aspectOf } from './trophyAspect'
import type { TrophyId } from './trophyAspect'
import { activeLeague } from './activeLeague'

// Trofeos europeos y los de España (imágenes ya hechas)
const SRC: Record<TrophyId, string> = { champions, europa, conferencia, supercup, liga, copa, supercopa }

// Trofeos de las demás ligas: se leen solos de la carpeta assets/trophies con el nombre <liga>-liga.png,
// <liga>-copa.png y <liga>-supercopa.png (ing, ita, ale, fra). Si todavía no existe el archivo, se dibuja uno provisional.
const FILES = import.meta.glob('./assets/trophies/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><path d="M25 10h50v35c0 18-11 30-25 32-14-2-25-14-25-32z" fill="#d4af37" stroke="#8a6d1d" stroke-width="3"/><path d="M25 18H10c0 20 7 30 20 34M75 18h15c0 20-7 30-20 34" fill="none" stroke="#8a6d1d" stroke-width="4"/><rect x="44" y="77" width="12" height="28" fill="#b8932b"/><rect x="28" y="105" width="44" height="14" rx="3" fill="#8a6d1d"/></svg>',
  )

function srcFor(id: TrophyId): string {
  if (id === 'liga' || id === 'copa' || id === 'supercopa') {
    const key = activeLeague().trophyKey
    if (key !== 'esp') return FILES[`./assets/trophies/${key}-${id}.png`] ?? PLACEHOLDER
  }
  return SRC[id]
}

// Las imágenes se cargan y decodifican una sola vez, al abrir la app: así cuando sale un trofeo ya están listas
const loading = new Map<string, Promise<void>>()
export function preloadTrophy(id: TrophyId): Promise<void> {
  const src = srcFor(id)
  let p = loading.get(src)
  if (!p) {
    p = new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const done = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve()
        done.then(() => resolve())
      }
      img.onerror = () => {
        loading.delete(src) // si falló, el próximo intento vuelve a pedirla
        resolve()
      }
      img.src = src
    })
    loading.set(src, p)
  }
  return p
}
;(Object.keys(SRC) as TrophyId[]).forEach((id) => void preloadTrophy(id))

interface Props {
  id: TrophyId
  size?: number // lado de una caja cuadrada donde cabe el trofeo
  height?: number // alternativa: alto exacto del trofeo; el ancho sale de su proporción
  label?: string // texto alternativo; vacío si el nombre ya aparece al lado
}

export default function TrophyImg({ id, size = 96, height, label = '' }: Props) {
  if (height !== undefined) {
    return <img className="trophy-img" src={srcFor(id)} width={Math.round(height * aspectOf(id))} height={height} alt={label} draggable={false} decoding="sync" loading="eager" />
  }
  return <img className="trophy-img" src={srcFor(id)} width={size} height={size} alt={label} draggable={false} decoding="sync" loading="eager" />
}

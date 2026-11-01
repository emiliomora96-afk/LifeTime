import { activeLeagueId } from './activeLeague'
// Ids de los trofeos. 'supercup' es la Supercopa Continental (europea);
// 'liga', 'copa' y 'supercopa' son los de la liga de la partida (mismo id que en domestic.ts).
export type TrophyId = 'champions' | 'europa' | 'conferencia' | 'supercup' | 'liga' | 'copa' | 'supercopa'

// Ancho / alto de cada imagen (todas son más altas que anchas)
export const TROPHY_ASPECT: Record<TrophyId, number> = {
  champions: 0.834,
  europa: 0.941,
  conferencia: 0.797,
  supercup: 0.857,
  liga: 0.398,
  copa: 0.654,
  supercopa: 0.701,
}

// Las ligas nuevas aún no tienen sus trofeos medidos: hasta entonces se usa una proporción media
// (cuando se añadan las imágenes se puede afinar aquí, por liga y trofeo)
const OTHER_LEAGUE_ASPECT: Partial<Record<TrophyId, number>> = { liga: 0.5, copa: 0.65, supercopa: 0.7 }

export function aspectOf(id: TrophyId): number {
  if ((id === 'liga' || id === 'copa' || id === 'supercopa') && activeLeagueId() !== 'esp') {
    return OTHER_LEAGUE_ASPECT[id] ?? TROPHY_ASPECT[id]
  }
  return TROPHY_ASPECT[id]
}

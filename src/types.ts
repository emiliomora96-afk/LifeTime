export type CrestShape = 'classic' | 'round' | 'modern'

export interface Club {
  league: string
  leagueId?: string // 'esp' | 'ing' | 'ita' | 'ale' | 'fra' (si falta, es España)
  division: number
  name: string
  city: string
  primaryColor: string
  secondaryColor: string
  crestShape: CrestShape
  stadium: string
  budget: number
}
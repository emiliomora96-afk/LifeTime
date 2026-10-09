export type CrestShape = 'classic' | 'round' | 'modern'

export interface Club {
  league: string
  division: number
  name: string
  city: string
  primaryColor: string
  secondaryColor: string
  crestShape: CrestShape
  stadium: string
  budget: number
}
export type SectionId =
  | 'inicio'
  | 'equipo'
  | 'tabla'
  | 'calendario'
  | 'mercado'
  | 'cantera'
  | 'finanzas'
  | 'directiva'
  | 'estadisticas'

export const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'equipo', label: 'Equipo', icon: '👕' },
  { id: 'tabla', label: 'Clasificación', icon: '📊' },
  { id: 'calendario', label: 'Calendario', icon: '📅' },
  { id: 'mercado', label: 'Mercado', icon: '🔁' },
  { id: 'cantera', label: 'Cantera', icon: '🌱' },
  { id: 'finanzas', label: 'Finanzas', icon: '💰' },
  { id: 'directiva', label: 'Directiva', icon: '🏛️' },
  { id: 'estadisticas', label: 'Estadísticas y premios', icon: '🏆' },
]
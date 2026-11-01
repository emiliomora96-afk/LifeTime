export type SectionId =
  | 'inicio'
  | 'parada'
  | 'equipo'
  | 'tabla'
  | 'calendario'
  | 'mercado'
  | 'cantera'
  | 'finanzas'
  | 'directiva'
  | 'estadisticas'
  | 'legado'

export const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'parada', label: 'Parada actual', icon: '🚩' },
  { id: 'equipo', label: 'Equipo', icon: '👕' },
  { id: 'tabla', label: 'Clasificación', icon: '📊' },
  { id: 'calendario', label: 'Calendario', icon: '📅' },
  { id: 'mercado', label: 'Mercado', icon: '🔁' },
  { id: 'cantera', label: 'Cantera', icon: '🌱' },
  { id: 'finanzas', label: 'Finanzas', icon: '💰' },
  { id: 'directiva', label: 'Directiva', icon: '🏛️' },
  { id: 'estadisticas', label: 'Estadísticas y premios', icon: '🏆' },
  { id: 'legado', label: 'Palmarés y legado', icon: '📜' },
]

// Menú superior: cada entrada abre una sección y, si agrupa varias, muestra subpestañas debajo.
export interface MenuItem {
  id: string
  label: string
  icon: string
  children: SectionId[]
}

export const MENU: MenuItem[] = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', children: ['inicio'] },
  { id: 'parada', label: 'Parada actual', icon: '🚩', children: ['parada'] },
  { id: 'equipo', label: 'Equipo', icon: '👕', children: ['equipo', 'mercado', 'cantera'] },
  { id: 'competicion', label: 'Competición', icon: '📊', children: ['tabla', 'calendario'] },
  { id: 'club', label: 'Club', icon: '🏛️', children: ['finanzas', 'directiva', 'legado'] },
  { id: 'premios', label: 'Premios', icon: '🏆', children: ['estadisticas'] },
]

// Nombre de las subpestañas cuando difiere del de la sección
export const SUB_LABEL: Partial<Record<SectionId, string>> = { equipo: 'Plantilla' }

// A qué entrada del menú pertenece una sección
export function menuOf(id: SectionId): MenuItem {
  return MENU.find((m) => m.children.includes(id)) ?? MENU[0]
}

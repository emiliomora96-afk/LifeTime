import type { Club } from './types'
import type { GameState } from './game'
import { parseGame } from './game'

/* ==========================================================================
   Paso 10: guardado y carga. El navegador guarda solo (localStorage), pero si se borra
   el historial se pierde todo. Por eso la partida se puede exportar a un archivo y volver a importar.
   ========================================================================== */
export const SAVE_FORMAT = 'lifetime-save'
export const SAVE_FORMAT_VERSION = 1

export interface SaveFile {
  format: typeof SAVE_FORMAT
  version: number
  savedAt: string
  club: Club
  game: GameState
}

export function exportSave(club: Club, game: GameState): string {
  const file: SaveFile = { format: SAVE_FORMAT, version: SAVE_FORMAT_VERSION, savedAt: new Date().toISOString(), club, game }
  return JSON.stringify(file)
}

function validClub(c: unknown): c is Club {
  if (typeof c !== 'object' || c === null) return false
  const x = c as Partial<Club>
  return (
    typeof x.name === 'string' &&
    typeof x.city === 'string' &&
    typeof x.primaryColor === 'string' &&
    typeof x.secondaryColor === 'string' &&
    typeof x.crestShape === 'string' &&
    typeof x.stadium === 'string' &&
    typeof x.budget === 'number'
  )
}

export type ImportResult = { ok: true; club: Club; game: GameState } | { ok: false; error: string }

export function importSave(text: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El archivo no es una partida de Lifetime (no se puede leer).' }
  }
  const file = raw as Partial<SaveFile>
  if (!file || file.format !== SAVE_FORMAT) return { ok: false, error: 'El archivo no es una partida de Lifetime.' }
  if (typeof file.version !== 'number' || file.version > SAVE_FORMAT_VERSION) {
    return { ok: false, error: 'La partida es de una versión más nueva del juego.' }
  }
  if (!validClub(file.club)) return { ok: false, error: 'La partida está dañada (falta el club).' }
  const game = parseGame(file.game)
  if (!game) return { ok: false, error: 'La partida es de una versión anterior del juego y ya no se puede cargar.' }
  return { ok: true, club: file.club, game }
}

// Nombre de archivo: lifetime-nombre-del-club-t12.json
export function saveFileName(club: Club, game: GameState): string {
  const slug = club.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `lifetime-${slug || 'club'}-t${game.season}.json`
}

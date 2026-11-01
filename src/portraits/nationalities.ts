/**
 * Pesos por nacionalidad para que las combinaciones sean creíbles.
 * Un peso mayor = más probable. Los arreglos se leen por posición.
 * Si añades más variantes que pesos, las que falten valen 1.
 *
 * ORDEN DE TONOS DE PIEL:   [claro, trigueño, medio, moreno, oscuro]
 * ORDEN DE OJOS (tus 3 actuales): [azul marino/oscuro, gris azulado, marrón rojizo]
 * ORDEN DE PELO: [castaño oscuro, negro, castaño, rubio, pelirrojo]  (ver HAIR_COLORS)
 */

export interface NationalityProfile {
  skin: number[];
  eyes: number[];
  /** Color de pelo (ver HAIR_COLORS). */
  hair: number[];
  /** Multiplicador de la probabilidad de barba (1 = normal). */
  beard?: number;
}

const UNIFORM: NationalityProfile = { skin: [1, 1, 1, 1, 1], eyes: [1, 1, 1], hair: [1, 1, 1, 1, 1] };

const PROFILES: Record<string, NationalityProfile> = {
  espana: { skin: [30, 40, 20, 8, 2], eyes: [25, 15, 60], hair: [35, 30, 25, 8, 2], beard: 1.2 },
  inglaterra: { skin: [45, 20, 8, 15, 12], eyes: [30, 40, 30], hair: [15, 10, 30, 30, 15], beard: 1 },
  francia: { skin: [35, 20, 10, 15, 20], eyes: [30, 30, 40], hair: [25, 15, 30, 25, 5], beard: 1 },
  portugal: { skin: [35, 40, 15, 7, 3], eyes: [25, 15, 60], hair: [35, 30, 25, 8, 2], beard: 1.2 },
  italia: { skin: [35, 45, 15, 4, 1], eyes: [25, 15, 60], hair: [35, 30, 28, 5, 2], beard: 1.3 },
  alemania: { skin: [60, 25, 7, 5, 3], eyes: [25, 45, 30], hair: [15, 10, 30, 38, 7], beard: 1 },
  argentina: { skin: [40, 40, 15, 4, 1], eyes: [25, 15, 60], hair: [35, 25, 28, 10, 2], beard: 1.1 },
  brasil: { skin: [15, 25, 25, 20, 15], eyes: [25, 8, 67], hair: [40, 40, 14, 5, 1], beard: 0.9 },
  mexico: { skin: [10, 30, 40, 18, 2], eyes: [25, 3, 72], hair: [45, 42, 10, 2, 1], beard: 1 },
  colombia: { skin: [10, 25, 35, 22, 8], eyes: [25, 4, 71], hair: [42, 40, 14, 3, 1], beard: 1 },
};

/** "España" -> "espana", "México" -> "mexico". */
export function normalizeNationality(n: string): string {
  return n
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getProfile(nationality: string): NationalityProfile {
  return PROFILES[normalizeNationality(nationality)] ?? UNIFORM;
}

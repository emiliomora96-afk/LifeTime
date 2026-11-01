import { AGING, HAIR_COLORS, LAYER_COUNTS } from './config';
import { getProfile } from './nationalities';

/** Descripción de un retrato: qué variante de cada capa usar. */
export interface PortraitSpec {
  skin: number; // 0-based
  eyes: number;
  nose: number;
  mouth: number;
  hair: number | null;
  /** Índice en HAIR_COLORS (el mismo color se usa para pelo y barba). */
  hairColor: number;
  beard: number | null;
  wrinkles: number | null;
  /** 0 = sin arrugas, 1 = máximo. */
  wrinkleAlpha: number;
  /** 0 = pelo normal, 1 = totalmente gris. */
  hairGray: number;
}

// --- Aleatoriedad determinista: el mismo seed siempre da la misma cara ---

function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand: () => number, count: number, weights: number[] = []): number {
  const w: number[] = [];
  for (let i = 0; i < count; i++) w.push(Math.max(0, weights[i] ?? 1));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rand() * count);
  let r = rand() * total;
  for (let i = 0; i < count; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return count - 1;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (age: number, from: number, to: number) => clamp01((age - from) / (to - from));

/**
 * Genera la descripción del retrato de un jugador.
 * @param seed         id o nombre del jugador (estable en el tiempo)
 * @param nationality  "España", "Brasil", etc.
 * @param age          edad actual (los años van envejeciendo la cara)
 */
export function generatePortraitSpec(
  seed: string | number,
  nationality: string,
  age: number,
): PortraitSpec {
  // La identidad (rasgos) depende SOLO del seed, no de la edad,
  // para que el jugador sea el mismo al envejecer.
  // Cada rasgo tiene su PROPIO generador: si más adelante añades más peinados,
  // cambian los peinados pero no los ojos, bocas ni tonos de piel de nadie.
  const rng = (trait: string) => mulberry32(hashSeed(`${seed}|${trait}`));
  const profile = getProfile(nationality);

  const skin = pickWeighted(rng('piel'), LAYER_COUNTS.base, profile.skin);

  // Credibilidad: en pieles oscuras no salen rubios/pelirrojos ni ojos claros.
  const darkSkin = skin >= 3;
  const midSkin = skin === 2;
  const eyeW = profile.eyes.map((w, i) => (darkSkin && i === 1 ? 0 : w));
  const hairW = profile.hair.map((w, i) => {
    if (darkSkin) return i === 3 || i === 4 ? 0 : i === 2 ? w * 0.3 : i === 1 ? w * 1.3 : w;
    if (midSkin) return i === 3 || i === 4 ? w * 0.25 : w;
    return w;
  });

  const eyes = pickWeighted(rng('ojos'), LAYER_COUNTS.ojos, eyeW);
  const nose = pickWeighted(rng('nariz'), LAYER_COUNTS.nariz);
  const mouth = pickWeighted(rng('boca'), LAYER_COUNTS.boca);
  const hair = LAYER_COUNTS.pelo > 0 ? pickWeighted(rng('pelo'), LAYER_COUNTS.pelo) : null;
  const hairColor = pickWeighted(rng('colorPelo'), HAIR_COLORS.length, hairW);

  // Tira fija de barba (también independiente de la edad): si el jugador
  // "es de barba", le sale cuando la edad lo permite.
  const beardRoll = rng('barbaTira')();
  const beardVariant = LAYER_COUNTS.barba > 0 ? pickWeighted(rng('barba'), LAYER_COUNTS.barba) : null;
  const beardChance =
    (AGING.beardChanceYoung + (AGING.beardChanceOld - AGING.beardChanceYoung) * ramp(age, 18, 40)) *
    (profile.beard ?? 1);
  const beard = beardVariant !== null && beardRoll < beardChance ? beardVariant : null;

  const wrinkleVariant = LAYER_COUNTS.arrugas > 0 ? pickWeighted(rng('arrugas'), LAYER_COUNTS.arrugas) : null;
  const wrinkleAlpha = ramp(age, AGING.wrinklesFrom, AGING.wrinklesFull);

  return {
    skin,
    eyes,
    nose,
    mouth,
    hair,
    hairColor,
    beard,
    wrinkles: wrinkleVariant !== null && wrinkleAlpha > 0 ? wrinkleVariant : null,
    wrinkleAlpha,
    hairGray: ramp(age, AGING.grayFrom, AGING.grayFull) * AGING.grayMax,
  };
}

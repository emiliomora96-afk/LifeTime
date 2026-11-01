/**
 * CONFIGURACIÓN DEL GENERADOR DE RETRATOS - LIFETIME
 *
 * Todas las coordenadas son del lienzo de referencia de 1024 x 1024
 * (el mismo tamaño que genera Gemini). El motor escala todo al tamaño
 * que pidas, así que NO tienes que tocar nada más para cambiar el tamaño final.
 */

export const CANVAS = 1024;

/** Carpeta pública donde viven las imágenes (Vite sirve /public en la raíz o en la subcarpeta de tu publicación, vía BASE_URL). */
export const ASSET_BASE = `${import.meta.env.BASE_URL}portraits`;

/**
 * Cuántas variantes tienes de cada capa.
 * Al añadir una imagen nueva (ej. ojos_04.png) sube el número aquí. Nada más.
 *
 * Nombres de archivo esperados (con 2 dígitos):
 *   base/tono1.png ... tono5.png      (cuerpo + camiseta + tono de piel)
 *   ojos/ojos_01.png                  (ojos + cejas, recortados)
 *   nariz/nariz_01.png                (recortada)
 *   boca/boca_01.png                  (recortada)
 *   pelo/pelo_01.png                  (lienzo completo 1024x1024, fondo transparente)
 *   barba/barba_01.png                (lienzo completo 1024x1024, fondo transparente)
 *   arrugas/arrugas_01.png            (lienzo completo 1024x1024, fondo transparente)
 */
export const LAYER_COUNTS = {
  base: 5,
  ojos: 3,
  nariz: 1,
  boca: 5,
  pelo: 7,
  barba: 2,
  arrugas: 1,
} as const;

export type PieceLayer = 'ojos' | 'nariz' | 'boca' | 'pelo' | 'barba' | 'arrugas';

/**
 * POSICIÓN DE LAS PIEZAS RECORTADAS (ojos, nariz, boca).
 *
 *  cx, cy : centro de la pieza dentro del lienzo de 1024
 *  width  : ancho final de la pieza en el lienzo de 1024.
 *           La pieza se escala a este ancho conservando su proporción,
 *           así todas las variantes (aunque Gemini las dibuje más grandes
 *           o más pequeñas) quedan del mismo tamaño.
 *
 * Para mover algo: sube cy para bajarlo, baja cy para subirlo.
 * Para agrandar: sube width.
 */
export const ANCHORS: Record<'ojos' | 'nariz' | 'boca', { cx: number; cy: number; width: number }> = {
  ojos: { cx: 512, cy: 380, width: 294 },
  nariz: { cx: 512, cy: 465, width: 30 },
  boca: { cx: 512, cy: 560, width: 116 }, // la mandíbula está en ~630
};

/**
 * AJUSTE FINO POR VARIANTE (opcional).
 * Multiplica el ancho de una variante concreta (0 = la primera). 1 = sin cambio.
 * Útil si, por ejemplo, la sonrisa con dientes se ve demasiado grande.
 */
export const PIECE_SCALE: Partial<Record<'ojos' | 'nariz' | 'boca', number[]>> = {
  boca: [1, 1, 1, 0.85, 0.85],
};

/**
 * AJUSTE DEL PELO sobre la cabeza.
 *  dy    : negativo = sube el pelo (cubre más la coronilla), positivo = lo baja.
 *  dx    : desplazamiento horizontal.
 *  scale : agranda/achica el pelo respecto al punto (pivotX, pivotY).
 */
export const HAIR_ADJUST = { dx: 0, dy: -20, scale: 1, pivotX: 512, pivotY: 300 };

/**
 * PATILLAS / MECHAS BAJO LAS OREJAS.
 * El motor (para CUALQUIER pelo):
 *   1. separa lo que está por debajo de `fromY`,
 *   2. aparta las mechas izquierda y derecha `shift` px hacia afuera,
 *   3. borra de ellas lo que caiga sobre la silueta de la cara/cuello.
 * enabled : false para peinados largos (si no, partiría el pelo en dos).
 */
export const SIDEBURNS = { enabled: true, fromY: 450, shift: 8 };

/**
 * AJUSTE DE LA BARBA (los dibujos vienen con el bigote muy alto, rozando la nariz).
 * El motor comprime la barba en vertical manteniendo FIJA la barbilla:
 *  anchorY : y de la barbilla en el dibujo (no se mueve). Es el punto más bajo de la barba.
 *  scaleY  : 1 = sin cambio. Más chico = el bigote/mejillas bajan más (0.85 baja el bigote ~26 px).
 *  dy      : desplazamiento vertical extra de toda la barba (positivo = baja).
 *  mouthDy : cuánto baja la boca cuando el jugador tiene barba (para que quede en el hueco del bigote).
 */
export const BEARD_ADJUST = { anchorY: 657, scaleY: 0.85, dy: 0, mouthDy: 8 };

/** Orden de dibujo, de atrás hacia delante. La boca va DESPUÉS de la barba para que nunca la tape. El pelo va al final (tapa cejas/frente). */
export const DRAW_ORDER: Array<'base' | PieceLayer> = [
  'base',
  'arrugas',
  'ojos',
  'nariz',
  'barba',
  'boca',
  'pelo',
];

/**
 * COLORES DE PELO (y barba). Los dibujos son castaño oscuro: el motor los
 * "tiñe" conservando líneas y brillos. El mismo color se usa en pelo y barba.
 * Nombres, en el mismo orden que los pesos `hair` de nationalities.ts.
 */
export const HAIR_COLORS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: 'castaño oscuro', rgb: [44, 33, 26] },
  { name: 'negro', rgb: [26, 24, 30] },
  { name: 'castaño', rgb: [120, 78, 46] },
  { name: 'rubio', rgb: [222, 184, 104] },
  { name: 'pelirrojo', rgb: [176, 76, 38] },
];

/** Edad -> efectos visuales de envejecimiento. */
export const AGING = {
  wrinklesFrom: 30,
  wrinklesFull: 40,
  grayFrom: 33,
  grayFull: 42,
  grayMax: 0.75,
  beardChanceYoung: 0.1,
  beardChanceOld: 0.45,
};

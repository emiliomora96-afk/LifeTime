import {
  ANCHORS,
  ASSET_BASE,
  BEARD_ADJUST,
  CANVAS,
  DRAW_ORDER,
  HAIR_ADJUST,
  HAIR_COLORS,
  PIECE_SCALE,
  SIDEBURNS,
  type PieceLayer,
} from './config';
import type { PortraitSpec } from './generator';

// ---------- Carga de imágenes (con caché) ----------

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function urlFor(layer: 'base' | PieceLayer, index: number): string {
  if (layer === 'base') return `${ASSET_BASE}/base/tono${index + 1}.png`;
  return `${ASSET_BASE}/${layer}/${layer}_${pad2(index + 1)}.png`;
}

function newCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CANVAS;
  c.height = CANVAS;
  return c;
}

// ---------- Color de pelo + canas ----------
// Tiñe el dibujo (castaño oscuro) al color pedido conservando líneas y brillos,
// y después lo mezcla hacia gris según las canas. Sirve para pelo y barba.

const tintCache = new Map<string, HTMLCanvasElement>();
const meanLumCache = new Map<string, number>();

function recolor(
  img: HTMLImageElement,
  url: string,
  colorIndex: number,
  gray: number,
): HTMLCanvasElement {
  const key = `${url}|${colorIndex}|${gray.toFixed(2)}`;
  const hit = tintCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;

  // Luminancia media de ESTE dibujo (se calcula una sola vez por imagen).
  let mean = meanLumCache.get(url);
  if (mean === undefined) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
    mean = n ? sum / n : 40;
    meanLumCache.set(url, mean);
  }

  const target = (HAIR_COLORS[colorIndex] ?? HAIR_COLORS[0]).rgb;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const f = Math.min(1.2, Math.max(0.2, Math.pow(lum / mean, 0.85)));
    let r = Math.min(255, target[0] * f);
    let g = Math.min(255, target[1] * f);
    let b = Math.min(255, target[2] * f);
    if (gray > 0.01) {
      const gv = Math.min(255, lum * 1.6 + 92); // gris claro que conserva líneas y mechones
      r += (gv - r) * gray;
      g += (gv - g) * gray;
      b += (gv - b) * gray;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  tintCache.set(key, c);
  return c;
}

// ---------- Pelo ajustado (posición + patillas) ----------

const hairCache = new Map<string, HTMLCanvasElement>();

/**
 * Devuelve el pelo ya teñido, colocado (HAIR_ADJUST) y con las patillas
 * acomodadas (SIDEBURNS) en un lienzo de 1024x1024. Se guarda en caché.
 */
function fittedHair(
  hairImg: HTMLImageElement,
  hairUrl: string,
  colorIndex: number,
  gray: number,
  baseImg: HTMLImageElement,
  baseUrl: string,
): HTMLCanvasElement {
  const key = `${hairUrl}|${colorIndex}|${gray.toFixed(2)}|${baseUrl}`;
  const hit = hairCache.get(key);
  if (hit) return hit;

  const H = HAIR_ADJUST;
  const S = SIDEBURNS;
  const src = recolor(hairImg, hairUrl, colorIndex, gray);

  // 1) Pelo completo, movido/escalado según HAIR_ADJUST.
  const placed = newCanvas();
  placed
    .getContext('2d')!
    .drawImage(
      src,
      H.pivotX - H.pivotX * H.scale + H.dx,
      H.pivotY - H.pivotY * H.scale + H.dy,
      CANVAS * H.scale,
      CANVAS * H.scale,
    );

  if (!S.enabled) {
    hairCache.set(key, placed);
    return placed;
  }

  const out = newCanvas();
  const o = out.getContext('2d')!;
  const half = CANVAS / 2;
  const lowH = CANVAS - S.fromY;

  // 2) Parte alta del pelo: tal cual.
  o.drawImage(placed, 0, 0, CANVAS, S.fromY, 0, 0, CANVAS, S.fromY);

  // 3) Parte baja (patillas): cada lado se aparta hacia afuera...
  const low = newCanvas();
  const l = low.getContext('2d')!;
  l.drawImage(placed, 0, S.fromY, half, lowH, -S.shift, S.fromY, half, lowH);
  l.drawImage(placed, half, S.fromY, half, lowH, half + S.shift, S.fromY, half, lowH);
  // ...y se borra lo que caiga sobre la cara/cuello (la silueta de la base).
  l.globalCompositeOperation = 'destination-out';
  l.drawImage(baseImg, 0, S.fromY, CANVAS, lowH, 0, S.fromY, CANVAS, lowH);
  o.drawImage(low, 0, S.fromY, CANVAS, lowH, 0, S.fromY, CANVAS, lowH);

  hairCache.set(key, out);
  return out;
}

// ---------- Dibujo ----------

function indexFor(spec: PortraitSpec, layer: 'base' | PieceLayer): number | null {
  switch (layer) {
    case 'base': return spec.skin;
    case 'ojos': return spec.eyes;
    case 'nariz': return spec.nose;
    case 'boca': return spec.mouth;
    case 'pelo': return spec.hair;
    case 'barba': return spec.beard;
    case 'arrugas': return spec.wrinkles;
  }
}

/**
 * Dibuja el retrato en un canvas ya creado.
 * @param size  lado del cuadrado en píxeles reales del canvas
 */
export async function drawPortrait(
  ctx: CanvasRenderingContext2D,
  spec: PortraitSpec,
  size: number = CANVAS,
): Promise<void> {
  const k = size / CANVAS;

  // Cargamos todo en paralelo; si una capa opcional falta, se omite sin romper.
  const jobs = DRAW_ORDER.map(async (layer) => {
    const index = indexFor(spec, layer);
    if (index === null) return null;
    const url = urlFor(layer, index);
    try {
      return { layer, index, url, img: await loadImage(url) };
    } catch (e) {
      if (layer === 'base') throw e; // la base es obligatoria
      console.warn(e);
      return null;
    }
  });
  const loaded = await Promise.all(jobs);
  const base = loaded.find((it) => it && it.layer === 'base');

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const item of loaded) {
    if (!item) continue;
    const { layer, index, url, img } = item;

    if (layer === 'ojos' || layer === 'nariz' || layer === 'boca') {
      // Pieza recortada: se escala al ancho configurado y se centra en (cx, cy).
      const a = ANCHORS[layer];
      const w = a.width * (PIECE_SCALE[layer]?.[index] ?? 1) * k;
      const h = (img.naturalHeight / img.naturalWidth) * w;
      // Con barba, la boca baja un poco para quedar en el hueco del bigote.
      const extraY = layer === 'boca' && spec.beard !== null ? BEARD_ADJUST.mouthDy : 0;
      ctx.drawImage(img, a.cx * k - w / 2, (a.cy + extraY) * k - h / 2, w, h);
    } else if (layer === 'pelo') {
      const fitted = base
        ? fittedHair(img, url, spec.hairColor, spec.hairGray, base.img, base.url)
        : recolor(img, url, spec.hairColor, spec.hairGray);
      ctx.drawImage(fitted, 0, 0, size, size);
    } else if (layer === 'barba') {
      // Barba comprimida en vertical con la barbilla fija (bigote lejos de la nariz).
      const B = BEARD_ADJUST;
      const top = (B.anchorY - B.anchorY * B.scaleY + B.dy) * k;
      ctx.drawImage(
        recolor(img, url, spec.hairColor, spec.hairGray),
        0,
        top,
        size,
        size * B.scaleY,
      );
    } else if (layer === 'arrugas') {
      ctx.globalAlpha = spec.wrinkleAlpha;
      ctx.drawImage(img, 0, 0, size, size);
      ctx.globalAlpha = 1;
    } else {
      // base: lienzo completo
      ctx.drawImage(img, 0, 0, size, size);
    }
  }
}

/** Precarga todas las capas de un retrato (útil antes de mostrar una lista larga). */
export async function preloadPortrait(spec: PortraitSpec): Promise<void> {
  await Promise.all(
    DRAW_ORDER.map((layer) => {
      const index = indexFor(spec, layer);
      return index === null ? null : loadImage(urlFor(layer, index)).catch(() => null);
    }),
  );
}

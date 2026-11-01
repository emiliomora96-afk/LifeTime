import { useEffect, useMemo, useRef } from 'react';
import { generatePortraitSpec } from './generator';
import { drawPortrait } from './renderer';

export interface PlayerPortraitProps {
  /** id o nombre estable del jugador: el mismo valor da siempre la misma cara. */
  seed: string | number;
  nationality: string;
  age: number;
  /** Lado en píxeles CSS (por defecto 160). */
  size?: number;
  className?: string;
}

export function PlayerPortrait({ seed, nationality, age, size = 160, className }: PlayerPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = useMemo(() => generatePortraitSpec(seed, nationality, age), [seed, nationality, age]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPortrait(ctx, spec, px).catch((e) => {
      if (!cancelled) console.error(e);
    });
    return () => {
      cancelled = true;
    };
  }, [spec, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Retrato del jugador"
    />
  );
}

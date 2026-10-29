import { useEffect, useRef } from 'react';
import type { Scene } from '../../domain/design/layout';
import { drawScene } from '../../render/canvas';
import { cx } from '../../lib/cx';

/**
 * Canvas que desenha uma cena. `resolution` define a escala interna:
 * 1 = resolução final (a mesma do PNG), valores menores para miniaturas.
 */
export function SlideCanvas({
  scene,
  resolution = 1,
  label,
  className,
}: {
  scene: Scene;
  resolution?: number;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = Math.round(scene.width * resolution);
  const h = Math.round(scene.height * resolution);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawScene(ctx, scene, resolution);
  }, [scene, resolution]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      role="img"
      aria-label={label}
      className={cx('slide-canvas', className)}
      style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
    />
  );
}

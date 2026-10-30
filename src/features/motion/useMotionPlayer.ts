import { useCallback, useEffect, useRef, useState } from 'react';
import type { Timeline } from '../../domain/motion/timeline';

/**
 * Reprodução da pré-visualização. O quadro exibido vem do relógio real
 * (não de contagem de requestAnimationFrame), então a velocidade é correta
 * mesmo quando o navegador pula quadros.
 */
export function useMotionPlayer(timeline: Timeline | null) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = timeline?.totalFrames ?? 0;
  const fps = timeline?.fps ?? 30;
  const origin = useRef<{ time: number; frame: number } | null>(null);

  // Mantém o quadro dentro do intervalo quando a duração muda.
  const current = total ? Math.min(frame, total - 1) : 0;

  useEffect(() => {
    if (!playing || !total) return;
    let raf = 0;
    origin.current = { time: performance.now(), frame: current >= total - 1 ? 0 : current };
    const tick = (now: number) => {
      const o = origin.current!;
      const next = o.frame + Math.floor(((now - o.time) / 1000) * fps);
      if (next >= total) {
        setFrame(total - 1);
        setPlaying(false);
        return;
      }
      setFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `current` fica de fora de propósito: só define o ponto de partida ao dar play.
  }, [playing, total, fps]);

  const seek = useCallback(
    (f: number) => {
      setPlaying(false);
      setFrame(Math.max(0, Math.min(total - 1, Math.round(f))));
    },
    [total],
  );

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  return { frame: current, playing, toggle, seek, setPlaying };
}

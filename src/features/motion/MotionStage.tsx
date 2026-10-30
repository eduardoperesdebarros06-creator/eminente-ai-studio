import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Pause, Play, SkipBack } from 'lucide-react';
import { Button } from '../../components/ui';
import type { Scene } from '../../domain/design/layout';
import { formatTime, frameTime, sceneAt, type Timeline } from '../../domain/motion/timeline';
import { cx } from '../../lib/cx';
import { drawMotionFrame } from '../../render/motion';

/** Maior lado do canvas da pré-visualização (o MP4 sai na resolução final). */
const PREVIEW_MAX = 960;

export function MotionStage({
  scenes,
  timeline,
  frame,
  playing,
  onToggle,
  onSeek,
  selected,
  onSelectScene,
  sceneHasError,
}: {
  scenes: readonly Scene[];
  timeline: Timeline;
  frame: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (frame: number) => void;
  selected: number;
  onSelectScene: (index: number) => void;
  sceneHasError: (index: number) => boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const first = scenes[0]!;
  const scale = Math.min(1, PREVIEW_MAX / Math.max(first.width, first.height));
  const w = Math.round(first.width * scale);
  const h = Math.round(first.height * scale);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawMotionFrame(ctx, scenes, timeline, frame, scale);
  }, [scenes, timeline, frame, scale]);

  const t = frameTime(timeline, frame);
  const active = sceneAt(timeline, t);
  const step = (delta: number) => onSeek(frame + delta);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      onToggle();
    } else if (e.key === 'ArrowLeft') step(e.shiftKey ? -timeline.fps : -1);
    else if (e.key === 'ArrowRight') step(e.shiftKey ? timeline.fps : 1);
    else if (e.key === 'Home') onSeek(0);
  };

  return (
    <div className="motion-player">
      <div
        className="stage stage--motion"
        tabIndex={0}
        onKeyDown={onKey}
        aria-label="Pré-visualização do vídeo. Espaço reproduz ou pausa; setas avançam quadro a quadro (Shift: 1 segundo)."
      >
        <canvas
          ref={ref}
          width={w}
          height={h}
          role="img"
          aria-label={`Quadro ${frame + 1} de ${timeline.totalFrames}, cena ${active + 1}`}
          className="slide-canvas stage__canvas"
          style={{ aspectRatio: `${first.width} / ${first.height}` }}
        />
      </div>

      <div className="transport">
        <Button variant="ghost" size="sm" icon={SkipBack} aria-label="Voltar ao início" onClick={() => onSeek(0)} />
        <Button variant="primary" size="sm" icon={playing ? Pause : Play} onClick={onToggle}>
          {playing ? 'Pausar' : 'Reproduzir'}
        </Button>
        <span className="transport__time mono">
          {formatTime(t)} / {formatTime(timeline.durationSec)}
        </span>
        <input
          className="transport__scrub"
          type="range"
          min={0}
          max={timeline.totalFrames - 1}
          step={1}
          value={frame}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Posição no vídeo"
          aria-valuetext={`${formatTime(t)} de ${formatTime(timeline.durationSec)}`}
        />
        <span className="transport__frame mono">
          {frame + 1}/{timeline.totalFrames}
        </span>
      </div>

      <div className="timeline">
        <ol className="timeline__track" aria-label="Cenas na linha do tempo">
          {timeline.scenes.map((s) => {
            const dur = s.end - s.start;
            return (
              <li key={s.index} style={{ flexGrow: dur }}>
                <button
                  type="button"
                  className={cx(
                    'timeline__scene',
                    s.index === active && 'timeline__scene--playing',
                    s.index === selected && 'timeline__scene--selected',
                    sceneHasError(s.index) && 'timeline__scene--error',
                  )}
                  aria-current={s.index === selected ? 'true' : undefined}
                  onClick={() => {
                    onSelectScene(s.index);
                    onSeek(Math.round(s.start * timeline.fps));
                  }}
                >
                  <span className="timeline__num">{String(s.index + 1).padStart(2, '0')}</span>
                  <span className="timeline__dur">{dur.toLocaleString('pt-BR')} s</span>
                </button>
              </li>
            );
          })}
        </ol>
        <span className="timeline__playhead" aria-hidden style={{ left: `${(t / timeline.durationSec) * 100}%` }} />
      </div>
    </div>
  );
}

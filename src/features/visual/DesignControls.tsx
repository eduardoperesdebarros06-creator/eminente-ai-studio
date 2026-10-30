import { Card, CardHeader, Segmented, Switch, TextInput } from '../../components/ui';
import type { DraftAction } from '../../domain/content/draft';
import type { ContentDraft } from '../../domain/content/types';
import { FORMATS_BY_CONTENT, getFormat, type FormatId } from '../../domain/design/formats';
import {
  effectiveFormat,
  HANDLE_MAX,
  MOTION_FPS,
  MOTION_TRANSITIONS,
  TRANSITION_LABELS,
  type MotionFps,
  type MotionTransition,
} from '../../domain/design/settings';
import { THEMES } from '../../domain/design/themes';
import { cx } from '../../lib/cx';

export function DesignControls({ draft, dispatch }: { draft: ContentDraft; dispatch: (a: DraftAction) => void }) {
  const kind = draft.brief.format;
  const design = draft.design;
  const formatId = effectiveFormat(design, kind);
  const set = (patch: Partial<typeof design>) => dispatch({ type: 'design/set', patch });
  const isCarousel = kind === 'carousel';

  return (
    <Card className="studio-panel">
      <CardHeader title="Aparência" description="Vale para todas as páginas desta peça." />
      <div className="form studio-panel__body">
        <div className="field">
          <span className="field__label" aria-hidden>
            Formato
          </span>
          <Segmented<FormatId>
            label="Formato"
            value={formatId}
            onChange={(f) => set({ formatId: f })}
            fullWidth
            size="sm"
            options={FORMATS_BY_CONTENT[kind].map((id) => ({ value: id, label: getFormat(id).ratio }))}
          />
          <p className="field__hint">
            {getFormat(formatId).label} · {getFormat(formatId).width} × {getFormat(formatId).height} px
          </p>
        </div>

        <div className="field">
          <span className="field__label" id="theme-label">
            Tema
          </span>
          <div className="theme-list" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((t) => {
              const active = t.id === design.themeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={cx('theme-option', active && 'theme-option--active')}
                  onClick={() => set({ themeId: t.id })}
                >
                  <span className="theme-option__swatch" style={{ background: t.background }} aria-hidden>
                    <span style={{ background: t.accent }} />
                    <span style={{ background: t.text }} />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <TextInput
          label="Assinatura"
          value={design.handle}
          placeholder="@eminente"
          maxLength={HANDLE_MAX}
          onChange={(e) => set({ handle: e.target.value })}
          hint="Aparece no rodapé. Deixe vazio para ocultar."
          counter={{ current: design.handle.length, max: HANDLE_MAX }}
        />

        {kind === 'motion' && (
          <>
            <div className="field">
              <span className="field__label" aria-hidden>
                Quadros por segundo
              </span>
              <Segmented<`${MotionFps}`>
                label="Quadros por segundo"
                value={`${design.fps}`}
                onChange={(v) => set({ fps: Number(v) as MotionFps })}
                fullWidth
                size="sm"
                options={MOTION_FPS.map((f) => ({ value: `${f}` as const, label: `${f} fps` }))}
              />
              <p className="field__hint">30 fps serve para redes sociais; 60 fps deixa o movimento mais suave e o arquivo maior.</p>
            </div>
            <div className="field">
              <span className="field__label" aria-hidden>
                Transição entre cenas
              </span>
              <Segmented<MotionTransition>
                label="Transição entre cenas"
                value={design.transition}
                onChange={(v) => set({ transition: v })}
                fullWidth
                size="sm"
                options={MOTION_TRANSITIONS.map((t) => ({ value: t, label: TRANSITION_LABELS[t] }))}
              />
            </div>
          </>
        )}

        {isCarousel && (
          <>
            <Switch label="Numeração das páginas" checked={design.showPageNumbers} onChange={(v) => set({ showPageNumbers: v })} />
            <Switch
              label="Indicação “Arraste →”"
              hint="Exibida em todas as páginas, exceto a última."
              checked={design.showSwipeHint}
              onChange={(v) => set({ showSwipeHint: v })}
            />
          </>
        )}
      </div>
    </Card>
  );
}

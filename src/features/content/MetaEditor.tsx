import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, TextArea, TextInput } from '../../components/ui';
import type { DraftAction } from '../../domain/content/draft';
import { parseHashtags } from '../../domain/content/hashtags';
import { LIMITS } from '../../domain/content/limits';
import type { ContentDraft } from '../../domain/content/types';
import type { DraftIssue } from '../../domain/content/validate';

export function MetaEditor({
  draft,
  issues,
  dispatch,
}: {
  draft: ContentDraft;
  issues: DraftIssue[];
  dispatch: (a: DraftAction) => void;
}) {
  // Hashtags são editadas como texto livre e normalizadas ao sair do campo,
  // para não "comer" o que o usuário ainda está digitando.
  const [raw, setRaw] = useState(draft.hashtags.join(' '));
  const editing = useRef(false);
  const joined = draft.hashtags.join(' ');
  useEffect(() => {
    if (!editing.current) setRaw(joined);
  }, [joined]);

  const preview = parseHashtags(raw);
  const error = (field: DraftIssue['field']) => issues.find((i) => i.field === field && i.severity === 'error')?.message;

  return (
    <Card className="meta-editor">
      <CardHeader title="Publicação" description="Texto que acompanha a peça na rede social." />
      <div className="form studio-panel__body">
        <TextArea
          label="Legenda"
          rows={5}
          value={draft.caption}
          placeholder="Desenvolva a ideia, conte o contexto e conduza para o CTA."
          onChange={(e) => dispatch({ type: 'meta/set', patch: { caption: e.target.value } })}
          error={error('caption')}
          counter={{ current: draft.caption.length, max: LIMITS.caption.max }}
        />
        <TextInput
          label="CTA"
          value={draft.cta}
          placeholder="Ex.: Salve este post para consultar depois"
          onChange={(e) => dispatch({ type: 'meta/set', patch: { cta: e.target.value } })}
          error={error('cta')}
          counter={{ current: draft.cta.trim().length, max: LIMITS.cta.max }}
        />
        <TextInput
          label="Hashtags"
          value={raw}
          placeholder="#marketing #ia #gestao"
          onFocus={() => (editing.current = true)}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => {
            editing.current = false;
            const normalized = parseHashtags(raw).join(' ');
            if (normalized !== joined) dispatch({ type: 'hashtags/set', value: raw });
            setRaw(normalized);
          }}
          error={error('hashtags')}
          hint="Separe por espaço ou vírgula. Normalizadas ao sair do campo."
          counter={{ current: preview.length, max: LIMITS.hashtags.max }}
        />
        {preview.length > 0 && (
          <ul className="tag-list" aria-label="Hashtags reconhecidas">
            {preview.map((t) => (
              <li key={t} className="tag">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

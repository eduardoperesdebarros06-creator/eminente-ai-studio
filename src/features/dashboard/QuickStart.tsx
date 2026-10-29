import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { navigate, pathWithQuery } from '../../app/router';
import { Button } from '../../components/ui';
import { LIMITS } from '../../domain/content/limits';

/** Campo do hero: leva o assunto direto para o briefing do Content Studio. */
export function QuickStart() {
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = subject.replace(/\s+/g, ' ').trim();
    if (value.length < LIMITS.subject.min) {
      setError(`Escreva um assunto com pelo menos ${LIMITS.subject.min} caracteres.`);
      return;
    }
    navigate(pathWithQuery('/content', { assunto: value.slice(0, LIMITS.subject.max) }));
  }

  return (
    <form className="quickstart" onSubmit={submit} noValidate>
      <label htmlFor="quickstart-subject" className="sr-only">
        Assunto do conteúdo
      </label>
      <div className="quickstart__row">
        <input
          id="quickstart-subject"
          className="input quickstart__input"
          placeholder="Sobre o que vamos falar hoje?"
          value={subject}
          maxLength={LIMITS.subject.max}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'quickstart-error' : undefined}
          onChange={(e) => {
            setSubject(e.target.value);
            setError(null);
          }}
        />
        <Button type="submit" variant="primary" size="lg" iconRight={ArrowRight}>
          Criar conteúdo
        </Button>
      </div>
      {error && (
        <p id="quickstart-error" className="field__hint field__hint--error">
          {error}
        </p>
      )}
    </form>
  );
}

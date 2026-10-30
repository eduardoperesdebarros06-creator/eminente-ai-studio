import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentDraft } from '../../domain/content/types';
import { isFinished, type JobStatus, type RenderHealth } from '../../domain/motion/api';

export type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; health: RenderHealth }
  | { status: 'offline'; message: string };

const POLL_MS = 500;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Servidor local indisponível. Inicie o estúdio com "npm run dev".');
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || body === null) {
    throw new Error(body?.error ?? `O servidor respondeu ${res.status}. Inicie o estúdio com "npm run dev" (não apenas "vite").`);
  }
  return body;
}

/** Diagnóstico das ferramentas e acompanhamento da renderização no servidor local. */
export function useRenderJob() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const alive = useRef(true);

  const refreshHealth = useCallback(async () => {
    setHealth({ status: 'loading' });
    try {
      const h = await api<RenderHealth>('/api/health');
      if (alive.current) setHealth({ status: 'ready', health: h });
    } catch (e) {
      if (alive.current) setHealth({ status: 'offline', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refreshHealth();
    return () => {
      alive.current = false;
    };
  }, [refreshHealth]);

  // Acompanha o trabalho até terminar.
  const jobId = job && !isFinished(job.state) ? job.id : null;
  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(() => {
      api<JobStatus>(`/api/motion/jobs/${jobId}`)
        .then((s) => alive.current && setJob(s))
        .catch((e: unknown) => {
          if (!alive.current) return;
          setError(e instanceof Error ? e.message : String(e));
          setJob(null);
        });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [jobId]);

  const start = useCallback(async (draft: ContentDraft) => {
    setError(null);
    setStarting(true);
    try {
      const s = await api<JobStatus>('/api/motion/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      });
      setJob(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    if (!job) return;
    try {
      setJob(await api<JobStatus>(`/api/motion/jobs/${job.id}`, { method: 'DELETE' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [job]);

  const dismiss = useCallback(() => {
    setJob(null);
    setError(null);
  }, []);

  return { health, refreshHealth, job, error, starting, start, cancel, dismiss };
}

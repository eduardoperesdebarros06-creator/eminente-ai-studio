/** Chamada à API do servidor local, com mensagens de erro em português. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Servidor local indisponível. Inicie o estúdio com "npm run dev".');
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || body === null) {
    throw new Error(body?.error ?? `O servidor respondeu ${res.status}. Inicie o estúdio com "npm run dev" (não apenas "vite").`);
  }
  return body;
}

export const jsonBody = (method: string, body: unknown, extra?: RequestInit): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  ...extra,
});

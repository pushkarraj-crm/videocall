const API = process.env.API_URL ?? 'http://localhost:3001/v1';

export async function verifyApi(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; retries?: number; expectFail?: boolean } = {},
) {
  const retries = opts.retries ?? 6;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json();
    if (res.status === 429 && attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (opts.expectFail) {
      if (res.ok && json.success) throw new Error(`Expected failure for ${path}`);
      return json;
    }
    if (!res.ok || !json.success) {
      const err = new Error(json.error?.message ?? `API ${path} failed (${res.status})`) as Error & {
        code?: string;
        statusCode?: number;
      };
      err.code = json.error?.code;
      err.statusCode = res.status;
      throw err;
    }
    return json.data;
  }
  throw new Error(`API ${path} exhausted retries`);
}
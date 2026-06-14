export const API_BASE = (process.env['API_BASE'] ?? 'https://api-production-e6e2.up.railway.app/api/v1')
  .replace(/\/$/, '');

export interface ApiResponse<T = unknown> {
  status:   number;
  ok:       boolean;
  body:     T;
  rawText:  string;
}

/** Lightweight fetch wrapper — no auto-unwrap, returns raw shape for assertions. */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(url, {
    method:  opts.method ?? 'GET',
    headers,
    body:    opts.body ? JSON.stringify(opts.body) : undefined,
    signal:  AbortSignal.timeout(15_000),
  });

  const rawText = await res.text();
  let body: T;
  try { body = JSON.parse(rawText) as T; } catch { body = rawText as unknown as T; }

  return { status: res.status, ok: res.ok, body, rawText };
}

/** Login and return the accessToken. Throws if login fails. */
export async function login(email: string, password: string): Promise<string> {
  const res = await api<Record<string, unknown>>(
    '/auth/login',
    { method: 'POST', body: { email, password } },
  );
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status} — ${res.rawText}`);
  }
  const body = res.body as Record<string, unknown>;
  const data = body?.['data'] as Record<string, unknown> | undefined;
  const token = data?.['accessToken'] ?? body?.['accessToken'];
  if (!token) throw new Error(`No accessToken in login response for ${email}: ${res.rawText}`);
  return token as string;
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

/** Assert endpoint is alive: not 404, not 500. */
export function expectAlive(res: ApiResponse, label: string) {
  if (res.status === 404) throw new Error(`${label} → 404 Not Found`);
  if (res.status === 500) throw new Error(`${label} → 500 Internal Server Error`);
  if (res.status === 502) throw new Error(`${label} → 502 Bad Gateway`);
}

/** Assert a list endpoint returns an array (or paginated envelope). */
export function expectList(res: ApiResponse, label: string) {
  expectAlive(res, label);
  const b = res.body as Record<string, unknown>;
  const isArray    = Array.isArray(res.body);
  const hasData    = Array.isArray(b?.['data']);
  const hasSuccess = typeof b?.['success'] === 'boolean';
  if (!(isArray || hasData || hasSuccess)) {
    throw new Error(`${label} → expected list/paginated response, got: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
}

/** Assert a detail endpoint: not 404 and body has 'id' or 'data.id'. */
export function expectDetail(res: ApiResponse, label: string) {
  expectAlive(res, label);
  const b  = res.body as Record<string, unknown>;
  const data = b?.['data'] as Record<string, unknown> | undefined;
  const id = b?.['id'] ?? data?.['id'];
  if (!id) {
    throw new Error(`${label} → expected detail with id, got: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
}

/** Assert a 401 Unauthorized (not 404) for unauth'd protected endpoints. */
export function expectUnauthorized(res: ApiResponse, label: string) {
  if (res.status !== 401) throw new Error(`${label} → expected 401, got ${res.status}`);
}

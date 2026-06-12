// Polyfills for MSW v2 + Jest jsdom environment.
// @mswjs/interceptors references `Request` at class-definition time (extends Request).
// In Jest's jsdom environment, Node's built-in fetch globals may not be exposed on globalThis.
// We pull them from Node's native internals which are available in Node 18+.

// Use whatwg-url / node internals via the global undici (Node 18+).
// Node 18+ ships fetch built-in — but Jest's module-sandbox can hide it.
// We surface it manually here so @mswjs/interceptors can use it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

// Node 18+ exposes these under process's built-in loader context even when
// the Jest vm sandbox hides them. Pull via the internal channel:
if (!g.Request || !g.Response || !g.Headers) {
  try {
    // Try node:undici (internal alias for fetch globals)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const undici = require('node:undici') as typeof import('undici');
    if (!g.Request)    g.Request    = undici.Request;
    if (!g.Response)   g.Response   = undici.Response;
    if (!g.Headers)    g.Headers    = undici.Headers;
    if (!g.fetch)      g.fetch      = undici.fetch;
    if (!g.FormData)   g.FormData   = undici.FormData;
  } catch {
    // node:undici not available — fall through to next strategy
  }
}

if (!g.Request || !g.Response || !g.Headers) {
  try {
    // Direct undici package from node_modules (pnpm hoisted)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const undici = require('undici') as typeof import('undici');
    if (!g.Request)    g.Request    = undici.Request;
    if (!g.Response)   g.Response   = undici.Response;
    if (!g.Headers)    g.Headers    = undici.Headers;
    if (!g.fetch)      g.fetch      = undici.fetch;
    if (!g.FormData)   g.FormData   = undici.FormData;
  } catch {
    // Not available
  }
}

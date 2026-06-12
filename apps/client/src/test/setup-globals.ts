// Polyfill fetch globals for jest + msw/node compatibility.
// Must run before any msw imports (i.e., in setupFiles not setupFilesAfterEnv).

// TextEncoder / TextDecoder — needed by @mswjs/interceptors bufferUtils
if (typeof global.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// fetch / Request / Response / Headers — needed by @mswjs/interceptors fetchUtils
// Node 18+ exposes these on global via --experimental-fetch or natively (Node 21+).
// In jest's jsdom/node environment they may be stripped; re-attach from Node internals.
if (typeof global.Request === 'undefined') {
  // In Node 18+, these live on globalThis but may not be on `global` inside jest vm
  if (typeof globalThis.Request !== 'undefined') {
    global.Request = globalThis.Request as unknown as typeof global.Request;
    global.Response = globalThis.Response as unknown as typeof global.Response;
    global.Headers = globalThis.Headers as unknown as typeof global.Headers;
    global.fetch = globalThis.fetch as unknown as typeof global.fetch;
  }
}

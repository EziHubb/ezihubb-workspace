// Polyfill fetch globals for jest + msw/node compatibility.
// Plain .js so it is NOT transformed and runs exactly as-is.

// TextEncoder / TextDecoder
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// fetch / Request / Response / Headers
// Re-attach from globalThis (Node 18+ has these natively)
if (typeof global.Request === 'undefined') {
  if (typeof globalThis.Request !== 'undefined') {
    global.Request = globalThis.Request;
    global.Response = globalThis.Response;
    global.Headers = globalThis.Headers;
    global.fetch = globalThis.fetch;
  }
}

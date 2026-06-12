/**
 * Custom jest environment that extends jsdom with the fetch globals
 * required by msw/node (Request, Response, Headers, fetch, streams).
 * Node 18+ provides these natively; we copy them into the jsdom `global`
 * before any test code runs.
 */
const JSDOMEnvironment = require('jest-environment-jsdom');

class JSDOMExtendedEnvironment extends JSDOMEnvironment.default {
  async setup() {
    await super.setup();

    const nodeGlobal = global;

    // Inject Node's native fetch globals into the jsdom global object
    const fetchGlobals = [
      'fetch',
      'Request',
      'Response',
      'Headers',
      'FormData',
      'Blob',
      'File',
    ];
    for (const name of fetchGlobals) {
      if (typeof this.global[name] === 'undefined' && typeof nodeGlobal[name] !== 'undefined') {
        this.global[name] = nodeGlobal[name];
      }
    }

    // Web Streams API (needed by msw brotli-decompress)
    const streamGlobals = [
      'ReadableStream',
      'WritableStream',
      'TransformStream',
      'ReadableStreamDefaultReader',
      'ReadableStreamBYOBReader',
      'WritableStreamDefaultWriter',
      'ByteLengthQueuingStrategy',
      'CountQueuingStrategy',
    ];
    for (const name of streamGlobals) {
      if (typeof this.global[name] === 'undefined' && typeof nodeGlobal[name] !== 'undefined') {
        this.global[name] = nodeGlobal[name];
      }
    }

    // TextEncoder / TextDecoder
    if (typeof this.global.TextEncoder === 'undefined') {
      const { TextEncoder, TextDecoder } = require('util');
      this.global.TextEncoder = TextEncoder;
      this.global.TextDecoder = TextDecoder;
    }

    // structuredClone — available in Node 17+ but may be missing in some jsdom builds
    if (typeof this.global.structuredClone === 'undefined' && typeof nodeGlobal.structuredClone !== 'undefined') {
      this.global.structuredClone = nodeGlobal.structuredClone;
    }

    // queueMicrotask — needed by some async utilities
    if (typeof this.global.queueMicrotask === 'undefined' && typeof nodeGlobal.queueMicrotask !== 'undefined') {
      this.global.queueMicrotask = nodeGlobal.queueMicrotask;
    }

    // crypto — needed by some UUID/random utilities
    if (typeof this.global.crypto === 'undefined' && typeof nodeGlobal.crypto !== 'undefined') {
      this.global.crypto = nodeGlobal.crypto;
    }
  }
}

module.exports = JSDOMExtendedEnvironment;

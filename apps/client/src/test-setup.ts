import '@testing-library/jest-dom';

// structuredClone polyfill for jest-environment-jsdom which may be missing it
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

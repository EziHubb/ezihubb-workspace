/**
 * Custom Jest environment that extends jest-environment-jsdom with
 * Node 18+ fetch globals and stream globals required by MSW v2.
 *
 * @mswjs/interceptors references these at class-definition / module-load time.
 */
import JsdomEnvironment from 'jest-environment-jsdom';
import type { JestEnvironmentConfig, EnvironmentContext } from '@jest/environment';
import { TextDecoder, TextEncoder } from 'util';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

export default class CustomJsdomEnvironment extends JsdomEnvironment {
  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);

    const nodeGlobal = global as unknown as Record<string, unknown>;
    const sandbox = this.global as unknown as Record<string, unknown>;

    // ── Encoding globals ──────────────────────────────────────────────────
    if (!sandbox['TextEncoder']) sandbox['TextEncoder'] = TextEncoder;
    if (!sandbox['TextDecoder']) sandbox['TextDecoder'] = TextDecoder;

    // ── Stream globals ────────────────────────────────────────────────────
    if (!sandbox['ReadableStream']  && ReadableStream)  sandbox['ReadableStream']  = ReadableStream;
    if (!sandbox['WritableStream']  && WritableStream)  sandbox['WritableStream']  = WritableStream;
    if (!sandbox['TransformStream'] && TransformStream) sandbox['TransformStream'] = TransformStream;

    // ── Fetch globals ─────────────────────────────────────────────────────
    // Restore Node's native fetch globals into the jsdom sandbox so that
    // @mswjs/interceptors can extend `Request` at module-load time.
    if (!sandbox['Request']  && nodeGlobal['Request'])  sandbox['Request']  = nodeGlobal['Request'];
    if (!sandbox['Response'] && nodeGlobal['Response']) sandbox['Response'] = nodeGlobal['Response'];
    if (!sandbox['Headers']  && nodeGlobal['Headers'])  sandbox['Headers']  = nodeGlobal['Headers'];
    if (!sandbox['fetch']    && nodeGlobal['fetch'])    sandbox['fetch']    = nodeGlobal['fetch'];
    if (!sandbox['FormData'] && nodeGlobal['FormData']) sandbox['FormData'] = nodeGlobal['FormData'];
    if (!sandbox['Blob']     && nodeGlobal['Blob'])     sandbox['Blob']     = nodeGlobal['Blob'];
  }
}

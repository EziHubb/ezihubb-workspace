import { ArgumentMetadata, Injectable, Logger, PipeTransform, ValidationPipe } from '@nestjs/common';

const BASE = {
  whitelist: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
} as const;

/**
 * Validation that is strict about request bodies and forgiving about query
 * strings.
 *
 * WHY THE TWO SIDES DIFFER — this asymmetry is deliberate, do not "tidy" it
 * into one setting:
 *
 *   Query strings. `forbidNonWhitelisted` turns one unrecognised parameter
 *   into a 400 for the whole request, and callers routinely swallow that and
 *   fall back to an empty list. The result is a page section that silently
 *   renders nothing. That has now happened five separate times in this
 *   codebase — `featured` on /reviews, then `isPersonalizable`,
 *   `collectionSlug`, `fields` and an over-large `limit` on /products — each
 *   found by accident, each after living in production for weeks. Dropping
 *   the unknown parameter and logging it turns a silent outage into a
 *   wrong-but-visible result with a trail to follow.
 *
 *   Bodies. The opposite. A body field quietly dropped is data the caller
 *   believes it saved and did not — a mistyped field name on a PATCH would
 *   write a partial record with nothing to show for it. A 400 there is the
 *   safe answer, so bodies stay strict everywhere.
 *
 * Keyed on `metadata.type`, not the HTTP verb. That is both simpler and more
 * accurate: a POST can carry query parameters too, and a GET never has a
 * body, so the parameter's location is the thing that actually matters. It
 * also settles DELETE without a special case — its query is lenient, its body
 * is strict, like everything else.
 *
 * Query leniency applies in production only. Locally and in CI the strict
 * pipe runs for everything, so a bad parameter fails loudly while it is still
 * cheap to fix.
 */
@Injectable()
export class ScopedValidationPipe implements PipeTransform {
  private readonly logger = new Logger('QueryValidation');
  private readonly strict = new ValidationPipe({ ...BASE, forbidNonWhitelisted: true });
  private readonly lenient = new ValidationPipe(BASE);
  private readonly lenientQuery = process.env['NODE_ENV'] === 'production';

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    if (metadata.type !== 'query' || !this.lenientQuery) {
      return this.strict.transform(value, metadata);
    }

    const before = value && typeof value === 'object' ? Object.keys(value) : [];
    const result = await this.lenient.transform(value, metadata);
    const after = result && typeof result === 'object' ? Object.keys(result as object) : [];

    const dropped = before.filter((k) => !after.includes(k));
    if (dropped.length) {
      // warn, not error: the request succeeded, and burying the error level in
      // noise is how error stops meaning anything. AxiomLoggerService ships
      // warn as well as error, so this reaches the log store rather than
      // sitting in container stdout — see docs/validation-pipe.md for the
      // alert to build on it.
      //
      // `kept` matters as much as `dropped`: a collection page that quietly
      // loses its collectionSlug renders every product on the platform and
      // looks completely normal. Knowing which filters survived tells you what
      // the caller actually got back.
      const kept = after.map((k) => `${k}=${String((result as Record<string, unknown>)[k])}`);
      this.logger.warn(
        `[unknown-query-param] ${metadata.metatype?.name ?? 'query'} — ` +
          `dropped: ${dropped.join(', ')} — kept: ${kept.join(', ') || '(none)'}`,
      );
    }

    return result;
  }
}

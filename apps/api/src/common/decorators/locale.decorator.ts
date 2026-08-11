import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { extractLocale, type SupportedLocale } from '../utils/locale.util';

/** Resolves the caller's locale (see `extractLocale`) as a controller-method param. */
export const Locale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupportedLocale => {
    const request = ctx.switchToHttp().getRequest();
    return extractLocale(request);
  },
);

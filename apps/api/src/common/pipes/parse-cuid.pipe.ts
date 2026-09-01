import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { PRODUCT_NANOID_REGEX } from '../utils/product-id';

// CUID v1: c[a-z0-9]{24}  (25 chars, starts with 'c')
// CUID v2: [a-z0-9]{24}   (24 chars, alphanumeric only)
// NanoID: [A-Za-z0-9]{12}; legacy Product NanoIDs used 10 characters.
// ParseCuidPipe predates the ID migration and is shared by multiple routes,
// so it remains the compatibility boundary for old CUID/NanoID links.
const CUID_V1_REGEX = /^c[a-z0-9]{24}$/;
const CUID_V2_REGEX = /^[a-z0-9]{24,32}$/;

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: `Invalid id: expected a supported identifier string, got ${typeof value}.`,
      });
    }

    if (
      !CUID_V1_REGEX.test(value)
      && !CUID_V2_REGEX.test(value)
      && !PRODUCT_NANOID_REGEX.test(value)
    ) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: `Invalid id format: "${value}" is not a supported identifier.`,
      });
    }

    return value;
  }
}

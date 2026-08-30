import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { PRODUCT_NANOID_REGEX } from '../utils/product-id';

// CUID v1: c[a-z0-9]{24}  (25 chars, starts with 'c')
// CUID v2: [a-z0-9]{24}   (24 chars, alphanumeric only)
// Product NanoID: [A-Za-z0-9]{10}. ParseCuidPipe predates the product ID
// migration and is shared by many product sub-routes, so it remains the
// compatibility boundary: legacy CUID URLs and new NanoID URLs both work.
const CUID_V1_REGEX = /^c[a-z0-9]{24}$/;
const CUID_V2_REGEX = /^[a-z0-9]{24,32}$/;

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: `Invalid id: expected a CUID string, got ${typeof value}.`,
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

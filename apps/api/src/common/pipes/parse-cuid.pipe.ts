import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// CUID v1: c[a-z0-9]{24}  (25 chars, starts with 'c')
// CUID v2: [a-z0-9]{24}   (24 chars, alphanumeric only)
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

    if (!CUID_V1_REGEX.test(value) && !CUID_V2_REGEX.test(value)) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: `Invalid id format: "${value}" is not a valid CUID.`,
      });
    }

    return value;
  }
}

import { BadRequestException } from '@nestjs/common';
import { ParseCuidPipe } from '../pipes/parse-cuid.pipe';
import {
  generateProductId,
  PRODUCT_ID_LENGTH,
  PRODUCT_NANOID_REGEX,
} from './product-id';

describe('product NanoID', () => {
  it('generates compact 10-character alphanumeric IDs', () => {
    const ids = Array.from({ length: 1_000 }, () => generateProductId());

    expect(ids.every((id) => id.length === PRODUCT_ID_LENGTH)).toBe(true);
    expect(ids.every((id) => PRODUCT_NANOID_REGEX.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is accepted by the shared route ID parser', () => {
    const pipe = new ParseCuidPipe();
    expect(pipe.transform('V8k2LmQ9Xa')).toBe('V8k2LmQ9Xa');
  });

  it('keeps legacy product CUID links valid', () => {
    const pipe = new ParseCuidPipe();
    expect(pipe.transform('cmtfqol5j000901pg5lnv6ach')).toBe('cmtfqol5j000901pg5lnv6ach');
  });

  it('rejects malformed identifiers', () => {
    const pipe = new ParseCuidPipe();
    expect(() => pipe.transform('draft-product')).toThrow(BadRequestException);
  });
});

import { customAlphabet } from 'nanoid';

export const PRODUCT_ID_LENGTH = 10;
export const PRODUCT_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const PRODUCT_NANOID_REGEX = /^[0-9A-Za-z]{10}$/;

const createNanoId = customAlphabet(PRODUCT_ID_ALPHABET, PRODUCT_ID_LENGTH);

/**
 * Generates the public, opaque identifier used by newly-created products.
 *
 * The alphabet deliberately excludes `-` and `_` so product IDs always keep
 * the compact `V8k2LmQ9Xa` shape used in URLs, logs and partner payloads.
 * PostgreSQL's Product primary-key constraint remains the final collision
 * guard, just as it was for Prisma-generated CUIDs.
 */
export function generateProductId(): string {
  return createNanoId();
}

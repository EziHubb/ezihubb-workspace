import { customAlphabet } from 'nanoid';

export const PRODUCT_ID_LENGTH = 12;
export const PRODUCT_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// Accept the previous 10-character Product IDs as well as the new global
// 12-character IDs so existing routes and records remain valid.
export const PRODUCT_NANOID_REGEX = /^(?:[0-9A-Za-z]{10}|[0-9A-Za-z]{12})$/;

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

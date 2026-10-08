import { PrintifyAddressTo } from '../fulfillment/printify/printify.types';
import { externalEffectHash } from './economic-external-effect';

export type FrozenPodPayload = { version: 'pod-v1'; address: PrintifyAddressTo;
  items: Array<{ lineId: string; productId: string; variantId: string | null; externalProductId: string; externalVariantId: number; quantity: number }> };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid POD resource');
  return value as Record<string, unknown>;
}
/** Compare original line-specific external IDs, products, quantities and all
 * supplied address fields from an independent authenticated shop GET. Status
 * or an unverified webhook/resource ID alone cannot confirm external creation.
 * Source: https://developers.printify.com/openapi.json (2026-10-08). */
export function verifyPrintifyPod(raw: unknown, id: string, reference: string, frozen: FrozenPodPayload) {
  const resource = object(raw), address = object(resource['address_to']);
  if (resource['id'] !== reference || !Array.isArray(resource['line_items']) || resource['line_items'].length !== frozen.items.length) {
    throw new Error('POD original resource mismatch');
  }
  for (const [key, value] of Object.entries(frozen.address)) {
    if ((address[key] ?? '') !== value) throw new Error('POD original address mismatch');
  }
  const lines = resource['line_items'].map(object), seen = new Set<string>();
  for (const item of frozen.items) {
    const externalId = `${id}-${item.lineId}`;
    const matching = lines.filter(line => object(line['metadata'])['external_id'] === externalId);
    if (seen.has(externalId) || matching.length !== 1 || matching[0]['product_id'] !== item.externalProductId
      || matching[0]['variant_id'] !== item.externalVariantId || matching[0]['quantity'] !== item.quantity) {
      throw new Error('POD original line/reference mismatch');
    }
    seen.add(externalId);
  }
  // Do not hash mutable status, price, tracking or progress into create proof.
  return externalEffectHash({ id, reference, address: frozen.address, items: frozen.items });
}

import { Inject, Injectable } from '@nestjs/common';
import { FulfillmentProviderType } from '@prisma/client';
import { FULFILLMENT_PROVIDERS, FulfillmentProvider } from './interfaces/fulfillment-provider.interface';

/**
 * Resolves a FulfillmentProvider implementation by type. Adding a new
 * provider (e.g. Printful) is: implement FulfillmentProvider, add it to the
 * `useFactory` array in fulfillment.module.ts, add the enum value in
 * prisma/schema.prisma — nothing here changes.
 */
@Injectable()
export class FulfillmentRegistryService {
  constructor(@Inject(FULFILLMENT_PROVIDERS) private readonly providers: FulfillmentProvider[]) {}

  resolve(type: FulfillmentProviderType): FulfillmentProvider {
    const provider = this.providers.find((p) => p.type === type);
    if (!provider) {
      throw new Error(`No fulfillment provider registered for type "${type}"`);
    }
    return provider;
  }
}

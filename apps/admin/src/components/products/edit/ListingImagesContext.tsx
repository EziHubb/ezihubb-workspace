'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { ProductEditFormValues, ProductImage } from './types';
import { fromPendingImageRef, toPendingImageRef } from './helpers';

/**
 * Every photo this listing currently has, including ones uploaded a moment ago.
 *
 * `product.images` is a server snapshot handed down from a Server Component, so
 * it never changes for the life of the page. Photos attached during the session
 * used to live in PhotoVideoTab's own `useState`, which meant no other tab could
 * see them: the variation photo picker read `product.images`, found it empty on
 * a brand-new listing, and told the seller to "upload photos in the Photo &
 * Video tab first" — right after they had done exactly that.
 *
 * Which photos belong to the listing, and in what order, is already answered by
 * the `imageIds` form field, shared by every tab. The only thing missing was a
 * way to resolve those ids to urls, which is all this holds.
 */
interface ListingImagesValue {
  /** id → image, covering both the server snapshot and this session's uploads. */
  byId: Record<string, ProductImage>;
  /** Records freshly attached images so their ids resolve immediately. */
  registerImages: (images: ProductImage[]) => void;
}

const ListingImagesContext = createContext<ListingImagesValue>({
  byId: {},
  registerImages: () => {
    // No provider: nothing to record against. Callers still render fine from
    // whatever `product.images` they were given.
  },
});

export function ListingImagesProvider({
  initialImages,
  children,
}: {
  initialImages: ProductImage[];
  children: React.ReactNode;
}) {
  const [sessionImages, setSessionImages] = useState<ProductImage[]>([]);

  // Callers naturally write `product?.images ?? []`, which is a fresh array on
  // every render. Pinning it here keeps that from rebuilding the map and
  // re-rendering every consumer on each parent render — the provider only ever
  // needs the server snapshot as it was on mount, since everything after that
  // arrives through registerImages.
  const seedRef = useRef(initialImages);

  const registerImages = useCallback((images: ProductImage[]) => {
    setSessionImages((prev) => {
      const seen = new Set(prev.map((i) => i.id));
      const added = images.filter((i) => !seen.has(i.id));
      return added.length ? [...prev, ...added] : prev;
    });
  }, []);

  // Session entries last, so a re-uploaded id resolves to the newer record.
  const byId = useMemo(
    () => Object.fromEntries([...seedRef.current, ...sessionImages].map((img) => [img.id, img])),
    [sessionImages],
  );

  const value = useMemo<ListingImagesValue>(
    () => ({ byId, registerImages }),
    [byId, registerImages],
  );

  return <ListingImagesContext.Provider value={value}>{children}</ListingImagesContext.Provider>;
}

export function useListingImagesMap() {
  return useContext(ListingImagesContext);
}

/**
 * The listing's photos in the seller's own order, resolved from `imageIds`.
 *
 * Driving this off `imageIds` rather than off the map means removing a photo or
 * reordering in the Photo & Video tab is reflected everywhere for free — the
 * map only ever answers "what is this id", never "what belongs here".
 */
export function useListingImages(): ProductImage[] {
  const { byId } = useListingImagesMap();
  const { watch } = useFormContext<ProductEditFormValues>();
  const ids = watch('imageIds') ?? [];
  const pendingUrls = watch('pendingImageUrls') ?? [];
  const explicitOrder = watch('imageOrder') ?? [];
  const order = explicitOrder.length
    ? explicitOrder
    : [...ids, ...pendingUrls.map(toPendingImageRef)];

  return useMemo(
    () => order.map((ref, index) => {
      const pendingUrl = fromPendingImageRef(ref);
      if (pendingUrl) {
        return {
          id: ref,
          url: pendingUrl,
          isPrimary: index === 0,
          sortOrder: index,
          type: 'MOCKUP' as const,
          printSide: null,
        } satisfies ProductImage;
      }
      return byId[ref];
    }).filter((img): img is ProductImage => Boolean(img)),
    // Form arrays are fresh on every render; their contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order.join('|'), byId],
  );
}

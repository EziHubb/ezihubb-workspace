'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Carries "the shopper picked an option that has a photo" from the buy panel
 * across to the gallery.
 *
 * The two are siblings under a Server Component, so there is no shared
 * `useState` to lift into: the product page cannot hold client state, and
 * neither component can own it without the other reaching sideways into it.
 * A provider wrapping both is the smallest thing that actually connects them.
 *
 * Deliberately an image id and not an index. The gallery decides where that
 * photo sits in its own media list, which also mixes in videos — an index
 * computed out here would be wrong the moment the listing has one.
 *
 * Usable without the provider: both consumers fall back to a no-op, so the
 * gallery still works anywhere it is rendered on its own.
 */
interface VariationPhotoValue {
  /** ProductImage.id the gallery should bring forward, or null for none. */
  focusedImageId: string | null;
  /**
   * Bumped on every call, even when the id is unchanged.
   *
   * The id alone is not enough to react to. Pick "Black", browse to another
   * photo by hand, pick "Blue" (no linked photo, so nothing moves), then pick
   * "Black" again: the id is still the same one, React sees no state change,
   * and the gallery never comes back to that photo. What the gallery has to
   * respond to is "a choice was just made", which is what this counts.
   */
  focusSeq: number;
  focusImage: (imageId: string | null) => void;
}

const NOOP: VariationPhotoValue = {
  focusedImageId: null,
  focusSeq: 0,
  focusImage: () => {
    // No provider above: the gallery is being rendered on its own, so there is
    // no selection to follow. Dropping the call is the correct behaviour, not
    // a missing implementation.
  },
};

const VariationPhotoContext = createContext<VariationPhotoValue>(NOOP);

export function useVariationPhoto() {
  return useContext(VariationPhotoContext);
}

export function VariationPhotoProvider({ children }: { children: React.ReactNode }) {
  // Id and counter in one state object so they can never disagree about which
  // choice is the current one.
  const [focus, setFocus] = useState<{ id: string | null; seq: number }>({ id: null, seq: 0 });

  const focusImage = useCallback((imageId: string | null) => {
    setFocus((prev) => ({ id: imageId, seq: prev.seq + 1 }));
  }, []);

  const value = useMemo<VariationPhotoValue>(
    () => ({ focusedImageId: focus.id, focusSeq: focus.seq, focusImage }),
    [focus, focusImage],
  );

  return (
    <VariationPhotoContext.Provider value={value}>
      {children}
    </VariationPhotoContext.Provider>
  );
}

'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import type { CustomizationTemplate } from '../../lib/customizer/types';
import { ALLOWED_FONTS } from '../../lib/customizer/types';

interface CustomizerContextValue {
  locale: string;
}

const CustomizerContext = createContext<CustomizerContextValue>({ locale: 'en' });

export function useCustomizerContext() {
  return useContext(CustomizerContext);
}

export interface CustomizerProviderProps {
  template:   CustomizationTemplate;
  productId:  string;
  variantId?: string;
  locale:     string;
  children:   React.ReactNode;
}

export function CustomizerProvider({
  template,
  productId,
  variantId,
  locale,
  children,
}: CustomizerProviderProps) {
  const initTemplate = useCustomizerStore((s) => s.initTemplate);

  // Initialise store when template/product changes
  useEffect(() => {
    initTemplate(template, productId, variantId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, productId, variantId]);

  // Load custom fonts via FontFace API
  useEffect(() => {
    if (typeof window === 'undefined' || !('FontFace' in window)) return;
    ALLOWED_FONTS.forEach(({ id, url }) => {
      if (document.fonts.check(`12px ${id}`)) return;
      const ff = new FontFace(id, `url(${url})`);
      ff.load()
        .then((loaded) => document.fonts.add(loaded))
        .catch(() => { /* font optional */ });
    });
  }, []);

  return (
    <CustomizerContext.Provider value={{ locale }}>
      {children}
    </CustomizerContext.Provider>
  );
}

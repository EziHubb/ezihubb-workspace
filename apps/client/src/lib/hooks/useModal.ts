'use client';

import { useState } from 'react';

export function useModal<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [data,   setData]   = useState<T | null>(null);

  const open  = (d?: T) => { setData(d ?? null); setIsOpen(true);  };
  const close = ()      => { setIsOpen(false);   setData(null);    };

  return { isOpen, data, open, close };
}

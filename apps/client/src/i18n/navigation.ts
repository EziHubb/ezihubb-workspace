import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware navigation primitives shared by every storefront route. */
export const { Link, getPathname, redirect, usePathname, useRouter } =
  createNavigation(routing);

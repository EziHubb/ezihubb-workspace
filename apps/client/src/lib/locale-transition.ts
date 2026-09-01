'use client';

import { useEffect, useRef } from 'react';
import { routing } from '../i18n/routing';

type Restorer = (value: unknown) => void;

interface ControlState {
  tag: 'INPUT' | 'TEXTAREA' | 'SELECT';
  type: string;
  value: string;
  checked?: boolean;
  selected?: string[];
}

interface LocaleSnapshot {
  path: string;
  controls: ControlState[];
  details: boolean[];
  expanded: boolean[];
  selectedTab: number;
  scrollX: number;
  scrollY: number;
  custom: Record<string, unknown>;
}

const captures = new Map<string, () => unknown>();
const restorers = new Map<string, Restorer>();
let pending: LocaleSnapshot | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

const localePrefix = new RegExp(`^/(?:${routing.locales.join('|')})(?=/|$)`);
const neutralPath = (pathname: string) => pathname.replace(localePrefix, '') || '/';

const controls = () => [
  ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input:not([type="file"]), textarea, select',
  ),
];

function readControl(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): ControlState {
  if (element instanceof HTMLSelectElement) {
    return {
      tag: 'SELECT',
      type: element.type,
      value: element.value,
      selected: [...element.selectedOptions].map((option) => option.value),
    };
  }
  return {
    tag: element.tagName as 'INPUT' | 'TEXTAREA',
    type: element.type,
    value: element.value,
    ...(element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
      ? { checked: element.checked }
      : {}),
  };
}

function writeControl(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  state: ControlState,
) {
  if (element.tagName !== state.tag || element.type !== state.type) return;

  if (element instanceof HTMLSelectElement) {
    const selected = new Set(state.selected ?? [state.value]);
    for (const option of element.options) option.selected = selected.has(option.value);
  } else if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
    setter?.call(element, Boolean(state.checked));
  } else {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(element, state.value);
  }

  // React Hook Form and controlled inputs both listen to these native events.
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Capture transient UI immediately before a locale route changes.
 *
 * Deliberately kept in module memory, not web storage: passwords, addresses
 * and unfinished messages must not be written to disk just to survive an RSC
 * remount. The snapshot exists only for the current client transition.
 */
export function captureLocaleTransitionState() {
  if (clearTimer) clearTimeout(clearTimer);

  const expandable = [...document.querySelectorAll<HTMLElement>('[aria-expanded]')]
    .filter((element) => !element.closest('[data-locale-switcher]'));
  const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];

  pending = {
    path: neutralPath(window.location.pathname),
    controls: controls().map(readControl),
    details: [...document.querySelectorAll<HTMLDetailsElement>('details')].map((detail) => detail.open),
    expanded: expandable.map((element) => element.getAttribute('aria-expanded') === 'true'),
    selectedTab: tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('aria-current') === 'page'),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    custom: Object.fromEntries([...captures].map(([key, capture]) => [key, capture()])),
  };
}

function restoreCustomState() {
  if (!pending || pending.path !== neutralPath(window.location.pathname)) return;
  for (const [key, value] of Object.entries(pending.custom)) {
    const restore = restorers.get(key);
    if (restore) {
      restore(value);
      delete pending.custom[key];
    }
  }
}

/** Called once by the locale layout after the translated tree mounts. */
export function restoreLocaleTransitionState() {
  if (!pending || pending.path !== neutralPath(window.location.pathname)) {
    pending = null;
    return;
  }

  restoreCustomState();
  const snapshot = pending;

  // Two frames allow the replacement RSC payload and controlled forms to
  // mount before native values/events are replayed.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const nextControls = controls();
    snapshot.controls.forEach((state, index) => {
      const element = nextControls[index];
      if (element) writeControl(element, state);
    });

    [...document.querySelectorAll<HTMLDetailsElement>('details')].forEach((detail, index) => {
      detail.open = snapshot.details[index] ?? detail.open;
    });

    const expandable = [...document.querySelectorAll<HTMLElement>('[aria-expanded]')]
      .filter((element) => !element.closest('[data-locale-switcher]'));
    snapshot.expanded.forEach((wasExpanded, index) => {
      const element = expandable[index];
      if (wasExpanded && element?.getAttribute('aria-expanded') !== 'true') element.click();
    });

    const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
    const selected = snapshot.selectedTab >= 0 ? tabs[snapshot.selectedTab] : null;
    if (selected && selected.getAttribute('aria-selected') !== 'true') selected.click();

    window.scrollTo(snapshot.scrollX, snapshot.scrollY);
  }));

  // Complex screens can register during their mount effects. Keep only that
  // small custom payload briefly; DOM state is already captured in `snapshot`.
  clearTimer = setTimeout(() => {
    pending = null;
    clearTimer = null;
  }, 5_000);
}

/**
 * Adapter for state that has no restorable DOM representation (wizard steps,
 * calculated delivery estimates, canvas editors, etc.). Standard forms,
 * filters, tabs, accordions and scroll positions need no adapter.
 */
export function useLocaleTransitionState<T>(
  key: string,
  value: T,
  restore: (value: T) => void,
) {
  const valueRef = useRef(value);
  const restoreRef = useRef(restore);
  valueRef.current = value;
  restoreRef.current = restore;

  useEffect(() => {
    captures.set(key, () => valueRef.current);
    restorers.set(key, (saved) => restoreRef.current(saved as T));
    restoreCustomState();
    return () => {
      captures.delete(key);
      restorers.delete(key);
    };
  }, [key]);
}

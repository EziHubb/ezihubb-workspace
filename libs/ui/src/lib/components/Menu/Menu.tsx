'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface MenuItemDef {
  label:        string;
  onClick:      () => void;
  icon?:        React.ReactNode;
  destructive?: boolean;
  /** Amber warning tone — for actions that are reversible but still worth flagging (e.g. Archive), distinct from `destructive` (irreversible, red). */
  warning?:     boolean;
  disabled?:    boolean;
}

export interface MenuSection {
  items: MenuItemDef[];
}

export type MenuAlign = 'start' | 'end';
export type MenuPlacement = 'bottom' | 'top';

export interface MenuProps {
  trigger:     React.ReactNode;
  /** Flat list, or grouped into sections separated by a divider. */
  items?:      MenuItemDef[];
  sections?:   MenuSection[];
  align?:      MenuAlign;
  /** Which side of the trigger the panel opens on. Default "bottom" — use "top" for triggers near the bottom of the viewport (e.g. a card grid's last row). */
  placement?:  MenuPlacement;
  className?:  string;
  panelWidth?: string;
}

const alignClasses: Record<MenuAlign, string> = {
  start: 'left-0',
  end:   'right-0',
};

const placementClasses: Record<MenuPlacement, string> = {
  bottom: 'top-full mt-1.5',
  top:    'bottom-full mb-1.5',
};

/**
 * Action/kebab menu — Etsy's bulk "Editing options" toolbar menu and
 * per-row "..." action menus are plain text lists with generous vertical
 * padding per item, no icons, subtle shadow, no borders between items.
 */
export function Menu({ trigger, items, sections, align = 'start', placement = 'bottom', className = '', panelWidth = '13rem' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = sections ?? (items ? [{ items }] : []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex">
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          style={{ width: panelWidth }}
          className={[
            'absolute z-30 bg-surface border border-border rounded-card shadow-floating py-1.5 animate-fade-in max-h-80 overflow-y-auto',
            placementClasses[placement],
            alignClasses[align],
            className,
          ].join(' ')}
        >
          {groups.map((section, si) => (
            <div key={si} className={si > 0 ? 'border-t border-border my-1.5 pt-1.5' : undefined}>
              {section.items.map((item, ii) => (
                <button
                  key={ii}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  className={[
                    'flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    item.destructive
                      ? 'text-error hover:bg-error/5'
                      : item.warning
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-secondary hover:bg-background',
                  ].join(' ')}
                >
                  {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

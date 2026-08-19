'use client';

import React, { useId, useState } from 'react';

export type TooltipPlacement = 'bottom' | 'top' | 'left' | 'right';

export interface TooltipProps {
  /** Short label. Plain text — a tooltip is not a place for interactive content. */
  label:      string;
  /** The element the tooltip describes. Must be focusable for keyboard users. */
  children:   React.ReactElement;
  placement?: TooltipPlacement;
  className?: string;
  /**
   * Suppress the tooltip without unwrapping the trigger. For a control that
   * also opens something on click — a menu, a drawer — so the label does not
   * sit on top of what just opened while focus is still on the trigger.
   */
  disabled?:  boolean;
}

const placementClasses: Record<TooltipPlacement, string> = {
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
};

/** Small arrow, drawn with borders so it inherits no image asset. */
const arrowClasses: Record<TooltipPlacement, string> = {
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-b-4 border-b-secondary',
  top:    'top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-secondary',
  left:   'left-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-secondary',
  right:  'right-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-secondary',
};

/**
 * Hover/focus label for an icon-only control.
 *
 * Distinct from `Popover`, which opens on click and can hold interactive
 * content. A tooltip only ever names the control it is attached to, so it
 * opens on hover *and* on keyboard focus — hover-only would hide the label
 * from anyone navigating by keyboard, which for an icon-only button is the
 * whole point of it.
 *
 * The tooltip is wired with `aria-describedby`, not `aria-label`: the trigger
 * keeps whatever accessible name it already had, and this adds a description
 * rather than replacing it. Screen readers therefore do not depend on the
 * tooltip being visible.
 *
 * Escape dismisses it while focus stays on the trigger, so a keyboard user can
 * get the label out of the way without tabbing away.
 */
export function Tooltip({ label, children, placement = 'bottom', className = '', disabled = false }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const visible = open && !disabled;

  const trigger = React.cloneElement(
    children,
    {
      'aria-describedby': visible ? id : undefined,
      onMouseEnter: () => setOpen(true),
      onMouseLeave: () => setOpen(false),
      // focus/blur rather than focusin/focusout: these fire for keyboard
      // tabbing, and :focus-visible styling on the trigger stays untouched.
      onFocus:      () => setOpen(true),
      onBlur:       () => setOpen(false),
      onKeyDown:    (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
        (children.props as { onKeyDown?: (e: React.KeyboardEvent) => void }).onKeyDown?.(e);
      },
    } as Partial<React.HTMLAttributes<HTMLElement>>,
  );

  return (
    <span className="relative inline-flex">
      {trigger}
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={[
            'absolute z-40 whitespace-nowrap rounded-md bg-secondary px-2.5 py-1.5',
            'text-xs font-medium text-surface shadow-floating pointer-events-none animate-fade-in',
            placementClasses[placement],
            className,
          ].join(' ')}
        >
          {label}
          <span aria-hidden="true" className={`absolute h-0 w-0 ${arrowClasses[placement]}`} />
        </span>
      )}
    </span>
  );
}

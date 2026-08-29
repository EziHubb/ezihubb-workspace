'use client';

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value:     string;
  label:     string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'defaultValue' | 'onChange' | 'size' | 'value'
> {
  options:       readonly SelectOption[];
  value?:        string | number;
  defaultValue?: string | number;
  placeholder?:  string;
  onChange?:     React.ChangeEventHandler<HTMLSelectElement>;
  error?:        boolean;
  size?:         'sm' | 'md';
  required?:     boolean;
  startIcon?:    React.ReactNode;
}

interface MenuPosition {
  left:       number;
  top?:       number;
  bottom?:    number;
  width:      number;
  maxHeight:  number;
  origin:     'top' | 'bottom';
}

/**
 * Shared single-value select for the Admin UI.
 *
 * The menu is a custom listbox rather than the browser/OS native picker, so
 * every screen gets the same option styling. It is portalled to the document
 * body to avoid being clipped by drawers and scrolling modal bodies.
 */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      placeholder,
      onChange,
      error,
      size = 'md',
      className = '',
      disabled,
      required,
      startIcon,
      name,
      id,
      onBlur,
      ...buttonProps
    },
    forwardedRef,
  ) => {
    const fallback = defaultValue ?? options.find((option) => !option.disabled)?.value ?? '';
    const [internalValue, setInternalValue] = useState(String(fallback));
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [position, setPosition] = useState<MenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement);

    const currentValue = value === undefined ? internalValue : String(value);
    const selected = useMemo(
      () => options.find((option) => option.value === currentValue),
      [currentValue, options],
    );
    const selectedIndex = options.findIndex((option) => option.value === currentValue);

    const updatePosition = useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const gutter = 8;
      const viewportPadding = 12;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const available = Math.max(96, openUp ? spaceAbove : spaceBelow);
      const width = Math.max(rect.width, 180);
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
      );

      setPosition({
        left,
        width,
        maxHeight: Math.min(256, available - gutter),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + gutter, origin: 'bottom' as const }
          : { top: rect.bottom + gutter, origin: 'top' as const }),
      });
    }, []);

    useEffect(() => {
      if (!open) return;
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }, [open, updatePosition]);

    const nextEnabled = (start: number, direction: 1 | -1) => {
      if (!options.length) return -1;
      for (let offset = 1; offset <= options.length; offset++) {
        const index = (start + direction * offset + options.length) % options.length;
        if (!options[index].disabled) return index;
      }
      return -1;
    };

    const showMenu = () => {
      if (disabled) return;
      setActiveIndex(selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : nextEnabled(-1, 1));
      setOpen(true);
    };

    const emitChange = (nextValue: string) => {
      if (value === undefined) setInternalValue(nextValue);
      const target = {
        name: name ?? '',
        type: 'select-one',
        value: nextValue,
      } as HTMLSelectElement;
      onChange?.({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
      triggerRef.current?.focus();
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      buttonProps.onKeyDown?.(event);
      if (event.defaultPrevented) return;

      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!open) showMenu();
        else if (activeIndex >= 0 && !options[activeIndex]?.disabled) {
          emitChange(options[activeIndex].value);
        }
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) {
          showMenu();
          return;
        }
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((index) => nextEnabled(index, direction));
        return;
      }
      if (open && (event.key === 'Home' || event.key === 'End')) {
        event.preventDefault();
        setActiveIndex(event.key === 'Home'
          ? nextEnabled(-1, 1)
          : nextEnabled(0, -1));
      }
    };

    const sizeClasses = size === 'sm'
      ? 'h-9 px-3 text-sm'
      : 'h-11 px-3.5 text-sm';

    const menu = open && position && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close options"
              className="fixed inset-0 z-[9998] cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              id={id ? `${id}-listbox` : undefined}
              role="listbox"
              aria-label={buttonProps['aria-label']}
              className={`fixed z-[9999] overflow-y-auto rounded-card border border-border/60 bg-surface p-1.5 shadow-floating animate-fade-in ${
                position.origin === 'bottom' ? 'origin-bottom' : 'origin-top'
              }`}
              style={{
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
            >
              {options.map((option, index) => {
                const active = index === activeIndex;
                const checked = option.value === currentValue;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    disabled={option.disabled}
                    onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
                    onClick={() => emitChange(option.value)}
                    className={[
                      'flex w-full items-center justify-between gap-3 rounded-button px-3 py-2 text-left text-sm transition-colors',
                      checked ? 'bg-primary/8 font-semibold text-primary' : 'text-secondary',
                      active && !checked ? 'bg-muted/8' : '',
                      option.disabled ? 'cursor-not-allowed opacity-45' : '',
                    ].join(' ')}
                  >
                    <span className="truncate">{option.label}</span>
                    {checked && (
                      <svg aria-hidden className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m5 12 4 4L19 6" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )
      : null;

    return (
      <div className={`relative inline-block w-full ${className}`}>
        {name && <input type="hidden" name={name} value={currentValue} required={required} />}
        <button
          {...buttonProps}
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-required={required || undefined}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onClick={() => open ? setOpen(false) : showMenu()}
          className={[
            'flex w-full items-center justify-between gap-2 rounded-input border bg-surface text-secondary',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-error' : 'border-border hover:border-secondary/30',
            sizeClasses,
          ].join(' ')}
        >
          <span className="flex min-w-0 items-center gap-2">
            {startIcon && <span className="shrink-0 text-muted">{startIcon}</span>}
            <span className={`truncate ${!selected ? 'text-muted' : ''}`}>
              {selected?.label ?? placeholder ?? currentValue}
            </span>
          </span>
          <svg
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {menu}
      </div>
    );
  },
);

Select.displayName = 'Select';

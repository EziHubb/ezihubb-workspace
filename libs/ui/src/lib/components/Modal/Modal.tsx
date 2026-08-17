'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type ModalSize = 'sm' | 'md' | 'lg' | 'fullscreen';

export interface ModalProps {
  isOpen:               boolean;
  onClose:              () => void;
  size?:                ModalSize;
  closeOnOverlayClick?: boolean;
  className?:           string;
  children:             React.ReactNode;
}

export interface ModalHeaderProps {
  children:  React.ReactNode;
  onClose?:  () => void;
  className?: string;
  /** aria-label for the close button. Default: "Close" */
  closeLabel?: string;
}

export interface ModalBodyProps {
  children:   React.ReactNode;
  className?: string;
}

export interface ModalFooterProps {
  children:   React.ReactNode;
  className?: string;
}

const panelSizeClasses: Record<Exclude<ModalSize, 'fullscreen'>, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-2xl',
};

export const ModalHeader: React.FC<ModalHeaderProps> = ({ children, onClose, className = '', closeLabel = 'Close' }) => (
  <div className={`flex items-center justify-between px-6 py-4 border-b border-border shrink-0 ${className}`}>
    <div className="text-base font-semibold text-secondary">{children}</div>
    {onClose && (
      <button
        onClick={onClose}
        aria-label={closeLabel}
        className="ml-4 p-1 rounded-sm text-muted hover:text-secondary hover:bg-background transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

export type ModalHeroBand = 'peach' | 'periwinkle' | 'purple';

export interface ModalHeroHeaderProps {
  /** icon or small illustration, rendered at 40-48px */
  icon:        React.ReactNode;
  title:       React.ReactNode;
  subtitle?:   React.ReactNode;
  band?:       ModalHeroBand;
  className?:  string;
  onClose?:    () => void;
  /** aria-label for the close button. Default: "Close" */
  closeLabel?: string;
}

const heroBandClasses: Record<ModalHeroBand, string> = {
  peach:      'bg-hero-peach',
  periwinkle: 'bg-hero-periwinkle',
  purple:     'bg-hero-purple',
};

/**
 * Colored-band modal header used for Etsy's "wizard"/celebration-style
 * dialogs (Set up a sale, Create a promo code, Set up targeted offers,
 * Success confirmations) — distinct from the plain `ModalHeader` used for
 * simple utility dialogs (bulk-edit, quick settings), which stays flat
 * white with a sans-serif title.
 */
export const ModalHeroHeader: React.FC<ModalHeroHeaderProps> = ({
  icon, title, subtitle, band = 'periwinkle', className = '', onClose, closeLabel = 'Close',
}) => (
  <div className={`flex items-start gap-4 px-6 py-6 rounded-t-xl md:rounded-t-modal shrink-0 ${heroBandClasses[band]} ${className}`}>
    <div className="w-10 h-10 shrink-0 flex items-center justify-center text-secondary">{icon}</div>
    <div className="min-w-0 flex-1">
      <h2 className="font-display text-2xl font-bold text-secondary leading-snug">{title}</h2>
      {subtitle && <p className="text-sm text-secondary/80 mt-1.5 leading-relaxed">{subtitle}</p>}
    </div>
    {onClose && (
      <button
        onClick={onClose}
        aria-label={closeLabel}
        className="shrink-0 p-1 rounded-sm text-secondary/70 hover:text-secondary hover:bg-black/5 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '' }) => (
  <div className={`flex-1 overflow-y-auto px-6 py-4 ${className}`}>{children}</div>
);

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => (
  <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0 ${className}`}>
    {children}
  </div>
);

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  closeOnOverlayClick = true,
  className = '',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const sizeClass =
    size === 'fullscreen'
      ? 'md:w-screen md:h-screen md:max-h-screen md:rounded-none'
      : panelSizeClasses[size];

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-[#2A2118]/45 flex items-end md:items-center md:justify-center md:p-4"
      onClick={closeOnOverlayClick ? onClose : undefined}
      aria-hidden={!isOpen}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={[
          'flex flex-col bg-surface shadow-modal overflow-hidden w-full',
          // Mobile: bottom sheet
          'fixed bottom-0 left-0 right-0 rounded-t-xl max-h-[90dvh]',
          // md+: centered dialog
          'md:static md:rounded-modal md:max-h-[90vh]',
          sizeClass,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

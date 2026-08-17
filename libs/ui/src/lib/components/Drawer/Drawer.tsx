'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface DrawerProps {
  isOpen:               boolean;
  onClose:              () => void;
  closeOnOverlayClick?: boolean;
  /** Panel width. Default "28rem". */
  width?:               string;
  className?:           string;
  children:             React.ReactNode;
}

export interface DrawerHeaderProps {
  children:    React.ReactNode;
  onClose?:    () => void;
  closeLabel?: string;
}

export interface DrawerBodyProps { children: React.ReactNode; className?: string }
export interface DrawerFooterProps { children: React.ReactNode; className?: string }

export const DrawerHeader: React.FC<DrawerHeaderProps> = ({ children, onClose, closeLabel = 'Close' }) => (
  <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border shrink-0">
    <h2 className="text-lg font-bold text-secondary leading-snug">{children}</h2>
    {onClose && (
      <button
        onClick={onClose}
        aria-label={closeLabel}
        className="shrink-0 p-1 rounded-sm text-muted hover:text-secondary hover:bg-background transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

export const DrawerBody: React.FC<DrawerBodyProps> = ({ children, className = '' }) => (
  <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-5 ${className}`}>{children}</div>
);

export const DrawerFooter: React.FC<DrawerFooterProps> = ({ children, className = '' }) => (
  <div className={`flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0 ${className}`}>
    {children}
  </div>
);

/**
 * Right-side slide-over panel — distinct from the centered/bottom-sheet
 * `Modal`. Etsy uses this for longer, form-heavy single-purpose flows
 * (Create/Edit processing profile, Create/Edit delivery profile) where a
 * centered dialog would feel cramped.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen, onClose, closeOnOverlayClick = true, width = '28rem', className = '', children,
}) => {
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-[#2A2118]/45 flex justify-end"
      onClick={closeOnOverlayClick ? onClose : undefined}
      aria-hidden={!isOpen}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width }}
        className={[
          'flex flex-col bg-surface shadow-modal h-full max-w-full animate-slide-in-right',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

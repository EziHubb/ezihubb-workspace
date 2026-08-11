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
      className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center md:justify-center md:p-4"
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

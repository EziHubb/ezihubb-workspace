'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@mlh/ui';

export interface ConfirmModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  onConfirm:     () => void | Promise<void>;
  title:         string;
  description:   string;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      'default' | 'destructive';
  isLoading?:    boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'default',
  isLoading    = false,
}: ConfirmModalProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => undefined : onClose}
      closeOnOverlayClick={!isLoading}
      size="sm"
    >
      <ModalHeader onClose={isLoading ? undefined : onClose}>
        <div className="flex items-center gap-2.5">
          {isDestructive ? (
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 shrink-0">
              <Trash2 className="w-4 h-4 text-error" />
            </span>
          ) : (
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-50 shrink-0">
              <AlertTriangle className="w-4 h-4 text-warning" />
            </span>
          )}
          <span>{title}</span>
        </div>
      </ModalHeader>

      <ModalBody>
        <p className="text-sm text-muted">{description}</p>
      </ModalBody>

      <ModalFooter>
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={isLoading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={isDestructive ? 'destructive' : 'primary'}
          onClick={onConfirm}
          loading={isLoading}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

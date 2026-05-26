'use client';

import React from 'react';
import Image from 'next/image';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import type { SelectField } from '../../lib/customizer/types';

interface StylePickerGridProps {
  field: SelectField;
}

export function StylePickerGrid({ field }: StylePickerGridProps) {
  const fieldValue = useCustomizerStore((s) => s.fieldValues[field.id]);
  const setField   = useCustomizerStore((s) => s.setFieldValue);

  const selected = fieldValue?.selectValue ?? '';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-secondary">
        {field.label}
        {field.required && <span className="text-error ml-0.5">*</span>}
      </label>

      <div className="grid grid-cols-2 gap-3">
        {field.options.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField(field.id, { selectValue: opt.value })}
              className={[
                'relative rounded-md border-2 overflow-hidden text-left transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isActive
                  ? 'border-primary shadow-sm'
                  : 'border-border hover:border-primary/40',
              ].join(' ')}
              aria-pressed={isActive}
            >
              {opt.previewUrl ? (
                <div className="aspect-square relative">
                  <Image
                    src={opt.previewUrl}
                    alt={opt.label}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-background flex items-center justify-center">
                  <span className="text-xs text-muted">{opt.label}</span>
                </div>
              )}

              <div className="px-2 py-1.5 bg-surface">
                <span className="text-xs font-medium text-secondary">{opt.label}</span>
              </div>

              {/* Checkmark badge */}
              {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {field.helpText && (
        <p className="text-xs text-muted">{field.helpText}</p>
      )}
    </div>
  );
}

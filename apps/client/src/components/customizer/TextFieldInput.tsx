'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import type { TextField, DateField } from '../../lib/customizer/types';

interface TextFieldInputProps {
  field: TextField | DateField;
}

export function TextFieldInput({ field }: TextFieldInputProps) {
  const t           = useTranslations('customizer.step1');
  const fieldValue  = useCustomizerStore((s) => s.fieldValues[field.id]);
  const setField    = useCustomizerStore((s) => s.setFieldValue);
  const setActive   = useCustomizerStore((s) => s.setActiveField);

  const value    = fieldValue?.text ?? '';
  const maxLen   = field.type === 'text' ? field.maxLength : 200;
  const isOver   = maxLen !== undefined && value.length > maxLen;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-secondary">
          {field.label}
          {field.required && <span className="text-error ml-0.5">*</span>}
        </label>
        {maxLen !== undefined && (
          <span className={`text-xs ${isOver ? 'text-error' : 'text-muted'}`}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>

      <input
        type="text"
        value={value}
        placeholder={field.type === 'text' ? (field.placeholder ?? '') : field.format}
        maxLength={maxLen}
        onFocus={() => setActive(field.id)}
        onBlur={() => setActive(null)}
        onChange={(e) => setField(field.id, { text: e.target.value })}
        className={[
          'block w-full rounded-sm border bg-surface px-3 py-2.5 text-sm text-secondary',
          'placeholder:text-muted/60 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          isOver
            ? 'border-error focus:border-error focus:ring-error/20'
            : 'border-border focus:border-primary focus:ring-primary/20',
        ].join(' ')}
        aria-required={field.required}
      />

      {field.helpText && !isOver && (
        <p className="text-xs text-muted">{field.helpText}</p>
      )}
      {isOver && (
        <p className="text-xs text-error" role="alert">
          {t('maxCharacters', { max: maxLen })}
        </p>
      )}
    </div>
  );
}

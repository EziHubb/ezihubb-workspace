'use client';

import { useTranslations } from 'next-intl';
import { useCustomizerStore } from '../../../lib/store/customizer.store';
import { AutoFillBanner } from '../AutoFillBanner';
import type { TextField, DateField } from '../../../lib/customizer/types';

interface Step1Props {
  isLoggedIn: boolean;
}

export function Step1BasicInfo({ isLoggedIn }: Step1Props) {
  const t           = useTranslations('customizer.step1');
  const template    = useCustomizerStore((s) => s.template);
  const fieldValues = useCustomizerStore((s) => s.fieldValues);
  const setField    = useCustomizerStore((s) => s.setFieldValue);
  const setActive   = useCustomizerStore((s) => s.setActiveField);

  if (!template) return null;

  const textFields = template.fields.filter(
    (f): f is TextField | DateField => f.type === 'text' || f.type === 'date',
  );

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-bold text-secondary">{t('title')}</h4>
        <p className="text-sm text-muted mt-1">
          {t('desc')}
        </p>
      </div>

      <AutoFillBanner isLoggedIn={isLoggedIn} />

      {textFields.map((field) => {
        const val    = fieldValues[field.id];
        const text   = val?.text ?? '';
        const maxLen = field.type === 'text' ? field.maxLength : 200;
        const isOver = maxLen !== undefined && text.length > maxLen;

        return (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`field-${field.id}`}
                className="text-sm font-medium text-secondary"
              >
                {field.label}
                {field.required && (
                  <span className="text-error ml-0.5">*</span>
                )}
              </label>
              {maxLen !== undefined && (
                <span
                  className={`text-xs tabular-nums ${
                    isOver ? 'text-error' : 'text-muted'
                  }`}
                >
                  {text.length}/{maxLen}
                </span>
              )}
            </div>

            <input
              id={`field-${field.id}`}
              type="text"
              value={text}
              placeholder={
                field.type === 'text'
                  ? (field.placeholder ?? '')
                  : field.format
              }
              maxLength={maxLen}
              onFocus={() => setActive(field.id)}
              onBlur={() => setActive(null)}
              onChange={(e) => setField(field.id, { text: e.target.value })}
              aria-required={field.required}
              className={[
                'block w-full rounded-sm border bg-surface px-3 py-3 text-sm text-secondary',
                'placeholder:text-muted/60 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-offset-0',
                isOver
                  ? 'border-error focus:border-error focus:ring-error/20'
                  : 'border-border focus:border-primary focus:ring-primary/20',
              ].join(' ')}
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
      })}

      {textFields.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          {t('noTextFields')}
        </p>
      )}
    </div>
  );
}

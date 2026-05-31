'use client';

import { useCustomizerStore } from '../store/customizer.store';

export interface CustomizerValidation {
  isValid:       boolean;
  missingFields: string[];
}

/**
 * Derives validation state from the customizer store.
 * Returns the list of required field labels that are not yet filled.
 */
export function useCustomizerValidation(): CustomizerValidation {
  const template    = useCustomizerStore((s) => s.template);
  const fieldValues = useCustomizerStore((s) => s.fieldValues);

  if (!template) {
    return { isValid: false, missingFields: [] };
  }

  const missingFields: string[] = [];

  for (const field of template.fields) {
    if (!field.required) continue;
    const val = fieldValues[field.id];
    let filled = false;

    if (field.type === 'text' || field.type === 'date') {
      filled = Boolean(val?.text?.trim());
    } else if (field.type === 'image') {
      filled = Boolean(val?.imageKey);
    } else if (field.type === 'select') {
      filled = Boolean(val?.selectValue);
    }

    if (!filled) missingFields.push(field.label);
  }

  return { isValid: missingFields.length === 0, missingFields };
}

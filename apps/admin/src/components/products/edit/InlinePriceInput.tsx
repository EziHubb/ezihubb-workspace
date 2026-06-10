'use client'

import { useRef, useState } from 'react';
import { api } from '../../../lib/api-client';

interface Props {
  variantId?: string
  defaultValue?: number | null
  field: 'price' | 'compareAtPrice'
  productId: string
  placeholder?: string
  onSaved?: (value: number | null) => void
}

export function InlinePriceInput({
  variantId, defaultValue, field, productId, placeholder = '—', onSaved
}: Props) {
  const [value, setValue] = useState(
    defaultValue != null ? String(defaultValue) : ''
  )
  const [isFocused, setIsFocused] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    if (!variantId) return
    const numValue = value.trim() === '' ? null : parseFloat(value)
    setIsSaving(true)
    try {
      await api.patch(
        `/admin/products/${productId}/variations/variants/${variantId}`,
        { [field]: numValue },
      )
      onSaved?.(numValue)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={`
      flex items-center gap-1 border rounded-lg px-2 py-1.5
      transition-colors min-w-[100px] max-w-[140px]
      ${isFocused ? 'border-secondary ring-1 ring-secondary/20' : 'border-border'}
    `}>
      <span className="text-muted text-sm">$</span>
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false)
          save()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
            const allInputs = document.querySelectorAll('[data-price-input]')
            const current = Array.from(allInputs).indexOf(e.currentTarget)
            const next = allInputs[current + 1] as HTMLInputElement
            next?.focus()
          }
          if (e.key === 'Tab') {
            save()
          }
        }}
        data-price-input
        placeholder={placeholder}
        className="flex-1 text-sm outline-none bg-transparent w-full"
      />
      {isSaving && <i className="ti ti-loader-2 animate-spin text-xs text-muted" />}
    </div>
  )
}

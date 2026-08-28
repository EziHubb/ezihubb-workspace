'use client';

import { useState, useRef, useEffect } from 'react';
import { useDialog } from '../../../contexts/DialogContext';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Pencil, Trash2, X, Plus, ChevronDown,
  AlignLeft, List, Paperclip, Check,
} from 'lucide-react';
import { Select } from '@ezihubb/ui';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { safeArr } from '../../../lib/fmt';
import { Toggle } from './primitives';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomOptionType = 'TEXT_BOX' | 'LIST_OF_OPTIONS' | 'FILE_UPLOAD';

export interface CustomOption {
  id:                 string;
  productId:          string;
  type:               CustomOptionType;
  label:              string;
  required:           boolean;
  instructionText?:   string;
  placeholder?:       string;
  maxLength?:         number;
  isMultiline?:       boolean;
  allowFileUpload?:   boolean;
  choices?:           string[];
  allowMultiSelect?:  boolean;
  acceptedFileTypes?: string[];
  maxFileSizeMB?:     number;
  sortOrder:          number;
}

interface CustomOptionFormValues {
  label:              string;
  required:           boolean;
  instructionText:    string;
  placeholder:        string;
  maxLength:          number;
  isMultiline:        boolean;
  allowFileUpload:    boolean;
  choices:            string[];
  allowMultiSelect:   boolean;
  acceptedFileTypes:  string[];
  maxFileSizeMB:      number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FIELDS = 5;

const TYPE_LABELS: Record<CustomOptionType, string> = {
  TEXT_BOX:        'Text box',
  LIST_OF_OPTIONS: 'List of options',
  FILE_UPLOAD:     'File upload',
};

const FIELD_TYPES: { type: CustomOptionType; icon: React.ElementType; label: string; desc: string }[] = [
  { type: 'TEXT_BOX',        icon: AlignLeft,  label: 'Text box',        desc: 'Collect names, dates, or short quotes' },
  { type: 'LIST_OF_OPTIONS', icon: List,        label: 'List of options', desc: 'Provide a set of choices to pick from' },
  { type: 'FILE_UPLOAD',     icon: Paperclip,   label: 'File upload',     desc: 'Ask buyers to attach a file or image' },
];

const ACCEPTED_FILE_TYPES = [
  { value: 'image/*',         label: 'Images (JPG, PNG, WEBP, HEIC)' },
  { value: 'application/pdf', label: 'PDF documents' },
  { value: '.ai,.eps',        label: 'Design files (AI, EPS)' },
];

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// Inline tag input for choices
function ChoicesInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const t = input.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setInput('');
  };

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-muted/8 border border-border rounded-full text-xs text-secondary">
              {v}
              <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="text-muted hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type an option, press Enter…"
          className={`${inputCls} flex-1`}
        />
        <button type="button" onClick={add} disabled={!input.trim()}
          className="px-3 py-2 text-xs font-semibold text-primary border border-primary/30 rounded-button hover:bg-primary/5 disabled:opacity-30 transition-colors">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── SortableCustomOptionCard ─────────────────────────────────────────────────

function SortableCustomOptionCard({
  option, onEdit, onDelete,
}: {
  option:   CustomOption;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: option.id });

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    zIndex:     isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 border border-border rounded-xl px-4 py-3.5 bg-surface select-none"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-0.5 text-muted cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5 hover:text-secondary transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-secondary">{option.label || '(Untitled)'}</span>
          <span className="text-muted text-xs">·</span>
          <span className="text-sm text-muted">
            {TYPE_LABELS[option.type]}{option.type === 'TEXT_BOX' && option.allowFileUpload ? ' + file upload' : ''}
          </span>
          <span className="text-muted text-xs">·</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${option.required ? 'bg-amber-50 text-amber-700' : 'bg-muted/10 text-muted'}`}>
            {option.required ? 'Required' : 'Optional'}
          </span>
        </div>

        {option.instructionText && (
          <p className="text-xs text-muted mt-1 line-clamp-2 leading-snug">
            {option.instructionText}
          </p>
        )}

        {option.type === 'LIST_OF_OPTIONS' && option.choices && option.choices.length > 0 && (
          <p className="text-xs text-muted mt-1">
            {option.choices.slice(0, 4).join(' · ')}
            {option.choices.length > 4 && ` +${option.choices.length - 4} more`}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button type="button" onClick={onEdit}
          className="p-1.5 rounded-button hover:bg-muted/10 text-muted hover:text-secondary transition-colors"
          title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onDelete}
          className="p-1.5 rounded-button hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
          title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── CustomOptionSheet ────────────────────────────────────────────────────────

function CustomOptionSheet({
  productId, type, option, onSaved, onClose,
}: {
  productId: string;
  type:      CustomOptionType;
  option?:   CustomOption | null;
  onSaved:   () => void;
  onClose:   () => void;
}) {
  const isEditing = !!option;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<CustomOptionFormValues>({
      defaultValues: {
        label:             option?.label             ?? '',
        required:          option?.required          ?? false,
        instructionText:   option?.instructionText   ?? '',
        placeholder:       option?.placeholder       ?? '',
        maxLength:         option?.maxLength         ?? 250,
        isMultiline:       option?.isMultiline       ?? false,
        allowFileUpload:   option?.allowFileUpload   ?? false,
        choices:           option?.choices           ?? [],
        allowMultiSelect:  option?.allowMultiSelect  ?? false,
        acceptedFileTypes: option?.acceptedFileTypes ?? ['image/*'],
        maxFileSizeMB:     option?.maxFileSizeMB     ?? 10,
      },
    });

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const onSubmit = async (data: CustomOptionFormValues) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (isEditing) {
        await api.patch(API_ROUTES.ADMIN.PRODUCT_CUSTOM_OPTION(productId, option!.id), { type, ...data });
      } else {
        await api.post(API_ROUTES.ADMIN.PRODUCT_CUSTOM_OPTIONS(productId), { type, ...data });
      }
      onSaved();
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const typeTitle = TYPE_LABELS[type];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[400px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h4 className="font-bold text-secondary">
              {isEditing ? `Edit ${typeTitle.toLowerCase()}` : `Add ${typeTitle.toLowerCase()}`}
            </h4>
            <p className="text-xs text-muted mt-0.5">{typeTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Label */}
            <div>
              <FieldLabel required>Label</FieldLabel>
              <input
                {...register('label', { required: 'Label is required' })}
                placeholder="e.g. Personalisation"
                className={`${inputCls} ${errors.label ? 'border-red-400' : ''}`}
              />
              {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label.message}</p>}
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-semibold text-secondary">Required</p>
                <p className="text-xs text-muted mt-0.5">Buyers must fill this in before checkout</p>
              </div>
              <Toggle checked={watch('required')} onChange={(v) => setValue('required', v)} />
            </div>

            {/* Instruction text */}
            <div>
              <FieldLabel>Instruction text</FieldLabel>
              <textarea
                {...register('instructionText')}
                rows={3}
                placeholder="Instructions shown to the buyer in the cart…"
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* ── TEXT_BOX fields ── */}
            {type === 'TEXT_BOX' && (
              <>
                <div>
                  <FieldLabel>Placeholder text</FieldLabel>
                  <input
                    {...register('placeholder')}
                    placeholder="e.g. Enter your name here"
                    className={inputCls}
                  />
                </div>
                <div>
                  <FieldLabel>Max characters</FieldLabel>
                  <input
                    type="number"
                    {...register('maxLength', { min: 1, max: 2000, valueAsNumber: true })}
                    className="w-28 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <p className="text-sm font-semibold text-secondary">Multi-line</p>
                  <Toggle checked={watch('isMultiline')} onChange={(v) => setValue('isMultiline', v)} />
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-button border border-border bg-background px-3 py-3">
                  <input
                    type="checkbox"
                    {...register('allowFileUpload')}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-secondary">Allow file upload</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      Show one compact attachment control below this text box.
                    </span>
                  </span>
                </label>
              </>
            )}

            {/* ── LIST_OF_OPTIONS fields ── */}
            {type === 'LIST_OF_OPTIONS' && (
              <>
                <div>
                  <FieldLabel required>Options</FieldLabel>
                  <ChoicesInput
                    values={safeArr(watch('choices'))}
                    onChange={(v) => setValue('choices', v)}
                  />
                  {safeArr(watch('choices')).length === 0 && (
                    <p className="text-xs text-muted mt-1">Add at least one option.</p>
                  )}
                </div>
                <div className="flex items-center justify-between py-1">
                  <p className="text-sm font-semibold text-secondary">Allow multiple selections</p>
                  <Toggle checked={watch('allowMultiSelect')} onChange={(v) => setValue('allowMultiSelect', v)} />
                </div>
              </>
            )}

            {/* ── FILE_UPLOAD fields ── */}
            {(type === 'FILE_UPLOAD' || (type === 'TEXT_BOX' && watch('allowFileUpload'))) && (
              <>
                <div>
                  <FieldLabel>Accepted file types</FieldLabel>
                  <div className="space-y-2 mt-1">
                    {ACCEPTED_FILE_TYPES.map((ft) => {
                      const checked = safeArr(watch('acceptedFileTypes')).includes(ft.value);
                      return (
                        <label key={ft.value} className="flex items-center gap-2.5 cursor-pointer">
                          <div
                            onClick={() => {
                              const current = safeArr(watch('acceptedFileTypes'));
                              setValue('acceptedFileTypes',
                                checked
                                  ? current.filter((t) => t !== ft.value)
                                  : [...current, ft.value],
                              );
                            }}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-primary border-primary' : 'border-muted'}`}
                          >
                            {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-sm text-secondary">{ft.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Max file size</FieldLabel>
                  <Select
                    {...register('maxFileSizeMB', { valueAsNumber: true })}
                    options={[5, 10, 20, 50].map((s) => ({ value: String(s), label: `${s} MB` }))}
                  />
                </div>
              </>
            )}

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">
                {saveError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-border shrink-0">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add field'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CustomOptionsEditorProps {
  productId: string;
}

export function CustomOptionsEditor({ productId }: CustomOptionsEditorProps) {
  const qc = useQueryClient();
  const { confirm } = useDialog();
  const [editingOption, setEditingOption] = useState<CustomOption | null>(null);
  const [addingType,    setAddingType]    = useState<CustomOptionType | null>(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Fetch options
  const { data: options = [], isLoading } = useQuery<CustomOption[]>({
    queryKey: ['custom-options', productId],
    queryFn:  () => api.get<CustomOption[]>(`/admin/products/${productId}/custom-options`),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['custom-options', productId] });

  // Delete
  const handleDelete = async (optionId: string) => {
    if (!await confirm('Remove this custom field?', { confirmLabel: 'Remove', destructive: true })) return;
    await api.delete(API_ROUTES.ADMIN.PRODUCT_CUSTOM_OPTION(productId, optionId));
    invalidate();
  };

  // Reorder on drag-end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = options.findIndex((o) => o.id === active.id);
    const newIdx = options.findIndex((o) => o.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(options, oldIdx, newIdx);
    // Optimistic update via immediate re-fetch + background save
    api.put(API_ROUTES.ADMIN.PRODUCT_CUSTOM_OPTIONS_REORDER(productId), {
      orderedIds: reordered.map((o) => o.id),
    }).then(() => invalidate());
  };

  return (
    <div>
      {/* Option cards */}
      {isLoading ? (
        <div className="space-y-2 mb-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : options.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={options.map((o) => o.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 mb-4">
              {options.map((option) => (
                <SortableCustomOptionCard
                  key={option.id}
                  option={option}
                  onEdit={() => { setEditingOption(option); setAddingType(null); }}
                  onDelete={() => handleDelete(option.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      {/* Add field button + counter */}
      <div className="flex items-center gap-4">
        {options.length < MAX_FIELDS && (
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/3 rounded-button px-4 py-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add field
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 z-20 w-60 bg-surface border border-border/60 rounded-card shadow-floating p-1.5 animate-fade-in origin-top">
                {FIELD_TYPES.map(({ type, icon: Icon, label, desc }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setAddingType(type);
                      setEditingOption(null);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-button hover:bg-muted/8 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-secondary">{label}</p>
                      <p className="text-xs text-muted mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-sm text-muted">
          Using <span className="font-semibold text-secondary">{options.length}</span> of {MAX_FIELDS} fields
        </span>
      </div>

      {/* Add / Edit slide-over */}
      {(addingType || editingOption) && (
        <CustomOptionSheet
          productId={productId}
          type={(addingType ?? editingOption!.type) as CustomOptionType}
          option={editingOption}
          onSaved={() => {
            setAddingType(null);
            setEditingOption(null);
            invalidate();
          }}
          onClose={() => {
            setAddingType(null);
            setEditingOption(null);
          }}
        />
      )}
    </div>
  );
}

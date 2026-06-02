import { useFormContext } from 'react-hook-form';
import type { ProductEditFormValues } from './types';

interface CheckboxOption {
  value: string;
  label: string;
  desc?: string;
}

interface Props {
  name:    keyof ProductEditFormValues;
  options: CheckboxOption[];
}

export function CheckboxGroupWithDesc({ name, options }: Props) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();
  const current = (watch(name) as string[]) ?? [];

  const toggle = (value: string) => {
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setValue(name, next as any, { shouldDirty: true });
  };

  return (
    <div className="space-y-4">
      {options.map(opt => (
        <label
          key={opt.value}
          className="flex gap-3 cursor-pointer group"
          onClick={() => toggle(opt.value)}
        >
          <div className={[
            'w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 transition-colors',
            'flex items-center justify-center',
            current.includes(opt.value)
              ? 'border-secondary bg-secondary'
              : 'border-border group-hover:border-secondary',
          ].join(' ')}>
            {current.includes(opt.value) && (
              <i className="ti ti-check text-white text-xs" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{opt.label}</p>
            {opt.desc && <p className="text-sm text-muted mt-0.5">{opt.desc}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}

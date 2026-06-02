import { useFormContext } from 'react-hook-form';
import type { ProductEditFormValues } from './types';

interface RadioOption {
  value:     string;
  label:     string;
  desc?:     string;
  examples?: string;
}

interface Props {
  name:    keyof ProductEditFormValues;
  options: RadioOption[];
}

export function RadioGroupWithDesc({ name, options }: Props) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();
  const current = watch(name) as string;

  return (
    <div className="space-y-4">
      {options.map(opt => (
        <label
          key={opt.value}
          className="flex gap-3 cursor-pointer group"
          onClick={() => setValue(name, opt.value as any, { shouldDirty: true })}
        >
          <div className={[
            'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors',
            'flex items-center justify-center',
            current === opt.value
              ? 'border-secondary bg-secondary'
              : 'border-border group-hover:border-secondary',
          ].join(' ')}>
            {current === opt.value && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>

          <div>
            <p className="text-sm font-medium leading-tight">{opt.label}</p>
            {opt.desc && (
              <p className="text-sm text-muted mt-0.5 leading-snug">{opt.desc}</p>
            )}
            {opt.examples && (
              <p className="text-xs text-muted mt-1 italic">{opt.examples}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

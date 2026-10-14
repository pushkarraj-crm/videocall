import { cn } from '@/lib/utils';

interface FilterPillsProps<T extends string> {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterPillsProps<T>) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            'press-scale rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
            value === opt.key
              ? 'gradient-primary text-white shadow-[0_2px_12px_rgba(255,46,116,0.3)]'
              : 'border border-white/10 bg-white/5 text-[#A7A7B3] hover:text-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
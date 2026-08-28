import { cn } from '@/lib/utils/cn';

export interface FilterChip {
  value: string;
  label: string;
}

/** Baris chip filter (scroll horizontal bila melebihi lebar). */
export function MitraFilterChips({
  options,
  value,
  onChange,
}: {
  options: FilterChip[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition active:scale-95',
              active
                ? 'bg-deep-blue-500 text-[#10200a] shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

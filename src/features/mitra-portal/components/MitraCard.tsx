import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Kartu berjudul (ikon + judul) untuk blok informasi detail. */
export function LabeledCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('drive-card rounded-2xl p-4', className)}>
      <div className="flex items-center gap-2 text-neutral-900">
        <Icon className="text-deep-blue-500 size-4" />
        <h3 className="text-14 font-semibold">{title}</h3>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

/** Baris label–nilai di dalam kartu informasi. */
export function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-y-0.5">
      <span className="shrink-0 text-[12px] text-neutral-500">{label}</span>
      <span className={cn('text-left text-[14px] font-medium text-neutral-900', valueClassName)}>
        {value}
      </span>
    </div>
  );
}

/** Kartu statistik kecil (ikon + nilai + label) untuk header detail. */
export function StatTile({
  icon: Icon,
  value,
  label,
  iconClassName,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  iconClassName?: string;
}) {
  return (
    <div className="drive-card flex flex-col items-center gap-y-2 rounded-2xl px-1 py-3 text-center">
      <Icon className={cn('text-deep-blue-500 size-5', iconClassName)} />
      <div className="flex h-auto w-full flex-col items-center gap-y-0">
        <span className="text-10 font-bold text-neutral-900">{value}</span>
        <span className="text-10 text-neutral-500">{label}</span>
      </div>
    </div>
  );
}

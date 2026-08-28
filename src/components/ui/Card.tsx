import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('drive-card rounded-xl border border-neutral-300 p-4', className)}
      {...rest}
    />
  );
}

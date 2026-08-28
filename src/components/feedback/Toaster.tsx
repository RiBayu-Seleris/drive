import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToastStore, type ToastItem, type ToastTone } from './toast';

const TONE_CONFIG: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-success' },
  error: { icon: AlertCircle, className: 'text-danger' },
  info: { icon: Info, className: 'text-deep-blue-500' },
  warning: { icon: AlertTriangle, className: 'text-warning' },
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { icon: Icon, className } = TONE_CONFIG[toast.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-neutral-300 bg-neutral-100 p-3.5 shadow-lg"
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', className)} />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-14 font-semibold text-neutral-900">{toast.title}</p>}
        <p className="text-12 break-words text-neutral-800">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Tutup notifikasi"
        className="text-neutral-600 hover:text-neutral-900"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-4">
      <div className="flex w-full max-w-[420px] flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </div>
  );
}

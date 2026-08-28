import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Tampilkan sebagai bottom-sheet di mobile (default) atau dialog tengah. */
  variant?: 'sheet' | 'center';
  showClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'center',
  showClose = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-black/40 p-0',
        variant === 'sheet' ? 'items-end justify-center' : 'items-center justify-center',
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-[480px] bg-neutral-100 shadow-xl',
          variant === 'sheet'
            ? 'pb-safe animate-[slideUp_.2s_ease-out] rounded-t-3xl'
            : 'rounded-lg',
        )}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between border-b border-neutral-300 px-5 py-4">
            <h2 className="text-16 font-semibold text-neutral-900">{title}</h2>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="text-neutral-600 hover:text-neutral-900"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="border-t border-neutral-300 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

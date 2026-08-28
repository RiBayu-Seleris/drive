import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Tandai wajib isi — lihat catatan pada `InputProps.requiredMark`. */
  requiredMark?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, className, id, rows = 4, requiredMark, ...rest },
  ref,
) {
  const reactId = useId();
  const fieldId = id ?? reactId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-2 block text-sm font-medium text-neutral-800">
          {label}
          {requiredMark && (
            <span className="text-danger ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-required={requiredMark || undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          'w-full rounded-lg border bg-neutral-100 px-4 py-3 text-sm text-neutral-900 shadow-sm transition',
          'placeholder:text-sm placeholder:font-light placeholder:text-neutral-600 focus:ring-2 focus:outline-none disabled:bg-neutral-300 disabled:text-neutral-700',
          error
            ? 'border-danger focus:ring-danger/30'
            : 'focus:border-deep-blue-500 focus:ring-deep-blue-200 border-neutral-300',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="text-danger mt-1 text-xs">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-600">{hint}</p>
      ) : null}
    </div>
  );
});

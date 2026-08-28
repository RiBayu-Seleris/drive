import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  /**
   * Tandai wajib isi: bintang merah di label + `aria-required`.
   *
   * Sengaja BUKAN atribut `required` bawaan HTML. Validasi form ini dipegang
   * zod lewat react-hook-form; menyalakan validasi native akan memunculkan
   * gelembung peringatan browser lebih dulu dan menghalangi pesan galat yang
   * sudah kita rancang.
   */
  requiredMark?: boolean;
  /** Tambahkan tombol show/hide bila type="password". */
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    className,
    containerClassName,
    id,
    type = 'text',
    requiredMark,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="hud-readout mb-2 block text-[10.5px] tracking-[0.14em] text-neutral-600 uppercase"
        >
          {label}
          {requiredMark && (
            // aria-hidden karena status wajib sudah disampaikan lewat
            // aria-required pada input — jangan dibacakan dua kali.
            <span className="text-danger ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          aria-required={requiredMark || undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'block h-12 w-full rounded-xl border bg-neutral-200 px-4 text-sm text-neutral-900 transition',
            'shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]',
            'placeholder:text-sm placeholder:font-light placeholder:text-neutral-500',
            'focus:ring-2 focus:outline-none disabled:bg-neutral-300 disabled:text-neutral-700',
            leftIcon && 'pl-11',
            isPassword && 'pr-12',
            error
              ? 'border-danger focus:ring-danger/30'
              : 'border-[#22313c] focus:border-deep-blue-500 focus:ring-deep-blue-500/25 focus:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45),0_0_18px_-6px_rgba(173,237,31,0.6)]',
            className,
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-600 hover:text-neutral-800"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-danger mt-1 text-xs">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-600">{hint}</p>
      ) : null}
    </div>
  );
});

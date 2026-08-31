import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

// Tema DRIVE: hijau aksennya terang, jadi teks di atasnya harus GELAP.
// Putih di atas #aded1f cuma 3,2:1 (di bawah ambang keterbacaan); teks gelap
// mencapai ~11:1 dan itu juga yang terlihat pada tombol di poster.
const ON_BRAND = 'text-[#10200a]';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Tombol utama memakai gradien dua warna merek, bukan warna rata — itu yang
  // membuatnya terbaca sebagai tombol, bukan bidang hijau.
  primary: `border border-transparent bg-[linear-gradient(148deg,#aded1f,#83bd04)] ${ON_BRAND} shadow-[0_5px_12px_-8px_rgba(173,237,31,0.6)] hover:brightness-110 active:brightness-95 disabled:bg-neutral-300 disabled:bg-none disabled:text-neutral-500 disabled:shadow-none`,
  secondary:
    'border border-deep-blue-200 bg-deep-blue-50 text-deep-blue-600 hover:bg-deep-blue-100 active:bg-deep-blue-200',
  outline:
    'border border-deep-blue-500 bg-transparent text-deep-blue-500 hover:bg-deep-blue-50 active:bg-deep-blue-100',
  ghost: 'border border-transparent text-deep-blue-600 hover:bg-deep-blue-50',
  danger: `border border-transparent bg-danger text-[#1e0606] hover:brightness-110 active:brightness-95`,
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-4 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = true,
    isLoading = false,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.99]',
        'focus-visible:ring-deep-blue-300 focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-70',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {isLoading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});

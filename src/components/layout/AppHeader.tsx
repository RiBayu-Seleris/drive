import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Logo } from '@/components/brand/Logo';

export interface AppHeaderProps {
  title?: string;
  /** Tampilkan logo di tengah alih-alih judul teks. */
  showLogo?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: ReactNode;
  className?: string;
  /** Header transparan di atas konten (mis. halaman dengan hero image). */
  transparent?: boolean;
}

export function AppHeader({
  title,
  showLogo = false,
  showBack = true,
  onBack,
  rightSlot,
  className,
  transparent = false,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const handleBack = () => (onBack ? onBack() : navigate(-1));

  return (
    <header
      className={cn(
        'pt-safe sticky top-0 z-30 flex h-[60px] items-center justify-between px-4',
        transparent
          ? 'bg-transparent'
          : 'border-b border-neutral-300 bg-neutral-100 shadow-[0_4px_14px_rgb(32_41_68_/_0.04)]',
        className,
      )}
    >
      <div className="flex w-10 justify-start">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Kembali"
            className="text-deep-blue-500 hover:bg-deep-blue-50 -ml-1 flex size-9 items-center justify-center rounded-full"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center">
        {showLogo ? (
          <Logo />
        ) : (
          <h1 className="text-16 text-deep-blue-500 truncate font-semibold">{title}</h1>
        )}
      </div>

      <div className="flex w-10 justify-end">{rightSlot}</div>
    </header>
  );
}

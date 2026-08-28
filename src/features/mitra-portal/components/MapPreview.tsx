import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Pratinjau peta dekoratif (faux map) — placeholder ringan tanpa dependensi peta.
 * Ganti dengan komponen peta sungguhan saat integrasi tersedia.
 */
export function MapPreview({
  className,
  marker = true,
  overlay,
}: {
  className?: string;
  marker?: boolean;
  overlay?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-[#131c24]',
        'bg-[linear-gradient(90deg,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:22px_22px]',
        className,
      )}
    >
      {/* jalan utama dekoratif */}
      <span className="absolute top-0 -left-6 h-full w-7 rotate-12 bg-white/70" />
      <span className="bg-warning/30 absolute top-1/3 left-0 h-3 w-full -rotate-3" />
      <span className="absolute bottom-6 left-0 h-2.5 w-full rotate-2 bg-white/60" />

      {marker && (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
          <MapPin className="text-danger size-8 drop-shadow" fill="currentColor" />
        </span>
      )}

      {overlay && <div className="absolute right-0 bottom-0 left-0 p-3">{overlay}</div>}
    </div>
  );
}

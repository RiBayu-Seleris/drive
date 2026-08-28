import { Search } from 'lucide-react';

/** Kolom pencarian portal mitra (sesuai desain: pill putih + ikon kiri). */
export function MitraSearch({
  value,
  onChange,
  placeholder = 'Cari…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="drive-card focus:border-deep-blue-400 focus:ring-deep-blue-100 h-12 w-full rounded-xl border border-neutral-200 pr-4 pl-11 text-sm text-neutral-900 transition placeholder:text-neutral-500 focus:ring-2 focus:outline-none"
      />
    </div>
  );
}

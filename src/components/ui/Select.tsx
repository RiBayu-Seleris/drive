import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  /** Mode terkendali. Kosongkan bila memakai `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Diisi agar nilainya ikut terbaca `FormData` pada form tak terkendali. */
  name?: string;
  label?: string;
  error?: string;
  hint?: string;
  /** Teks saat belum ada pilihan. Tidak ikut jadi opsi yang bisa dipilih. */
  placeholder?: string;
  disabled?: boolean;
  requiredMark?: boolean;
  className?: string;
  containerClassName?: string;
  id?: string;
}

/** Jarak panel ke pemicunya. */
const PANEL_GAP = 4;

/**
 * Dropdown dengan panel yang selalu muncul DI BAWAH field.
 *
 * Sengaja tidak memakai `<select>` native: di macOS popup native menimpa
 * field (menempel pada opsi terpilih), bukan turun ke bawah seperti yang
 * diharapkan, dan posisi itu tidak bisa diatur lewat CSS.
 *
 * Panel dirender lewat portal karena shell halaman memakai `overflow-x-hidden`
 * — panel yang absolut di dalamnya akan terpotong.
 */
export function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  label,
  error,
  hint,
  placeholder,
  disabled = false,
  requiredMark,
  className,
  containerClassName,
  id,
}: SelectProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const listboxId = `${fieldId}-listbox`;

  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue ?? '');
  const selectedValue = isControlled ? value : innerValue;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelStyle, setPanelStyle] = useState<{ left: number; top: number; width: number }>({
    left: 0,
    top: 0,
    width: 0,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === selectedValue);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);

  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelStyle({ left: rect.left, top: rect.bottom + PANEL_GAP, width: rect.width });
  }, []);

  // Panel memakai posisi fixed, jadi koordinatnya harus diperbarui saat halaman
  // di-scroll atau ukuran layar berubah selama panel terbuka.
  useEffect(() => {
    if (!open) return;
    reposition();
    const handle = () => reposition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const openPanel = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const commit = (option: SelectOption) => {
    if (option.disabled) return;
    if (!isControlled) setInnerValue(option.value);
    onChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  /** Cari opsi berikutnya yang bisa dipilih, melompati yang dinonaktifkan. */
  const moveActive = (from: number, step: number) => {
    if (options.length === 0) return;
    let next = from;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + step + options.length) % options.length;
      if (!options[next]?.disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        openPanel();
      }
      return;
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveActive(activeIndex, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(activeIndex, -1);
        break;
      case 'Home':
        event.preventDefault();
        moveActive(-1, 1);
        break;
      case 'End':
        event.preventDefault();
        moveActive(0, -1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) commit(option);
        break;
      }
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={fieldId} className="mb-2 block text-sm font-medium text-neutral-800">
          {label}
          {requiredMark && (
            // aria-hidden karena status wajib sudah disampaikan lewat
            // aria-required pada pemicu — jangan dibacakan dua kali.
            <span className="text-danger ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* Nilai dititipkan ke input tersembunyi supaya form tak terkendali
          tetap bisa membacanya lewat FormData seperti `<select name>` dulu. */}
      {name && <input type="hidden" name={name} value={selectedValue} />}

      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-required={requiredMark || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={onKeyDown}
        className={cn(
          'h-10 w-full rounded-lg border bg-white pr-3 pl-4 text-left text-sm shadow-sm transition',
          'focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-700',
          selected ? 'text-neutral-900' : 'text-neutral-600',
          error
            ? 'border-danger focus:ring-danger/30'
            : 'focus:border-deep-blue-500 focus:ring-deep-blue-200 border-gray-300',
          className,
          // Ditaruh SETELAH className: kelas kontrol milik pemanggil kerap
          // membawa `block` (gaya `<input>`), yang akan mematahkan tata letak
          // isi tombol sehingga ikon chevron turun ke baris berikutnya.
          'flex items-center justify-between gap-2',
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? 'Pilih…'}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4.5 shrink-0 text-neutral-700 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open &&
        createPortal(
          <ul
            ref={panelRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={fieldId}
            style={{ left: panelStyle.left, top: panelStyle.top, width: panelStyle.width }}
            className="fixed z-50 max-h-60 overflow-y-auto rounded-lg border border-neutral-300 bg-white p-1 shadow-lg"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-neutral-600">Tidak ada pilihan</li>
            ) : (
              options.map((option, index) => {
                const isSelected = option.value === selectedValue;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                    onClick={() => commit(option)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm',
                      option.disabled && 'cursor-not-allowed text-neutral-600 opacity-70',
                      !option.disabled && index === activeIndex && 'bg-neutral-200',
                      isSelected ? 'text-deep-blue-600 font-semibold' : 'text-neutral-800',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="text-deep-blue-500 size-4 shrink-0" />}
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}

      {error ? (
        <p id={`${fieldId}-error`} className="text-danger mt-1 text-xs">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-600">{hint}</p>
      ) : null}
    </div>
  );
}

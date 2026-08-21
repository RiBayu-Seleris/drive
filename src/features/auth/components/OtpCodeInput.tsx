import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { OTP_CODE_LENGTH } from '../otp';

interface OtpCodeInputProps {
  /** Kode saat ini (boleh kurang dari panjang penuh). */
  value: string;
  onChange: (code: string) => void;
  /** Dipanggil sekali saat kode terisi penuh — untuk submit otomatis. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  length?: number;
}

/**
 * Deretan kotak kode OTP. Dipakai bersama layar verifikasi email dan setel
 * ulang kata sandi.
 *
 * Perilaku yang diharapkan di HP: pindah kotak otomatis, backspace mundur,
 * dan menempel kode utuh langsung mengisi semua kotak (termasuk bila ditempel
 * ke satu kotak saja — itu yang terjadi saat menyalin dari aplikasi email).
 */
export function OtpCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  length = OTP_CODE_LENGTH,
}: OtpCodeInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  const focusInput = (index: number) => {
    inputsRef.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  };

  const emit = (next: string[]) => {
    const code = next.join('');
    onChange(code);
    if (code.length === length && !next.includes('')) onComplete?.(code);
  };

  const handleChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '');
    const next = [...digits];

    if (!value) {
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    let cursor = index;
    for (const char of value) {
      if (cursor >= length) break;
      next[cursor] = char;
      cursor += 1;
    }
    emit(next);
    focusInput(cursor);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        onChange(next.join(''));
        return;
      }
      if (index > 0) {
        next[index - 1] = '';
        onChange(next.join(''));
        focusInput(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusInput(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    const next = Array.from({ length }, (_, index) => pasted[index] ?? '');
    emit(next);
    focusInput(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          // maxLength longgar agar tempel/autofill lewat satu kotak tetap terbaca.
          maxLength={length}
          aria-label={`Digit ke-${index + 1} kode`}
          disabled={disabled}
          className={`text-20 size-12 rounded-lg border text-center font-semibold transition focus-visible:ring-2 focus-visible:outline-none ${
            hasError
              ? 'border-danger text-danger focus-visible:ring-danger/30'
              : 'focus-visible:ring-deep-blue-300 border-neutral-400 text-neutral-900'
          } disabled:bg-neutral-100`}
        />
      ))}
    </div>
  );
}


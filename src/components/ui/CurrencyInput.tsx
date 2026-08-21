import { forwardRef } from 'react';
import { Input, type InputProps } from './Input';

const formatter = new Intl.NumberFormat('id-ID');

export interface CurrencyInputProps
  extends Omit<InputProps, 'type' | 'value' | 'onChange' | 'leftIcon'> {
  /** Nilai polos tanpa pemisah, mis. "150000000". Kosong = belum diisi. */
  value: string;
  /** Menerima nilai polos tanpa pemisah, siap dikirim ke server. */
  onChange: (value: string) => void;
}

/**
 * Kolom nominal rupiah: menampilkan awalan "Rp" dan pemisah ribuan, tapi
 * menyimpan angka polos.
 *
 * Sengaja `type="text"`, BUKAN `type="number"`. Tiga masalah ikut selesai:
 *
 *  1. Pemisah ribuan mustahil pada type="number" — browser menolak nilai yang
 *     mengandung titik. Padahal tanpa pemisah, 150000000 dan 15000000 nyaris
 *     tidak terbedakan, dan salah baca di sini berarti salah nilai pertanggungan.
 *  2. type="number" punya tombol putar yang IKUT BERUBAH saat roda tetikus
 *     digulir di atasnya. User yang cuma menggulir halaman bisa diam-diam
 *     mengubah nilai kendaraannya tanpa sadar.
 *  3. type="number" tetap menerima huruf tertentu (e, E, +, -) karena dianggap
 *     notasi ilmiah, lalu melaporkan nilainya sebagai string kosong.
 *
 * Papan angka di ponsel tetap muncul lewat `inputMode="numeric"`.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, onChange, className, ...rest }, ref) {
    const digits = value.replace(/\D/g, '');
    const display = digits ? formatter.format(Number(digits)) : '';

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        leftIcon={<span className="text-sm font-medium">Rp</span>}
        value={display}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        className={className}
        {...rest}
      />
    );
  },
);

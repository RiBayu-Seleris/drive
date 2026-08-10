import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Tabel lebar modul Code 128 (indeks 0–102 data, 103–105 start, 106 stop).
 * Tiap pola berselang bar–spasi dimulai dari bar: 3 bar + 3 spasi = 11 modul
 * (khusus stop 4 bar + 3 spasi = 13 modul).
 */
const PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

const START_B = 104;
const STOP = 106;
/** Modul kosong wajib di kiri & kanan simbol supaya terbaca pemindai. */
const QUIET_ZONE = 10;
/** Tinggi simbol dalam satuan viewBox; skala akhir ditentukan CSS. */
const SYMBOL_HEIGHT = 40;

interface Bar {
  x: number;
  width: number;
}

/** Deret nilai Code 128-B, atau null bila ada karakter di luar ASCII 32–126. */
function encodeCode128B(value: string): number[] | null {
  const codes = [START_B];
  for (const char of value) {
    const ascii = char.charCodeAt(0);
    if (ascii < 32 || ascii > 126) return null;
    codes.push(ascii - 32);
  }
  // Checksum: nilai start berbobot 1, karakter ke-n berbobot n.
  const checksum = codes.reduce((sum, code, index) => sum + code * Math.max(index, 1), 0) % 103;
  codes.push(checksum, STOP);
  return codes;
}

function barsOf(codes: number[]): { bars: Bar[]; width: number } {
  const bars: Bar[] = [];
  let x = QUIET_ZONE;
  for (const code of codes) {
    const pattern = PATTERNS[code] ?? '';
    let isBar = true;
    for (const digit of pattern) {
      const width = Number(digit);
      if (isBar) bars.push({ x, width });
      x += width;
      isBar = !isBar;
    }
  }
  return { bars, width: x + QUIET_ZONE };
}

export interface BarcodeProps {
  /** Teks yang dikodekan; hanya ASCII 32–126 (Code 128-B). */
  value: string;
  className?: string;
}

/**
 * Barcode Code 128-B dalam bentuk SVG (warna mengikuti `currentColor`).
 * Dipakai di tiket klaim: petugas bengkel memindainya untuk mendapat kode
 * pekerjaan/nomor klaim yang dimasukkan ke halaman verifikasi tiket.
 */
export function Barcode({ value, className }: BarcodeProps) {
  const symbol = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const codes = encodeCode128B(trimmed);
    return codes ? barsOf(codes) : null;
  }, [value]);

  if (!symbol) return null;

  return (
    <svg
      viewBox={`0 0 ${symbol.width} ${SYMBOL_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Barcode ${value}`}
      className={cn('block', className)}
    >
      {symbol.bars.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={0}
          width={bar.width}
          height={SYMBOL_HEIGHT}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

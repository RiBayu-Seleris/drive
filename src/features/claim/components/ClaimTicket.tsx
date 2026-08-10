import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Barcode } from '@/components/ui/Barcode';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';

/*
 * Warna tiket diambil langsung dari desain (UI-Flow/Users/Klaim Disetujui - …svg):
 * badan tiket #F8A301 dengan ornamen #FFC048, teks status oranye tua #D97706.
 * Sengaja hex, bukan token design system, karena ini elemen ilustratif.
 */
const TICKET_BG = 'bg-[#F8A301]';
/** Warna latar halaman; dipakai takik perforasi agar terlihat berlubang. */
const PAGE_BG = 'bg-[#FBFCFF]';

/*
 * Lipatan sobekan: 320ms terasa gesit tanpa terkesan meloncat. Easing-nya
 * cepat di awal lalu melandai (ease-out kuat), meniru kertas yang jatuh —
 * `ease-out` bawaan terasa menggantung di akhir.
 */
const FOLD_MS = 320;
const FOLD_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Keadaan tiket, menentukan chip status serta sobekannya. */
export type ClaimTicketState =
  /**
   * Klaim disetujui, tapi user belum mendaftarkan bengkel perbaikan. Tiket
   * tampil polos tanpa chip — ajakan memilih bengkel ditaruh di luar tiket.
   */
  | 'unregistered'
  /** Sudah terdaftar di bengkel, menunggu dipindai petugas. */
  | 'processing'
  /** Sudah dipindai bengkel → tiket hangus, sobekan terlepas. */
  | 'expired';

const STATE_STYLE: Partial<Record<ClaimTicketState, { label: string; text: string; dot: string }>> =
  {
    // Chip ini bicara soal TIKET, bukan status klaim: klaimnya sudah pasti
    // disetujui (judul halaman menyatakan itu). Memakai istilah "klaim sedang
    // diproses" seperti di SVG desain justru membantah judulnya sendiri.
    processing: {
      label: 'Tiket belum digunakan',
      text: 'text-[#D97706]',
      dot: 'bg-[#D97706]',
    },
    expired: {
      label: 'Tiket sudah digunakan',
      text: 'text-success',
      dot: 'bg-success',
    },
  };

/** Tanggal ringkas ala desain tiket: "20/08/2025". */
function shortDate(input?: string): string {
  if (!input) return '-';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Nominal ringkas agar muat di kolom tiket: 30.000.000 → "30 Jt". */
function compactRupiah(value: number): string {
  if (value >= 1_000_000_000) return `${Number((value / 1_000_000_000).toFixed(1))} M`;
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))} Jt`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(0))} Rb`;
  return formatCurrency(value);
}

export interface ClaimTicketProps {
  claimNumber: string;
  claimType: string;
  incidentDate?: string;
  /** Nominal yang ditanggung asuransi untuk klaim ini. */
  approvedAmount: number;
  /** Isi barcode: kode pekerjaan bengkel, atau nomor klaim bila belum ada. */
  code: string;
  state: ClaimTicketState;
  className?: string;
}

/**
 * Tiket klaim yang ditunjukkan user ke bengkel mitra. Dua tampilan sesuai
 * desain: utuh (belum dipindai) dan sobek di bagian bawah (sudah dipindai).
 */
export function ClaimTicket({
  claimNumber,
  claimType,
  incidentDate,
  approvedAmount,
  code,
  state,
  className,
}: ClaimTicketProps) {
  const status = STATE_STYLE[state];
  const torn = state === 'expired';
  // Kode disembunyikan sampai diminta: barcode adalah izin perbaikan, tidak
  // perlu terpampang setiap kali tiket dibuka.
  const [revealed, setRevealed] = useState(false);
  const panelId = useId();

  return (
    <div className={cn('flex flex-col', torn && revealed && 'gap-3', className)}>
      {/* Badan tiket */}
      <div
        className={cn(
          'relative flex flex-col overflow-hidden px-4 py-3 text-neutral-900 shadow-[0_8px_20px_rgb(31_41_55_/_0.08)]',
          TICKET_BG,
          torn && 'border-b-2 border-dashed border-white/80',
          // Saat sobekan terlipat, badan tiket berdiri sendiri → sudut bawahnya
          // ikut membulat supaya tidak terlihat terpotong.
          torn || !revealed ? 'rounded-2xl' : 'rounded-t-2xl',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-14 -right-10 size-48 rotate-12 rounded-[42%] bg-[#FFC048]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-12 size-40 rotate-6 rounded-[45%] bg-white/10"
        />

        <div className="relative flex items-center justify-between gap-3">
          {status ? (
            <span
              className={cn(
                'text-10 inline-flex min-w-0 items-center gap-x-1 rounded-full bg-white py-1 pr-3 pl-1.5 font-semibold shadow-sm',
                status.text,
              )}
            >
              {torn ? (
                <span className="bg-success grid size-4 shrink-0 place-items-center rounded-full text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : (
                <span className={cn('mx-0.5 size-2.5 shrink-0 rounded-full', status.dot)} />
              )}
              <span className="text-10 truncate">{status.label}</span>
            </span>
          ) : (
            <span />
          )}
          <Logo className="shrink-0 [&_img]:h-6" />
        </div>

        <dl className="relative mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Nomor Klaim" value={claimNumber || '-'} />
          <Field label="Jenis Klaim" value={claimType || '-'} />
          <Field label="Tanggal Kejadian" value={shortDate(incidentDate)} />
          <Field label="Disetujui" value={`Rp ${compactRupiah(approvedAmount)}`} strong />
        </dl>
      </div>

      {/* Sobekan bawah berisi barcode — terlipat ke belakang badan tiket sampai
          diminta. Tinggi (grid-rows) dan lipatan (rotateX) dianimasikan bersama
          supaya ruangnya membuka seiring panelnya mengayun turun. */}
      <div
        id={panelId}
        className={cn(
          'relative grid motion-reduce:transition-none',
          revealed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
        style={{ transition: `grid-template-rows ${FOLD_MS}ms ${FOLD_EASING}` }}
      >
        <div className="overflow-hidden" style={{ perspective: '900px' }}>
          <div
            className={cn(
              'relative flex flex-col items-center gap-1.5 px-4 pt-4 pb-3 shadow-[0_8px_20px_rgb(31_41_55_/_0.08)] motion-reduce:transition-none',
              TICKET_BG,
              torn
                ? 'rounded-2xl border-t-2 border-dashed border-white/80'
                : 'rounded-b-2xl border-t-2 border-dashed border-white',
            )}
            style={{
              transformOrigin: 'top center',
              transform: revealed
                ? `rotateX(0deg)${torn ? ' rotate(1deg)' : ''}`
                : 'rotateX(-80deg)',
              transition: `transform ${FOLD_MS}ms ${FOLD_EASING}`,
              // Panel ini membawa bayangan dan SVG barcode berisi puluhan bar.
              // Tanpa promosi ke layer sendiri, semuanya digambar ulang tiap
              // frame selama rotasi 3D — itu yang membuat lipatannya patah.
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            <Barcode value={code} className="h-12 w-full text-neutral-900" />
            <span className="text-11 font-semibold tracking-wide text-neutral-900">
              Klaim #{claimNumber || '-'}
            </span>
          </div>
        </div>

        {/* Takik perforasi sengaja di luar pembungkus yang meng-clip: separuh
            lingkarannya harus menjorok keluar tepi tiket agar terlihat
            berlubang. Ikut memudar bersama lipatan. */}
        {!torn && (
          <>
            <span
              aria-hidden
              className={cn(
                'absolute -top-2 -left-2 z-10 size-4 rounded-full transition-opacity duration-300 motion-reduce:transition-none',
                PAGE_BG,
                revealed ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span
              aria-hidden
              className={cn(
                'absolute -top-2 -right-2 z-10 size-4 rounded-full transition-opacity duration-300 motion-reduce:transition-none',
                PAGE_BG,
                revealed ? 'opacity-100' : 'opacity-0',
              )}
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-expanded={revealed}
        aria-controls={panelId}
        className="text-12 text-deep-blue-600 hover:bg-deep-blue-50 mt-3 inline-flex items-center justify-center gap-1.5 self-center rounded-full border border-neutral-300 bg-white px-4 py-2 font-semibold shadow-sm transition active:scale-[0.99]"
      >
        {revealed ? 'Sembunyikan kode' : 'Tampilkan kode'}
        <ChevronDown
          className={cn(
            'size-4 transition-transform duration-300 motion-reduce:transition-none',
            revealed && 'rotate-180',
          )}
        />
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-12 font-semibold">{label}</dt>
      <dd className={cn('mt-0.5 truncate', strong ? 'text-12 font-bold' : 'text-12')}>{value}</dd>
    </div>
  );
}

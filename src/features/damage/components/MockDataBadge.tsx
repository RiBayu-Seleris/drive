import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Label "DATA DUMMY" untuk angka yang tidak berasal dari analisis foto.
 *
 * Kenapa ini ada: mesin `/assess` sedang dibangun ulang tim AI. Selama mati,
 * backend MENGUNDI angka kerusakan dan biayanya (`dev_random_on_assess_fail`),
 * lalu menampilkannya seperti hasil sungguhan. Di layar, angka dadu dan angka
 * asli terlihat persis sama — yang melihatnya wajar mengira mesinnya sudah
 * bekerja. Foto satu mobil dua kali pun memberi angka yang jauh berbeda.
 *
 * Label ini muncul hanya bila backend mengirim `is_mock`. Begitu `/assess`
 * hidup lagi, penandanya berhenti terkirim dan label ini hilang sendiri —
 * tidak ada yang perlu dimatikan tangan.
 *
 * Sengaja memakai warna peringatan, bukan warna merek: tugasnya menyela, bukan
 * menyatu dengan tampilan.
 */
export function MockDataBadge({ note, className }: { note?: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'border-warning/40 bg-warning/10 flex items-start gap-2 rounded-lg border px-3 py-2',
        className,
      )}
    >
      <AlertTriangle className="text-warning mt-px size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-12 text-warning font-semibold tracking-wide">DATA DUMMY</p>
        <p className="text-11 mt-0.5 leading-4 text-neutral-700">
          {note ?? 'Angka di bawah ini belum berasal dari analisis foto — mesinnya belum aktif.'}
        </p>
      </div>
    </div>
  );
}

import type { CapturedImage } from '@/features/vehicle-scan/types';

/**
 * Sidik jari isi pemindaian: plat + foto plat + foto tiap sisi.
 *
 * Memakai `url` (object URL) tiap foto, bukan isinya. Object URL dibuat sekali
 * per pengambilan gambar, jadi memotret ulang satu sisi saja sudah mengubah
 * sidik jarinya — persis yang diinginkan: analisis ulang hanya bila memang ada
 * yang berubah. Membandingkan isi blob akan jauh lebih mahal tanpa hasil yang
 * lebih benar.
 *
 * Dipakai halaman review DAN halaman analisis, jadi keduanya wajib menghitung
 * dengan cara yang sama persis — kalau berbeda, pintasan "foto ini sudah
 * dianalisis" berhenti bekerja dan foto yang sama dikirim ulang.
 */
export function scanSignature(
  plateNumber: string | null,
  plateImage: CapturedImage | null,
  sides: Array<{ id: string; damaged: boolean | null; photo?: CapturedImage | null }>,
): string {
  const parts = [plateNumber ?? '', plateImage?.url ?? ''];
  for (const side of sides) {
    parts.push(`${side.id}:${side.damaged ?? ''}:${side.photo?.url ?? ''}`);
  }
  return parts.join('|');
}

import { userApi } from '@/lib/api/client';

/**
 * OCR nomor identitas kendaraan (rangka & mesin).
 *
 * Dipakai dua alur: pengajuan klaim dan pembelian polis. Keduanya menuntut
 * nomor yang berasal dari kendaraan fisik, karena nilai inilah yang
 * dicocokkan server saat auto-approval klaim.
 */

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value) || 0);

export interface VehicleIdentityOcrResult {
  /** Nomor hasil OCR; string kosong bila tidak terbaca. */
  value: string;
  /** Keyakinan OCR. Rendah = minta user memeriksa, bukan menolak. */
  confidence: number;
  rawText: string;
}

/**
 * Rapikan hasil OCR ke bentuk yang lazim untuk nomor rangka/mesin.
 * OCR kerap menyisipkan spasi atau tanda baca yang bukan bagian nomor.
 */
export function normalizeVehicleIdentityNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

async function recognize(
  endpoint: string,
  field: 'engine_number' | 'chassis_number',
  file: Blob,
  filename: string,
): Promise<VehicleIdentityOcrResult> {
  const form = new FormData();
  form.append('uploadfile', file, filename);
  const res = await userApi.post<{
    data?: Record<string, unknown>;
  }>(endpoint, form);
  const data = res.data?.data ?? {};
  return {
    value: str(data[field]),
    confidence: num(data.confidence),
    rawText: str(data.raw_text),
  };
}

export function recognizeEngineNumber(
  file: Blob,
  filename: string,
): Promise<VehicleIdentityOcrResult> {
  return recognize('/v1/inference/engine-number/ocr', 'engine_number', file, filename);
}

export function recognizeChassisNumber(
  file: Blob,
  filename: string,
): Promise<VehicleIdentityOcrResult> {
  return recognize('/v1/inference/chassis-number/ocr', 'chassis_number', file, filename);
}

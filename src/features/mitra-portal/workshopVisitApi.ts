import { mitraApi } from '@/lib/api/client';

/**
 * Kunjungan mandiri: user membawa kendaraannya sendiri ke bengkel.
 *
 * Berbeda dari `repairJobApi` — pekerjaan perbaikan lahir dari klaim yang sudah
 * disetujui, sedangkan kunjungan mandiri bisa datang tanpa klaim sama sekali
 * (user membayar sendiri). Keduanya sengaja dipisah supaya antrean bengkel bisa
 * membedakan mana yang biayanya sudah dijamin asuransi dan mana yang belum.
 */
export type WorkshopVisitStatus = 'PLANNED' | 'ON_THE_WAY' | 'ARRIVED' | 'COMPLETED' | 'CANCELED';

export interface WorkshopVisit {
  id: number;
  visitCode: string;
  userFullname: string;
  userPhone: string;
  vehiclePlate: string;
  claimNumber: string;
  status: WorkshopVisitStatus;
  notes: string;
  /** > 0 = kunjungan dilanjutkan jadi pekerjaan perbaikan. */
  repairJobId: number;
  repairJobCode: string;
  plannedAt: string;
  arrivedAt: string;
  createdAt: string;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function statusOf(value: unknown): WorkshopVisitStatus {
  const s = str(value).toUpperCase();
  return s === 'ON_THE_WAY' || s === 'ARRIVED' || s === 'COMPLETED' || s === 'CANCELED'
    ? s
    : 'PLANNED';
}

export function parseWorkshopVisit(json: Record<string, unknown>): WorkshopVisit {
  return {
    id: typeof json.id === 'number' ? json.id : 0,
    visitCode: str(json.visit_code),
    userFullname: str(json.user_fullname),
    userPhone: str(json.user_phone),
    vehiclePlate: str(json.vehicle_plate),
    claimNumber: str(json.claim_number),
    status: statusOf(json.status),
    notes: str(json.notes),
    repairJobId: typeof json.repair_job_id === 'number' ? json.repair_job_id : 0,
    repairJobCode: str(json.repair_job_code),
    plannedAt: str(json.planned_at),
    arrivedAt: str(json.arrived_at),
    createdAt: str(json.created_at),
  };
}

function rowsOf(payload: unknown): Record<string, unknown>[] {
  const box = payload as { data?: { data?: unknown } } | undefined;
  const list = box?.data?.data;
  return Array.isArray(list)
    ? list.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    : [];
}

/** Kunjungan yang menuju bengkel ini. Tanpa `status`, hanya yang masih hidup. */
export async function getWorkshopVisits(status?: string): Promise<WorkshopVisit[]> {
  const res = await mitraApi.get('/v1/admin/workshop-visits', {
    params: status ? { status } : undefined,
  });
  return rowsOf(res).map(parseWorkshopVisit);
}

/**
 * Bengkel memindai kode kunjungan → kendaraan dinyatakan TIBA.
 *
 * Penandanya sengaja di tangan bengkel, sama seperti tiket klaim: kalau user
 * yang menekan "saya sudah sampai", tidak ada yang memverifikasi.
 */
export async function scanWorkshopVisit(code: string): Promise<WorkshopVisit> {
  const res = await mitraApi.post<{ data?: Record<string, unknown> }>(
    '/v1/admin/workshop-visits/scan',
    { code: code.trim() },
  );
  return parseWorkshopVisit(res.data?.data ?? {});
}

/**
 * Bengkel selesai memeriksa dan kendaraan perlu diperbaiki → kunjungan menjadi
 * pekerjaan perbaikan. Tanpa klaim, pekerjaannya jadi bayar-sendiri.
 */
export async function repairWorkshopVisit(code: string, note = ''): Promise<void> {
  await mitraApi.post('/v1/admin/workshop-visits/repair', { code: code.trim(), note });
}

/** Bengkel selesai memeriksa dan kendaraan tidak perlu diperbaiki. */
export async function completeWorkshopVisit(code: string, note = ''): Promise<void> {
  await mitraApi.post('/v1/admin/workshop-visits/complete', { code: code.trim(), note });
}

export function workshopVisitStatusLabel(status: WorkshopVisitStatus): string {
  switch (status) {
    case 'ON_THE_WAY':
      return 'Dalam perjalanan';
    case 'ARRIVED':
      return 'Tiba, sedang diperiksa';
    case 'COMPLETED':
      return 'Selesai';
    case 'CANCELED':
      return 'Dibatalkan';
    default:
      return 'Akan datang';
  }
}

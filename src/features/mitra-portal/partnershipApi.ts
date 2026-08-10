import { mitraApi } from '@/lib/api/client';

/**
 * Kemitraan mitra towing ↔ asuransi (sisi mitra towing).
 *
 * Mengikat butuh persetujuan DUA pihak: satu sisi mengundang, sisi lain
 * menerima. Undangan HANYA boleh dijawab oleh pihak yang diundang — pengundang
 * tidak bisa menyetujui undangannya sendiri. Keluar boleh sepihak.
 * Hanya kemitraan berstatus ACTIVE yang dipakai saat dispatch.
 */

export type PartnershipStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'TERMINATED';

/**
 * Jenis relasi. `PARTNERSHIP` = rekanan biasa, boleh dengan banyak asuransi.
 * `OWNERSHIP` = armada eksklusif milik/terikat satu asuransi — hanya asuransi
 * yang boleh mengajukannya, mitra towing tinggal menyetujui atau menolak.
 */
export type PartnershipRelationType = 'PARTNERSHIP' | 'OWNERSHIP';

/** Relasi lain yang otomatis berakhir bila undangan OWNERSHIP disetujui. */
export interface OwnershipImpact {
  insurerName: string;
  relationType: PartnershipRelationType;
  status: PartnershipStatus;
}

/**
 * Profil asuransi pengundang. Dikirim bersama baris kemitraan supaya mitra
 * towing bisa menilai calon rekanan sebelum menjawab. Kontak PIC kosong bila
 * insurer tersebut dikelola terpusat dan belum punya akun partner.
 */
export interface PartnershipInsurerProfile {
  code: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  contactPhone: string;
}

export interface TowingPartnership {
  id: number;
  towingServiceId: number;
  towingServiceName: string;
  insurerId: number;
  insurerName: string;
  insurer: PartnershipInsurerProfile;
  status: PartnershipStatus;
  relationType: PartnershipRelationType;
  /** Nomor/keterangan perjanjian di luar aplikasi; hanya terisi untuk OWNERSHIP. */
  agreementRef: string;
  /** Sisi yang mengirim undangan: INSURER | TOWING. */
  initiatedBy: string;
  note: string;
  /** true hanya bila PENDING dan mitra ini adalah pihak yang diundang. */
  canRespond: boolean;
  invitedAt: string;
  respondedAt: string;
  terminatedAt: string;
}

/** Asuransi yang belum punya relasi PENDING/ACTIVE dengan mitra ini. */
export interface PartnershipCandidate {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function bool(value: unknown): boolean {
  return Boolean(value);
}

function statusOf(value: unknown): PartnershipStatus {
  const status = str(value);
  return status === 'ACTIVE' || status === 'REJECTED' || status === 'TERMINATED'
    ? status
    : 'PENDING';
}

function relationOf(value: unknown): PartnershipRelationType {
  return str(value) === 'OWNERSHIP' ? 'OWNERSHIP' : 'PARTNERSHIP';
}

/** Baris list bisa datang sebagai `items` (spesifikasi) atau `data` (pola lama). */
function rowsOf(payload: unknown): Record<string, unknown>[] {
  const envelope = asRecord(asRecord(payload).data);
  const raw = envelope.items ?? envelope.data ?? envelope;
  return Array.isArray(raw)
    ? raw.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    : [];
}

function parsePartnership(json: Record<string, unknown>): TowingPartnership {
  return {
    id: num(json.id),
    towingServiceId: num(json.towing_service_id),
    towingServiceName: str(json.towing_service_name),
    insurerId: num(json.insurer_id),
    insurerName: str(json.insurer_name),
    insurer: {
      code: str(json.insurer_code),
      address: str(json.insurer_address),
      phone: str(json.insurer_phone),
      email: str(json.insurer_email),
      contactName: str(json.insurer_contact_name),
      contactPosition: str(json.insurer_contact_position),
      contactEmail: str(json.insurer_contact_email),
      contactPhone: str(json.insurer_contact_phone),
    },
    status: statusOf(json.status),
    relationType: relationOf(json.relation_type),
    agreementRef: str(json.agreement_ref),
    initiatedBy: str(json.initiated_by),
    note: str(json.note),
    canRespond: bool(json.can_respond),
    invitedAt: str(json.invited_at),
    respondedAt: str(json.responded_at),
    terminatedAt: str(json.terminated_at),
  };
}

function parseCandidate(json: Record<string, unknown>): PartnershipCandidate {
  return {
    id: num(json.id),
    name: str(json.name),
    code: str(json.code),
    address: str(json.address),
    phone: str(json.phone),
  };
}

export async function getTowingPartnerships(status?: string): Promise<TowingPartnership[]> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/towing-partnerships', {
    params: { page: 1, limit: 100, status: status || undefined },
  });
  return rowsOf(res.data).map(parsePartnership);
}

/**
 * Jumlah undangan kemitraan yang menunggu jawaban mitra ini. Undangan yang mitra
 * kirim sendiri tidak dihitung — yang perlu ditandai hanya yang butuh tindakan.
 */
export async function getPendingPartnershipCount(): Promise<number> {
  const res = await mitraApi.get<{ data?: { count?: number } }>(
    '/v1/admin/towing-partnerships/pending-count',
  );
  return num(res.data?.data?.count);
}

export async function getPartnershipCandidates(q?: string): Promise<PartnershipCandidate[]> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/towing-partnerships/candidates', {
    params: { q: q || undefined },
  });
  return rowsOf(res.data).map(parseCandidate);
}

/**
 * Relasi yang akan otomatis berakhir bila undangan OWNERSHIP ini disetujui.
 * Dipakai layar konfirmasi supaya mitra tahu persis apa yang ia lepas — bukan
 * sekadar jumlahnya. Hanya berlaku untuk baris OWNERSHIP milik mitra ini.
 */
export async function getOwnershipImpact(id: number): Promise<OwnershipImpact[]> {
  const res = await mitraApi.get<{ data?: unknown }>(
    '/v1/admin/towing-partnerships/ownership-impact',
    { params: { id } },
  );
  return rowsOf(res.data).map((json) => ({
    insurerName: str(json.insurer_name),
    relationType: relationOf(json.relation_type),
    status: statusOf(json.status),
  }));
}

export async function invitePartnership(insurerId: number): Promise<void> {
  await mitraApi.post('/v1/admin/towing-partnerships/invite', { insurer_id: insurerId });
}

export async function respondPartnership(
  id: number,
  action: 'ACCEPT' | 'REJECT',
  note = '',
): Promise<void> {
  await mitraApi.post('/v1/admin/towing-partnerships/respond', { id, action, note });
}

export async function terminatePartnership(id: number, note = ''): Promise<void> {
  await mitraApi.post('/v1/admin/towing-partnerships/terminate', { id, note });
}

export function partnershipStatusLabel(status: PartnershipStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Aktif';
    case 'REJECTED':
      return 'Ditolak';
    case 'TERMINATED':
      return 'Berakhir';
    default:
      return 'Menunggu';
  }
}

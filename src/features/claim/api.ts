import axios from 'axios';
import { userApi } from '@/lib/api/client';
import { uploadDocument } from '@/lib/upload/publicUpload';
import { recognizeChassisNumber, recognizeEngineNumber } from '@/lib/ocr/vehicleIdentity';

const str = (v: unknown, f = ''): string => (typeof v === 'string' ? v : f);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const nullableNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export interface Claim {
  id: number;
  policyNumber: string;
  inferenceTicket: string;
  claimNumber: string;
  claimType: string;
  vehiclePlate: string;
  vehicleEngineNumber: string;
  vehicleEngineNumberImageUrl: string;
  vehicleChassisNumber: string;
  vehicleChassisNumberImageUrl: string;
  description: string;
  incidentDate?: string;
  status: string;
  autoApprovalEvaluated: boolean;
  autoApprovalDecision: string;
  damagePercentage: number | null;
  maxSideDamagePercentage: number | null;
  estimatedRepairCost: number | null;
  incidentLocation: string;
  chronologyAudioUrl: string;
  transcriptionSource: string;
  settlementMethod: string;
  settlementPass: ClaimSettlementPass;
  documents: ClaimDocument[];
  createdAt?: string;
}

export type ClaimDocumentType = 'KTP' | 'SIM' | 'STNK';

export interface ClaimSettlementPass {
  claimNumber: string;
  repairCovered: boolean;
  towingCovered: boolean;
  coverageType: string;
  customerPayable: number;
}

export interface ClaimDocument {
  id?: number;
  documentType: ClaimDocumentType;
  fileUrl: string;
  createdAt?: string;
}

function parseClaim(json: Record<string, unknown>): Claim {
  const settlementPass = json.settlement_pass;
  const settlement =
    settlementPass && typeof settlementPass === 'object'
      ? (settlementPass as Record<string, unknown>)
      : {};
  return {
    id: num(json.id),
    policyNumber: str(json.policy_number),
    inferenceTicket: str(json.inference_ticket),
    claimNumber: str(json.claim_number),
    claimType: str(json.claim_type),
    vehiclePlate: str(json.vehicle_plate),
    vehicleEngineNumber: str(json.vehicle_engine_number),
    vehicleEngineNumberImageUrl: str(json.vehicle_engine_number_image_url),
    vehicleChassisNumber: str(json.vehicle_chassis_number),
    vehicleChassisNumberImageUrl: str(json.vehicle_chassis_number_image_url),
    description: str(json.description),
    incidentDate: str(json.incident_date) || undefined,
    status: str(json.status, 'PENDING_REVIEW'),
    autoApprovalEvaluated: Boolean(json.auto_approval_evaluated),
    autoApprovalDecision: str(json.auto_approval_decision, 'NOT_EVALUATED'),
    damagePercentage: nullableNum(json.damage_percentage),
    maxSideDamagePercentage: nullableNum(json.max_side_damage_percentage),
    estimatedRepairCost: nullableNum(json.estimated_repair_cost),
    incidentLocation: str(json.incident_location),
    chronologyAudioUrl: str(json.chronology_audio_url),
    transcriptionSource: str(json.transcription_source),
    settlementMethod: str(json.settlement_method, 'WORKSHOP_DIRECT'),
    settlementPass: {
      claimNumber: str(settlement.claim_number, str(json.claim_number)),
      repairCovered: Boolean(settlement.repair_covered),
      towingCovered: Boolean(settlement.towing_covered),
      coverageType: str(settlement.coverage_type, str(json.coverage_type)),
      customerPayable: num(settlement.customer_payable),
    },
    documents: Array.isArray(json.documents)
      ? json.documents
          .filter((value): value is Record<string, unknown> =>
            Boolean(value && typeof value === 'object'),
          )
          .map((value) => ({
            id: num(value.id),
            documentType: str(value.document_type) as ClaimDocumentType,
            fileUrl: str(value.file_url),
            createdAt: str(value.created_at) || undefined,
          }))
      : [],
    createdAt: str(json.created_at) || undefined,
  };
}

export async function getClaims(): Promise<Claim[]> {
  const res = await userApi.get<{ data?: { claims?: unknown[] } | unknown[] }>('/v1/member/claims');
  const data = res.data?.data;
  const list = Array.isArray(data) ? data : (data?.claims ?? []);
  return list
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(parseClaim);
}

export interface CreateClaimInput {
  policyNumber: string;
  inferenceTicket: string;
  claimType: string;
  vehiclePlate: string;
  vehicleEngineNumber: string;
  vehicleEngineNumberImageUrl: string;
  vehicleChassisNumber: string;
  vehicleChassisNumberImageUrl: string;
  description: string;
  incidentDate: string;
  incidentLocation: string;
  chronologyAudioUrl: string;
  transcriptionSource: 'SERVER_ASR' | 'BROWSER_ASR';
  documents: ClaimDocument[];
}

export async function createClaim(input: CreateClaimInput): Promise<Claim> {
  const res = await userApi.post<{ data?: Record<string, unknown> }>('/v1/member/claims', {
    policy_number: input.policyNumber,
    inference_ticket: input.inferenceTicket,
    claim_type: input.claimType,
    vehicle_plate: input.vehiclePlate,
    vehicle_engine_number: input.vehicleEngineNumber,
    vehicle_engine_number_image_url: input.vehicleEngineNumberImageUrl,
    vehicle_chassis_number: input.vehicleChassisNumber,
    vehicle_chassis_number_image_url: input.vehicleChassisNumberImageUrl,
    description: input.description,
    incident_date: input.incidentDate,
    incident_location: input.incidentLocation,
    chronology_audio_url: input.chronologyAudioUrl,
    transcription_source: input.transcriptionSource,
    documents: input.documents.map((document) => ({
      document_type: document.documentType,
      file_url: document.fileUrl,
    })),
  });
  return parseClaim(res.data?.data ?? {});
}

// OCR-nya dipakai bersama alur pembelian polis, jadi implementasinya tinggal di
// `lib/ocr/vehicleIdentity`. Dua pembungkus di bawah hanya menjaga bentuk
// hasil yang sudah dipakai halaman klaim.
export async function recognizeClaimEngineNumber(
  file: Blob,
  filename: string,
): Promise<{ engineNumber: string; confidence: number; rawText: string }> {
  const result = await recognizeEngineNumber(file, filename);
  return { engineNumber: result.value, confidence: result.confidence, rawText: result.rawText };
}

export async function recognizeClaimChassisNumber(
  file: Blob,
  filename: string,
): Promise<{ chassisNumber: string; confidence: number; rawText: string }> {
  const result = await recognizeChassisNumber(file, filename);
  return { chassisNumber: result.value, confidence: result.confidence, rawText: result.rawText };
}

export async function uploadClaimEvidence(
  file: Blob,
  category: string,
  filename: string,
): Promise<string> {
  return uploadDocument(file, category, filename);
}

export async function transcribeClaimAudio(
  audio: Blob,
  filename: string,
): Promise<{ text: string; source: 'SERVER_ASR' }> {
  const form = new FormData();
  form.append('audio', audio, filename);
  const res = await userApi.post<{ data?: { text?: string; source?: string } }>(
    '/v1/member/claims/transcribe',
    form,
  );
  return {
    text: str(res.data?.data?.text),
    source: 'SERVER_ASR',
  };
}

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Klaim Diajukan',
  IN_REVIEW: 'Sedang Ditinjau',
  PENDING_REVIEW: 'Menunggu Tinjauan',
  UNDER_REVIEW: 'Sedang Ditinjau',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export function claimStatusLabel(status: string): string {
  return CLAIM_STATUS_LABEL[status] ?? status;
}

/**
 * Batalkan klaim milik user saat masih ditinjau (user memilih perbaiki sendiri).
 * Backend hanya mengizinkan bila status masih SUBMITTED/IN_REVIEW.
 */
export async function cancelClaim(claimNumber: string): Promise<void> {
  await userApi.post(`/v1/member/claims/${encodeURIComponent(claimNumber)}/cancel`);
}

/**
 * Daftarkan bengkel tujuan perbaikan untuk klaim yang SUDAH disetujui. Di titik
 * inilah izin perbaikan terbit di tiket klaim — sebelum ini bengkel tidak bisa
 * memindai apa pun. Backend menolak bila klaimnya belum disetujui (409).
 */
export type ClaimRepairJobStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

/** Pekerjaan perbaikan milik user — sumber status "tiket sudah dipakai/belum". */
export interface ClaimRepairJob {
  jobCode: string;
  claimNumber: string;
  repairStationId: number;
  repairStationName: string;
  estimatedCost: number;
  insuranceCoverage: number;
  userPayable: number;
  status: ClaimRepairJobStatus;
  scannedAt: string;
  completedAt: string;
}

function parseRepairJob(json: Record<string, unknown>): ClaimRepairJob {
  const status = str(json.status);
  return {
    jobCode: str(json.job_code),
    claimNumber: str(json.claim_number),
    repairStationId: num(json.repair_station_id),
    repairStationName: str(json.repair_station_name),
    estimatedCost: num(json.estimated_cost),
    insuranceCoverage: num(json.insurance_coverage),
    userPayable: num(json.user_payable),
    status:
      status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'CANCELED'
        ? status
        : 'QUEUED',
    scannedAt: str(json.scanned_at),
    completedAt: str(json.completed_at),
  };
}

/**
 * Pekerjaan perbaikan untuk satu klaim. Mengembalikan null bila user belum
 * mendaftarkan bengkel tujuan (backend membalas 404) — tiket tetap tampil,
 * hanya belum bisa dipindai bengkel mana pun.
 */
export async function getClaimRepairJob(claimNumber: string): Promise<ClaimRepairJob | null> {
  const number = claimNumber.trim();
  if (!number) return null;
  try {
    const res = await userApi.get<{ data?: Record<string, unknown> }>(
      `/v1/member/claims/${encodeURIComponent(number)}/repair-job`,
    );
    return parseRepairJob(res.data?.data ?? {});
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Tiket hangus setelah dipindai bengkel: pemindaian mengubah status pekerjaan
 * menjadi IN_PROGRESS dan mengisi `scanned_at`.
 */
export function isClaimTicketUsed(job: ClaimRepairJob | null): boolean {
  if (!job) return false;
  return Boolean(job.scannedAt) || job.status === 'IN_PROGRESS' || job.status === 'COMPLETED';
}

export async function createRepairJob(
  claimNumber: string,
  repairStationId: number,
  notes = '',
): Promise<{ jobCode: string; userPayable: number; covered: boolean }> {
  // Nomor klaim ikut di path; bila kosong backend membalas 400 "claim_number
  // wajib diisi" yang tidak berarti apa-apa buat user. Hentikan lebih awal.
  const number = claimNumber.trim();
  if (!number) throw new Error('Nomor klaim tidak ditemukan. Buka bengkel ini dari klaim Anda.');
  const res = await userApi.post<{ data?: Record<string, unknown> }>(
    `/v1/member/claims/${encodeURIComponent(number)}/repair-job`,
    { repair_station_id: repairStationId, notes },
  );
  const data = res.data?.data ?? {};
  return {
    jobCode: typeof data.job_code === 'string' ? data.job_code : '',
    userPayable: typeof data.user_payable === 'number' ? data.user_payable : 0,
    // insurer_id hanya terisi bila bengkelnya rekanan asuransi penanggung —
    // backend sengaja mengosongkannya untuk bengkel di luar rekanan supaya
    // tagihannya tidak pernah masuk ke pencairan asuransi.
    covered: typeof data.insurer_id === 'number' && data.insurer_id > 0,
  };
}

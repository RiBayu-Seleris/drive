import { env } from '@/config/env';
import { userApi } from '@/lib/api/client';
import { STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import { uploadFilePublic } from '@/lib/upload/publicUpload';
import { normalizePlate as normalizeVehiclePlate } from '@/features/vehicle-scan/utils/plate';
import { makeMockDamageResult } from '../mockData';
import type {
  DamageResult,
  DamageSide,
  DamageSubmission,
  EstimationItem,
  DamageItem,
} from '../types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SIDES: DamageSide[] = ['front', 'back', 'left', 'right'];

function averageDamagedSides(values: Record<DamageSide, number>): number {
  const damaged = SIDES.map((side) => values[side]).filter((value) => value > 0);
  if (damaged.length === 0) return 0;
  const total = damaged.reduce((sum, value) => sum + value, 0);
  return Math.round((total / damaged.length) * 10) / 10;
}

/** Akses sub-objek dengan aman (kembalikan {} bila bukan objek). */
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function normalizePlateValue(value: string | null | undefined): string {
  return normalizeVehiclePlate(value ?? '');
}

function rememberInferencePlate(ticket: string | undefined, plateNumber: string | null | undefined) {
  const normalizedPlate = normalizePlateValue(plateNumber);
  if (!ticket || !normalizedPlate) return;

  const platesByTicket =
    storage.getJSON<Record<string, string>>(STORAGE_KEYS.inferencePlateMap) ?? {};
  platesByTicket[ticket] = normalizedPlate;
  storage.setJSON(STORAGE_KEYS.inferencePlateMap, platesByTicket);
}

export function getRememberedInferencePlate(ticket: string | undefined): string | null {
  if (!ticket) return null;
  const platesByTicket =
    storage.getJSON<Record<string, string>>(STORAGE_KEYS.inferencePlateMap) ?? {};
  return normalizePlateValue(platesByTicket[ticket]) || null;
}

function formatIDR(value: number): string {
  return 'Rp ' + Math.max(0, Math.round(value)).toLocaleString('id-ID');
}

function parseCurrencyNumber(raw: string): number | null {
  let value = raw.replace(/[^\d.,-]/g, '');
  if (!value) return null;

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    value = value.slice(0, value.lastIndexOf(decimalSep));
  } else if (lastDot >= 0) {
    const tail = value.slice(lastDot + 1);
    if (tail.length <= 2) value = value.slice(0, lastDot);
  } else if (lastComma >= 0) {
    const tail = value.slice(lastComma + 1);
    if (tail.length <= 2) value = value.slice(0, lastComma);
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits);
}

export function normalizeIDRLabel(value: unknown, fallback = '-'): string {
  if (typeof value === 'number') return formatIDR(value);
  const text = asString(value, fallback).trim();
  if (!text || text === fallback) return fallback;

  const numbers = text.match(/\d[\d.,]*/g) ?? [];
  const labels = numbers
    .map(parseCurrencyNumber)
    .filter((n): n is number => n !== null)
    .map(formatIDR);

  if (labels.length > 0) return labels.join(' - ');
  return text.replace(/\b(VND|IDR)\b/gi, 'Rp');
}

function mapEstimationItem(value: unknown): EstimationItem {
  const item = asRecord(value);
  return {
    change_severity: asString(item.change_severity, 'repaired'),
    damage_image: asString(item.damage_image, ''),
    description: asString(item.description, ''),
    part_name: asString(item.part_name, '-'),
    price_estimation: normalizeIDRLabel(item.price_estimation),
  };
}

/**
 * Memetakan response gateway ke DamageResult, mengikuti kontrak Flutter yang
 * sudah produksi (lihat autoclaim-flutter damage_model.dart):
 * - Hasil dibungkus `output_inference` (fallback ke root untuk payload datar).
 * - Kontrak transformer gateway: `inference_damage_result` berisi severity/detail,
 *   `inference_repair_result` berisi estimation/cost. Payload lama/mock kadang
 *   tertukar, jadi ada deteksi-tukar agar tetap aman.
 */
function mapBackendResult(raw: Record<string, unknown>): DamageResult {
  const output = Object.keys(asRecord(raw.output_inference)).length
    ? asRecord(raw.output_inference)
    : raw;

  let damageResult = asRecord(output.inference_damage_result);
  let repairResult = asRecord(output.inference_repair_result);
  if (Object.keys(damageResult).length === 0) {
    damageResult = asRecord(raw.damage_result);
  }
  if (Object.keys(repairResult).length === 0) {
    repairResult = asRecord(raw.repair_result);
  }

  const damageLooksLikeRepair =
    'estimation_detail' in damageResult || 'total_estimation_price' in damageResult;
  const repairLooksLikeDamage =
    'detail' in repairResult ||
    'avg_severity_per_side' in repairResult ||
    'percentage' in repairResult;
  if (damageLooksLikeRepair && repairLooksLikeDamage) {
    [damageResult, repairResult] = [repairResult, damageResult];
  }

  // Severity & detail per sisi ada di damageResult.
  const avgRaw = asRecord(damageResult.avg_severity_per_side) as Record<string, number>;
  const detailRaw = asRecord(damageResult.detail) as Record<string, DamageItem[]>;
  const avgSeverityPerSide = SIDES.reduce(
    (acc, side) => ({ ...acc, [side]: Number(avgRaw[side] ?? 0) }),
    {} as Record<DamageSide, number>,
  );
  const derivedPercentage = averageDamagedSides(avgSeverityPerSide);
  const rawPercentage = typeof damageResult.percentage === 'number' ? damageResult.percentage : 0;
  const detail = SIDES.reduce(
    (acc, side) => ({ ...acc, [side]: detailRaw[side] ?? [] }),
    {} as Record<DamageSide, DamageItem[]>,
  );

  // Estimasi biaya ada di repairResult.
  const estimationItems = Array.isArray(repairResult.estimation_detail)
    ? repairResult.estimation_detail.map(mapEstimationItem)
    : [];

  const ticket =
    asString(raw.inference_ticket, '') ||
    asString(raw.ticket, '') ||
    asString(output.ticket, '') ||
    asString(damageResult.ticket, '');
  const plateNumber =
    normalizePlateValue(
      asString(raw.vehicle_plate, '') ||
        asString(raw.vehiclePlate, '') ||
        asString(output.vehicle_plate, '') ||
        asString(output.vehiclePlate, '') ||
        asString(damageResult.vehicle_plate, ''),
    ) ||
    getRememberedInferencePlate(ticket) ||
    '';
  const reportUnlocked =
    output.inference_payment === true ||
    raw.inference_payment === true ||
    damageResult.inference_payment === true;

  return {
    repair: {
      avgSeverityPerSide,
      detail,
      percentage: derivedPercentage || rawPercentage,
      severity: asString(damageResult.severity, '-'),
    },
    estimation: {
      items: estimationItems,
      totalPrice: normalizeIDRLabel(repairResult.total_estimation_price),
    },
    createdAt: asString(output.created_at ?? raw.created_at, new Date().toISOString()),
    ticket: ticket || undefined,
    plateNumber: plateNumber || undefined,
    reportUnlocked,
  };
}

/** Peta id sisi webapp -> field gambar pada kontrak inference gateway. */
const SIDE_TO_FIELD: Record<string, 'front_image' | 'back_image' | 'right_image' | 'left_image'> = {
  front: 'front_image',
  rear: 'back_image',
  right: 'right_image',
  left: 'left_image',
};

/** Hasil 0% (tidak ada kerusakan yang difoto). UI memakainya untuk tawaran beli asuransi. */
function zeroDamageResult(): DamageResult {
  const zeros = SIDES.reduce(
    (acc, side) => ({ ...acc, [side]: 0 }),
    {} as Record<DamageSide, number>,
  );
  const empty = SIDES.reduce(
    (acc, side) => ({ ...acc, [side]: [] }),
    {} as Record<DamageSide, DamageItem[]>,
  );
  return {
    repair: { avgSeverityPerSide: zeros, detail: empty, percentage: 0, severity: '-' },
    estimation: { items: [], totalPrice: '-' },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Jalankan analisis kerusakan dari hasil scan.
 * - Tanpa foto kerusakan: kembalikan hasil 0% (memicu tawaran beli asuransi).
 * - Mode mock: kembalikan data contoh acak (alur tetap jalan tanpa backend).
 * - Mode backend: unggah foto (publik, tanpa login) lalu panggil endpoint
 *   inference no-auth `/v1/ai-noauth/damage/create` sehingga hasil dasar
 *   (persentase) bisa didapat sebelum login. Detail penuh tetap dikunci di UI
 *   sampai login + bayar AI_REPORT (lihat DamageAnalysisPage).
 */
export async function analyzeDamage(submission: DamageSubmission): Promise<DamageResult> {
  // Sisi yang difoto = sisi yang dianalisis (punya foto berarti rusak).
  const photographed = submission.sides.filter((s) => SIDE_TO_FIELD[s.id] && s.image);

  // Tidak ada foto kerusakan → hasil 0% tanpa memanggil backend (assess menolak
  // request tanpa gambar sisi); 0% inilah yang memunculkan tawaran beli asuransi.
  if (photographed.length === 0) {
    await delay(1200);
    return zeroDamageResult();
  }

  if (env.useMockDamageAnalysis) {
    await delay(1600);
    const result = makeMockDamageResult(submission);
    result.plateNumber = normalizePlateValue(submission.plateNumber) || undefined;
    rememberInferencePlate(result.ticket, result.plateNumber);
    return result;
  }

  if (!submission.plateImage) {
    throw new Error('Foto plat diperlukan untuk analisis kerusakan.');
  }

  // Unggah foto plat + tiap sisi yang difoto; backend menerima URL gambar.
  const payload: Record<string, string> = {
    vehicle_plate: submission.plateNumber?.trim().toUpperCase() ?? '',
    plate_image: await uploadFilePublic(submission.plateImage, 'plate.jpg'),
    scan_purpose: submission.purpose ?? 'standard',
  };
  for (const side of photographed) {
    const field = SIDE_TO_FIELD[side.id];
    if (field && side.image) {
      payload[field] = await uploadFilePublic(side.image, `damage_${side.id}.jpg`);
    }
  }

  // User login → endpoint ber-auth agar inferensi terikat ke akunnya (muncul di
  // riwayat). Guest → versi no-auth (user_id=0); alur pra-login tetap jalan.
  const endpoint = storage.getString(STORAGE_KEYS.userToken)
    ? '/v1/inference/damage/rest/create'
    : '/v1/ai-noauth/damage/create';
  const res = await userApi.post<{ data?: Record<string, unknown> }>(endpoint, payload);
  const result = mapBackendResult(asRecord(res.data?.data));
  result.plateNumber = normalizePlateValue(result.plateNumber ?? submission.plateNumber) || undefined;
  rememberInferencePlate(result.ticket, result.plateNumber);
  return result;
}

export async function claimInferenceTicket(ticket: string): Promise<void> {
  await userApi.post('/v1/inference/damage/claim', { inference_ticket: ticket });
}

export async function fetchDamageDetail(ticket: string): Promise<DamageResult> {
  const res = await userApi.get<{ data?: Record<string, unknown> }>('/v1/inference/damage/detail', {
    params: { ticket },
  });
  const result = mapBackendResult(asRecord(res.data?.data));
  result.plateNumber =
    result.plateNumber ?? getRememberedInferencePlate(result.ticket ?? ticket) ?? undefined;
  rememberInferencePlate(result.ticket ?? ticket, result.plateNumber);
  return result;
}

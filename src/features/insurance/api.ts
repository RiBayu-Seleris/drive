import { userApi } from '@/lib/api/client';

const str = (v: unknown, f = ''): string => (typeof v === 'string' ? v : f);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export interface InsuranceProduct {
  id: number;
  code: string;
  name: string;
  provider: string;
  category: string;
  coverage: string;
  coverageType: string;
  monthlyPremium: number;
  annualPremium: number;
  claimLimit: number;
  deductibleAmount: number;
  adminFee: number;
  stampDutyFee: number;
  waitingPeriodDays: number;
  policyWordingUrl: string;
  brochureUrl: string;
  description: string;
  benefits: string[];
  terms: string[];
  /**
   * Kerusakan maksimal (persen) yang masih boleh membeli produk ini.
   * Ditegakkan juga di backend saat pembelian; di aplikasi dipakai untuk
   * menolak lebih awal di layar hasil scan.
   */
  maxPurchaseDamagePct: number;
}

/** Batas dipakai saat produk belum diketahui (mis. sebelum user memilih). */
export const DEFAULT_MAX_PURCHASE_DAMAGE_PCT = 5;

/**
 * Masa berlaku hasil scan untuk pembelian polis. WAJIB sama dengan
 * `PurchaseScanMaxAge` di backend (member_feature_model.go) — kalau berbeda,
 * user bisa melihat sisa waktu di layar tapi tetap ditolak server.
 */
export const PURCHASE_SCAN_VALIDITY_MINUTES = 60;
export const PURCHASE_SCAN_VALIDITY_MS = PURCHASE_SCAN_VALIDITY_MINUTES * 60 * 1000;

export interface InsurancePolicy {
  id: number;
  productCode: string;
  productName: string;
  provider: string;
  policyNumber: string;
  vehiclePlate: string;
  holderName: string;
  holderNik: string;
  holderPhone: string;
  holderEmail: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  coverageType: string;
  status: string;
  premiumAmount: number;
  coverageAmount: number;
  deductibleAmount: number;
  adminFee: number;
  stampDutyFee: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  underwritingStatus: string;
  underwritingNotes: string;
  /** Kapan polis mulai menanggung. Bisa di depan bila produknya bermasa tunggu. */
  startedAt?: string;
  endedAt?: string;
}

export type InsurancePolicyDocumentType = 'KTP' | 'STNK';

export interface InsurancePolicyDocumentInput {
  documentType: InsurancePolicyDocumentType;
  fileUrl: string;
}

function parseProduct(json: Record<string, unknown>): InsuranceProduct {
  return {
    id: num(json.id),
    code: str(json.code),
    name: str(json.name),
    provider: str(json.provider),
    category: str(json.category),
    coverage: str(json.coverage),
    coverageType: str(json.coverage_type),
    monthlyPremium: num(json.monthly_premium),
    annualPremium: num(json.annual_premium),
    claimLimit: num(json.claim_limit),
    deductibleAmount: num(json.deductible_amount),
    adminFee: num(json.admin_fee),
    stampDutyFee: num(json.stamp_duty_fee),
    waitingPeriodDays: num(json.waiting_period_days),
    policyWordingUrl: str(json.policy_wording_url),
    brochureUrl: str(json.brochure_url),
    description: str(json.description),
    maxPurchaseDamagePct:
      typeof json.max_purchase_damage_pct === 'number'
        ? json.max_purchase_damage_pct
        : DEFAULT_MAX_PURCHASE_DAMAGE_PCT,
    benefits: strList(json.benefits),
    terms: strList(json.terms),
  };
}

function parsePolicy(json: Record<string, unknown>): InsurancePolicy {
  return {
    id: num(json.id),
    productCode: str(json.product_code),
    productName: str(json.product_name),
    provider: str(json.provider),
    policyNumber: str(json.policy_number),
    vehiclePlate: str(json.vehicle_plate),
    holderName: str(json.holder_name),
    holderNik: str(json.holder_nik),
    holderPhone: str(json.holder_phone),
    holderEmail: str(json.holder_email),
    vehicleBrand: str(json.vehicle_brand),
    vehicleModel: str(json.vehicle_model),
    vehicleYear: num(json.vehicle_year),
    coverageType: str(json.coverage_type),
    status: str(json.status),
    premiumAmount: num(json.premium_amount),
    coverageAmount: num(json.coverage_amount),
    deductibleAmount: num(json.deductible_amount),
    adminFee: num(json.admin_fee),
    stampDutyFee: num(json.stamp_duty_fee),
    totalAmount: num(json.total_amount),
    paymentMethod: str(json.payment_method),
    paymentStatus: str(json.payment_status),
    underwritingStatus: str(json.underwriting_status),
    underwritingNotes: str(json.underwriting_notes),
    startedAt: str(json.started_at) || undefined,
    endedAt: str(json.ended_at) || undefined,
  };
}

function extractList(data: unknown, key: string): Record<string, unknown>[] {
  const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const inner = root.data;
  const list = Array.isArray(inner)
    ? inner
    : inner && typeof inner === 'object'
      ? (inner as Record<string, unknown>)[key]
      : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null);
}

export async function getInsuranceProducts(): Promise<InsuranceProduct[]> {
  const res = await userApi.get('/v1/member/insurance/products');
  return extractList(res.data, 'products').map(parseProduct);
}

export async function getInsurancePolicies(): Promise<InsurancePolicy[]> {
  const res = await userApi.get('/v1/member/insurance/policies');
  return extractList(res.data, 'policies').map(parsePolicy);
}

export interface PurchaseInput {
  productCode: string;
  vehiclePlate: string;
  holderName: string;
  holderNik: string;
  holderPhone: string;
  holderEmail: string;
  holderAddress: string;
  holderCity: string;
  holderPostalCode: string;
  holderBirthDate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleChassisNumber: string;
  vehicleEngineNumber: string;
  vehicleColor: string;
  vehicleUsage: string;
  registrationArea: string;
  estimatedVehicleValue: number;
  periodMonths: number;
  paymentMethod: string;
  termsAccepted: boolean;
  declarationAccepted: boolean;
  inferenceTicket: string;
  documents: InsurancePolicyDocumentInput[];
  /** Foto bukti nomor rangka & mesin — wajib, dipakai verifikasi underwriting. */
  vehicleChassisNumberImageUrl: string;
  vehicleEngineNumberImageUrl: string;
}

/**
 * Batalkan pesanan polis yang belum dibayar.
 *
 * Hanya untuk pesanan yang preminya belum masuk. Polis yang sudah dibayar tidak
 * bisa dibatalkan lewat sini — pengembalian premi urusan asuransinya.
 */
export async function cancelInsurancePolicyOrder(policyNumber: string): Promise<void> {
  await userApi.post(`/v1/member/insurance/policies/${encodeURIComponent(policyNumber)}/cancel`);
}

export async function purchaseInsurance(input: PurchaseInput): Promise<InsurancePolicy> {
  const res = await userApi.post<{ data?: Record<string, unknown> }>(
    '/v1/member/insurance/purchase',
    {
      product_code: input.productCode,
      vehicle_plate: input.vehiclePlate,
      holder_name: input.holderName,
      holder_nik: input.holderNik,
      holder_phone: input.holderPhone,
      holder_email: input.holderEmail,
      holder_address: input.holderAddress,
      holder_city: input.holderCity,
      holder_postal_code: input.holderPostalCode,
      holder_birth_date: input.holderBirthDate,
      vehicle_brand: input.vehicleBrand,
      vehicle_model: input.vehicleModel,
      vehicle_year: input.vehicleYear,
      vehicle_chassis_number: input.vehicleChassisNumber,
      vehicle_chassis_number_image_url: input.vehicleChassisNumberImageUrl,
      vehicle_engine_number: input.vehicleEngineNumber,
      vehicle_engine_number_image_url: input.vehicleEngineNumberImageUrl,
      vehicle_color: input.vehicleColor,
      vehicle_usage: input.vehicleUsage,
      registration_area: input.registrationArea,
      estimated_vehicle_value: input.estimatedVehicleValue,
      period_months: input.periodMonths,
      payment_method: input.paymentMethod,
      terms_accepted: input.termsAccepted,
      declaration_accepted: input.declarationAccepted,
      inference_ticket: input.inferenceTicket,
      documents: input.documents.map((document) => ({
        document_type: document.documentType,
        file_url: document.fileUrl,
      })),
    },
  );
  return parsePolicy(res.data?.data ?? {});
}

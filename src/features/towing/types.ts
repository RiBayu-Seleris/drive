function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export interface TowingOrder {
  orderCode: string;
  status: string;
  towingType: string;
  inferenceTicket: string;
  claimNumber: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffType: string;
  dropoffAddress: string;
  workshopName: string;
  driverName: string;
  driverPhone: string;
  /** Profil sopir (opsional dari backend; 0 = tidak tersedia). */
  driverRating: number;
  driverTotalTrips: number;
  driverJoinedYears: number;
  driverVerified: boolean;
  fleetPlateNumber: string;
  fleetType: string;
  quotedPrice: number;
  insuranceCoverage: number;
  userPayable: number;
  notes: string;
  requestedAt?: string;
  assignedAt?: string;
  completedAt?: string;
  /** Bukti serah-terima dari sopir: dua sudut serong (depan-kiri & belakang-kanan). */
  dropoffProofPhoto?: string;
  dropoffProofPhotoRear?: string;
  droppedOffAt?: string;
  /** Konfirmasi bengkel bahwa kendaraan diterima; kosong = masih menunggu. */
  vehicleReceivedAt?: string;
}

export function parseTowingOrder(json: Record<string, unknown>): TowingOrder {
  return {
    orderCode: str(json.order_code),
    status: str(json.status, 'REQUESTED'),
    towingType: str(json.towing_type, 'TOWING_ONLY'),
    inferenceTicket: str(json.inference_ticket),
    claimNumber: str(json.claim_number),
    pickupAddress: str(json.pickup_address),
    pickupLatitude: num(json.pickup_latitude),
    pickupLongitude: num(json.pickup_longitude),
    dropoffType: str(json.dropoff_type, 'WORKSHOP'),
    dropoffAddress: str(json.dropoff_address),
    workshopName: str(json.workshop_name),
    driverName: str(json.driver_name),
    driverPhone: str(json.driver_phone),
    driverRating: num(json.driver_rating),
    driverTotalTrips: num(json.driver_total_trips),
    driverJoinedYears: num(json.driver_joined_years),
    driverVerified: json.driver_verified === true,
    fleetPlateNumber: str(json.fleet_plate_number),
    fleetType: str(json.fleet_type),
    quotedPrice: num(json.quoted_price),
    insuranceCoverage: num(json.insurance_coverage),
    userPayable: num(json.user_payable),
    notes: str(json.notes),
    requestedAt: str(json.requested_at) || undefined,
    assignedAt: str(json.assigned_at) || undefined,
    completedAt: str(json.completed_at) || undefined,
    dropoffProofPhoto: str(json.dropoff_proof_photo) || undefined,
    dropoffProofPhotoRear: str(json.dropoff_proof_photo_rear) || undefined,
    droppedOffAt: str(json.dropped_off_at) || undefined,
    vehicleReceivedAt: str(json.vehicle_received_at) || undefined,
  };
}

export interface TowingTracking {
  status: string;
  hasLocation: boolean;
  driverLatitude: number;
  driverLongitude: number;
  lastSeenAt?: string;
  target: string;
  distanceKm: number;
}

export interface SettlementFlag {
  id: number;
  claimNumber: string;
  flagType: string;
  referenceType: string;
  referenceCode: string;
  scannerRole: string;
  status: string;
  settledVia: string;
  scannedBy: number;
  scannedAt?: string;
  settledAt?: string;
  totalAmount: number;
  insuranceAmount: number;
  userPayable: number;
}

export interface ClaimSettlementTicket {
  claimNumber: string;
  flags: SettlementFlag[];
}

export function parseSettlementFlag(json: Record<string, unknown>): SettlementFlag {
  return {
    id: num(json.id),
    claimNumber: str(json.claim_number),
    flagType: str(json.flag_type),
    referenceType: str(json.reference_type),
    referenceCode: str(json.reference_code),
    scannerRole: str(json.scanner_role),
    status: str(json.status, 'PENDING'),
    settledVia: str(json.settled_via),
    scannedBy: num(json.scanned_by),
    scannedAt: str(json.scanned_at) || undefined,
    settledAt: str(json.settled_at) || undefined,
    totalAmount: num(json.total_amount),
    insuranceAmount: num(json.insurance_amount),
    userPayable: num(json.user_payable),
  };
}

export function parseClaimSettlementTicket(json: Record<string, unknown>): ClaimSettlementTicket {
  const flags = Array.isArray(json.flags) ? json.flags : [];
  return {
    claimNumber: str(json.claim_number),
    flags: flags
      .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
      .map(parseSettlementFlag),
  };
}

export function parseTowingTracking(json: Record<string, unknown>): TowingTracking {
  return {
    status: str(json.status),
    hasLocation: json.has_location === true,
    driverLatitude: num(json.driver_latitude),
    driverLongitude: num(json.driver_longitude),
    lastSeenAt: str(json.last_seen_at) || undefined,
    target: str(json.target),
    distanceKm: num(json.distance_km),
  };
}

export const TOWING_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Mencari derek',
  PENDING_ASSIGNMENT: 'Mencari derek',
  OFFERED: 'Menunggu konfirmasi mitra',
  ASSIGNED: 'Sopir ditetapkan',
  ACCEPTED_BY_DRIVER: 'Sopir bersiap berangkat',
  NEEDS_REASSIGN: 'Mencari sopir pengganti',
  EN_ROUTE_TO_PICKUP: 'Sopir menuju lokasi Anda',
  ARRIVED_PICKUP: 'Sopir tiba di lokasi',
  PICKED_UP: 'Kendaraan diangkat',
  EN_ROUTE_TO_DROPOFF: 'Menuju tujuan',
  DROPPED_OFF: 'Tiba di tujuan',
  COMPLETED: 'Selesai',
  CANCELED: 'Dibatalkan',
};

export function towingStatusLabel(status: string): string {
  return TOWING_STATUS_LABEL[status] ?? status;
}

const SEARCHING = new Set(['REQUESTED', 'PENDING_ASSIGNMENT', 'OFFERED']);
const FINISHED = new Set(['COMPLETED', 'CANCELED', 'CANCELLED']);

export const isTowingSearching = (status: string): boolean => SEARCHING.has(status);
export const isTowingFinished = (status: string): boolean => FINISHED.has(status);
/*
 * Sengaja dibalik: order dianggap berjalan selama ia bukan "sedang dicarikan
 * sopir" dan bukan "sudah berakhir" — bukan dari daftar status yang ditulis
 * tangan di sini.
 *
 * Daftar tangan itu pernah menelan order hidup. Backend menambah
 * ACCEPTED_BY_DRIVER dan NEEDS_REASSIGN, daftar ini tidak ikut diperbarui,
 * dan begitu sopir menekan Terima, layar pengguna kehilangan peta, kartu
 * sopir, dan bahkan berhenti memuat ulang — persis seperti ordernya batal.
 * Dengan aturan terbalik, status baru dari backend paling banter tampil
 * dengan label apa adanya, tapi ordernya tetap terlihat dan tetap hidup.
 */
export const isTowingActive = (status: string): boolean =>
  status !== '' && !SEARCHING.has(status) && !FINISHED.has(status);
/** Kendaraan sudah diturunkan di tujuan; dari sisi user, dereknya selesai. */
export const TOWING_ARRIVED = 'DROPPED_OFF';

/*
 * Order yang masih perlu DIIKUTI user: sedang dicarikan sopir, atau sopirnya
 * masih di jalan.
 *
 * Sengaja dibedakan dari `isTowingActive`. Order derek tidak pernah berpindah
 * sendiri ke COMPLETED — status itu baru ditulis saat mitra membuat laporan,
 * pekerjaan administratif yang tidak ada hubungannya dengan user. Kalau bilah
 * "order berjalan" dan notifikasi memakai `isTowingActive`, mobil yang sudah
 * sampai di bengkel tetap tampil seperti derek yang sedang jalan, kadang
 * berhari-hari, sampai mitra sempat mengurus laporannya.
 */
export const isTowingOngoing = (status: string): boolean =>
  isTowingSearching(status) || (isTowingActive(status) && status !== TOWING_ARRIVED);

// Hanya boleh batal selama masih mencari sopir (belum diterima mitra).
// Begitu mitra menerima/menugaskan (ASSIGNED dst), order tidak bisa dibatalkan.
export const isTowingCancelable = (status: string): boolean => SEARCHING.has(status);

/**
 * Kunci penyimpanan lokal. Sesi user, driver, dan mitra dipisah agar tidak
 * saling menimpa (mengikuti pemisahan token di autoclaim-flutter).
 */
export const STORAGE_KEYS = {
  userToken: 'auth_token',
  userRefreshToken: 'auth_refresh_token',
  userInfo: 'auth_user',
  driverToken: 'driver_token',
  driverInfo: 'driver_info',
  onboardingSeen: 'has_seen_onboarding',
  checkupPermissionGranted: 'checkup_permissions_granted',
  pendingPayment: 'pending_payment',
  guestInferenceTicket: 'guest_inference_ticket',
  inferencePlateMap: 'inference_plate_map',
  insuranceCoverageCache: 'insurance_coverage_cache',
  lastScanPlateNumber: 'last_scan_plate_number',
  lastScanPlateSource: 'last_scan_plate_source',
  mitraToken: 'mitra_token',
  mitraInfo: 'mitra_info',
} as const;

export const APP_INFO = {
  name: 'AutoClaim',
  tagline: 'Klaim asuransi kendaraan dalam hitungan menit',
  supportWhatsapp: '6281234567890',
  supportEmail: 'support@autoclaim.id',
} as const;

export const APP_FEATURES = {
  // Mengaktifkan halaman Kendaraan Saya untuk daftar kendaraan dan entry tambah
  // kendaraan sebelum dipakai di home/checkup.
  savedVehicles: true,
} as const;

/** Lebar maksimum kanvas (webapp bergaya mobile) — dipusatkan di layar lebar. */
export const APP_MAX_WIDTH = 480;

/** Lokasi default (Jakarta) bila izin lokasi belum diberikan. */
export const DEFAULT_LOCATION = {
  latitude: -6.2088,
  longitude: 106.8456,
} as const;

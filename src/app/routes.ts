/**
 * Peta rute terpusat. Pola path memakai `:param` (React Router); gunakan
 * builder di bawah untuk menyusun path konkret agar tidak ada string tercecer.
 *
 * Scope: user + driver towing + portal mitra webapp-v2. Login dipisah per
 * target akun agar role tidak lagi dideteksi otomatis dari satu form.
 */
export const ROUTES = {
  // Auth & onboarding
  getStarted: '/get-started',
  login: '/login',
  loginUser: '/login/user',
  loginMitra: '/login/mitra',
  loginSopir: '/login/sopir',
  activate: '/activate',
  register: '/register',
  /** Input kode OTP email; email tujuan dibawa lewat state navigasi. */
  verifyEmail: '/verify-email',
  registerSuccess: '/register-success',
  forgotPassword: '/forgot-password',
  /** Langkah 1: masukkan kode; email dibawa lewat state navigasi. */
  verifyResetCode: '/forgot-password/verify',
  /** Langkah 2: kata sandi baru; email + token dibawa lewat state navigasi. */
  resetPassword: '/forgot-password/new-password',
  mitraRegister: '/register/mitra',
  mitraResubmit: '/register/mitra/resubmit',

  // Tab utama
  home: '/',
  profile: '/profile',

  // Checkup / pemeriksaan kendaraan (alur scanning)
  checkCondition: '/check-condition',
  checkupPermission: '/check-condition/permission',
  emergency: '/check-condition/emergency',
  emergencyHospitals: '/check-condition/emergency/hospitals',
  emergencyTowing: '/check-condition/emergency/towing',
  selectVehicle: '/check-condition/select-vehicle',
  vehicleData: '/check-condition/vehicle-data',
  licensePlate: '/check-condition/license-plate',
  vehicleSides: '/check-condition/vehicle-all-sides',
  previewVehicle: '/check-condition/vehicle-all/preview',
  /** Layar tunggu saat foto dikirim & dianalisis; pindah sendiri saat selesai. */
  analyzing: '/check-condition/analyzing',

  // Hasil kerusakan & biaya
  damageAnalysis: '/damage-analysis',
  detailDamage: '/detail-damage-analysis',
  estimatedCost: '/estimated-repair-costs',

  // Bengkel
  workshopList: '/workshop-recommendations',
  workshopDetail: '/workshop-recommendations/:id',
  workshopRoute: '/workshop-recommendations/:id/route',
  workshopReview: '/workshop-recommendations/review',

  // Pembayaran
  payment: '/payment',
  paymentWaiting: '/payment-waiting',
  paymentSuccess: '/payment-success',

  // Aktivitas & kendaraan
  recentActivity: '/recent-activity',
  myVehicles: '/vehicles',
  vehicleForm: '/vehicles/form',

  // Asuransi & klaim
  insuranceSearch: '/insurance/search',
  insuranceDetail: '/insurance/detail',
  insurancePurchase: '/insurance/purchase',
  insurancePolicies: '/insurance/policies',
  insurancePolicyDetail: '/insurance/policies/:policyNumber',
  claims: '/claims',
  claimInsuranceData: '/claim/insurance-data',
  claimSelectPolicy: '/claim/select-policy',
  claimForm: '/claim/form',
  claimDocuments: '/claim/documents',
  claimDocumentsView: '/claim/documents/view',
  claimDetail: '/claim/detail',
  claimReview: '/claim/review',
  claimStatus: '/claim/status',
  claimTicket: '/claim/ticket',
  claimApproved: '/claim/approved',

  // Towing (sisi user)
  towingOrder: '/towing/order',
  towingStatus: '/towing/:code/status',
  towingTracking: '/towing/:code/tracking',

  // Penilaian
  rating: '/rating',

  // Portal driver towing
  driver: '/driver',

  // Portal mitra (bengkel/towing) — admin mitra, sesi terpisah
  mitra: '/mitra',
  mitraSopir: '/mitra/sopir',
  mitraSopirTambah: '/mitra/sopir/tambah',
  mitraSopirDetail: '/mitra/sopir/:id',
  mitraArmada: '/mitra/armada',
  mitraArmadaTambah: '/mitra/armada/tambah',
  mitraArmadaDetail: '/mitra/armada/:id',
  mitraArmadaEdit: '/mitra/armada/:id/edit',
  mitraKemitraan: '/mitra/kemitraan',
  mitraBengkelKemitraan: '/mitra/bengkel/kemitraan',
  mitraOrder: '/mitra/order',
  mitraOrderTerima: '/mitra/order/diterima',
  mitraOrderTracking: '/mitra/order/tracking',
  mitraPenugasan: '/mitra/penugasan',
  mitraPenugasanKonfirmasi: '/mitra/penugasan/konfirmasi',
  mitraLaporan: '/mitra/laporan',
  mitraLaporanDetail: '/mitra/laporan/:id',
  mitraLaporanBerhasil: '/mitra/laporan/berhasil',
  mitraSaldo: '/mitra/saldo',
  mitraTarikSaldo: '/mitra/tarik-saldo',
  mitraWorkshopJobs: '/mitra/workshop/jobs',
  mitraWorkshopJobDetail: '/mitra/workshop/jobs/:id',
  mitraAkun: '/mitra/akun',
} as const;

export const buildPath = {
  workshopDetail: (id: string) => `/workshop-recommendations/${encodeURIComponent(id)}`,
  workshopRoute: (id: string) => `/workshop-recommendations/${encodeURIComponent(id)}/route`,
  towingStatus: (code: string) => `/towing/${encodeURIComponent(code)}/status`,
  towingTracking: (code: string) => `/towing/${encodeURIComponent(code)}/tracking`,
  /** URL login dengan tujuan redirect setelah berhasil masuk. */
  loginWithRedirect: (redirectTo: string) => `/login?redirect=${encodeURIComponent(redirectTo)}`,
  loginUserWithRedirect: (redirectTo: string) =>
    `/login/user?redirect=${encodeURIComponent(redirectTo)}`,
  loginMitraWithRedirect: (redirectTo: string) =>
    `/login/mitra?redirect=${encodeURIComponent(redirectTo)}`,
  loginSopirWithRedirect: (redirectTo: string) =>
    `/login/sopir?redirect=${encodeURIComponent(redirectTo)}`,
  /** URL register mitra untuk tipe tertentu (insurance, workshop, towing, sparepart). */
  mitraRegister: (partner?: string) =>
    partner ? `/register/mitra?partner=${encodeURIComponent(partner)}` : '/register/mitra',
  mitraSopirDetail: (id: string) => `/mitra/sopir/${encodeURIComponent(id)}`,
  mitraArmadaDetail: (id: string) => `/mitra/armada/${encodeURIComponent(id)}`,
  mitraArmadaEdit: (id: string) => `/mitra/armada/${encodeURIComponent(id)}/edit`,
  mitraLaporanDetail: (id: string) => `/mitra/laporan/${encodeURIComponent(id)}`,
  mitraWorkshopJobDetail: (id: string) => `/mitra/workshop/jobs/${encodeURIComponent(id)}`,
  insurancePolicyDetail: (policyNumber: string) =>
    `/insurance/policies/${encodeURIComponent(policyNumber)}`,
};

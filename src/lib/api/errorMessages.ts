/**
 * Penerjemah pesan error gateway menjadi kalimat yang bisa dipahami user.
 *
 * Sebagian besar pesan gateway sudah berbahasa Indonesia dan siap tampil (mis.
 * "Kode verifikasi salah.", "Akun Anda belum aktif...") — pesan seperti itu
 * diteruskan apa adanya. Yang diterjemahkan hanya sisa pesan teknis berbahasa
 * Inggris yang dulu bocor ke layar, seperti "user already exists" atau
 * "internal server error".
 *
 * Dipakai terpusat di `extractErrorMessage` supaya tidak ada satu pun layar
 * yang lupa menerjemahkan.
 */

/** Pesan teknis yang TIDAK boleh dilihat user — selalu diganti kalimat umum. */
const TECHNICAL_MESSAGES = new Set([
  'internal server error',
  'internal server error 2',
  'internal server error 3',
  'invalid request',
  'validation error',
  'failed to generate token',
  'unauthorized',
  'unauthorized data',
  'forbidden',
  'bad request',
  'not found',
]);

/**
 * Terjemahan pesan yang punya arti khusus bagi user. Kunci dicocokkan
 * huruf-kecil dan tanpa spasi berlebih.
 */
const TRANSLATIONS: Record<string, string> = {
  'user already exists': 'Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.',
  'password is not match': 'Konfirmasi kata sandi tidak cocok.',
  'unsupported account_type or partner_type':
    'Jenis mitra ini belum dibuka. Silakan pilih jenis lain.',
  'email requests is invalid': 'Format email tidak valid.',
  'vehicle not found': 'Kendaraan tidak ditemukan. Tambahkan kendaraan Anda dulu.',
  'policy not found': 'Polis tidak ditemukan.',
  'insurance product not found': 'Produk asuransi tidak ditemukan.',
  'vehicle plate does not match policy':
    'Plat kendaraan tidak sesuai dengan yang tercatat di polis.',
  'inference ticket not found': 'Hasil pemindaian tidak ditemukan. Silakan pindai ulang.',
  'inference result incomplete': 'Hasil pemindaian belum lengkap. Silakan pindai ulang.',
  'inference ticket does not match vehicle':
    'Hasil pemindaian bukan milik kendaraan ini. Silakan pindai ulang.',
  'inference vehicle does not match claim vehicle':
    'Hasil pemindaian bukan milik kendaraan yang diklaim.',
  'invalid inference ticket': 'Hasil pemindaian tidak valid. Silakan pindai ulang.',
  'ktp, sim, and stnk documents are required': 'Dokumen KTP, SIM, dan STNK wajib dilampirkan.',
  'ktp and stnk documents are required': 'Dokumen KTP dan STNK wajib dilampirkan.',
  'terms must be accepted': 'Anda harus menyetujui syarat & ketentuan.',
  'declaration must be accepted': 'Anda harus menyetujui pernyataan yang tertera.',
  'holder_nik must be 16 digits': 'NIK harus 16 digit.',
  'invalid vehicle_usage': 'Penggunaan kendaraan tidak valid.',
  'invalid payment_method': 'Metode pembayaran tidak valid.',
  'invalid incident date': 'Tanggal kejadian tidak valid.',
  'towing order not found': 'Order derek tidak ditemukan.',
  'order code is required': 'Kode order tidak ditemukan.',
  'invalid or expired activation token':
    'Tautan aktivasi sudah tidak berlaku. Silakan minta tautan baru.',
  'activation token is required': 'Tautan aktivasi tidak lengkap.',
  'invalid or expired refresh token': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  'not a refresh token': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  'refresh_token is required': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  'invalid recommendation target': 'Jenis rekomendasi tidak dikenal.',
  'minimum withdrawal is rp 50.000': 'Penarikan minimal Rp 50.000.',
  'insufficient balance': 'Saldo tidak mencukupi.',
  'bank account not found': 'Rekening bank tidak ditemukan.',
  'invalid current password': 'Kata sandi lama salah.',
  'settlement code is required': 'Kode tiket wajib diisi.',
  'settlement flag not found': 'Tiket tidak ditemukan.',
  'settlement flag forbidden': 'Tiket ini bukan milik Anda.',

  // Lapis cadangan: handler sudah menerjemahkan kasus-kasus ini, tapi kalau
  // suatu saat ada jalur yang lupa memetakannya, user tetap dapat kalimat yang
  // bisa dipahami — bukan istilah internal.
  'otp code invalid': 'Kode yang Anda masukkan salah.',
  'otp not found or expired': 'Kode sudah kadaluarsa. Silakan minta kode baru.',
  'otp attempts exhausted': 'Terlalu banyak percobaan. Silakan minta kode baru.',
  'otp rate limit exceeded': 'Terlalu banyak permintaan kode. Coba lagi nanti.',
  'otp resend cooldown active': 'Tunggu sebentar sebelum meminta kode baru.',
  'password reset token invalid or expired':
    'Sesi setel ulang sudah kadaluarsa. Silakan minta kode baru.',
  'user account is not active': 'Akun Anda belum aktif.',
  'user email is not verified': 'Email Anda belum diverifikasi.',
  'invalid admin credentials': 'Periksa kembali email dan kata sandi Anda.',
};

/** Kalimat pengganti saat penyebabnya tidak perlu (atau tidak boleh) diketahui user. */
export const GENERIC_ERROR_MESSAGE = 'Terjadi gangguan. Coba beberapa saat lagi.';

/**
 * Terjemahkan satu pesan dari gateway.
 *
 * Mengembalikan null bila pesannya tidak layak tampil sehingga pemanggil bisa
 * memakai pesan cadangan yang lebih sesuai konteks layarnya.
 */
export function translateApiMessage(raw: string | undefined | null): string | null {
  const message = (raw ?? '').trim();
  if (!message) return null;

  const key = message.toLowerCase();
  if (TECHNICAL_MESSAGES.has(key)) return GENERIC_ERROR_MESSAGE;
  if (TRANSLATIONS[key]) return TRANSLATIONS[key];

  // Penanda teknis diperiksa LEBIH DULU daripada penanda Indonesia. Sebagian
  // pesan internal menyebut istilah domain yang juga ada di daftar Indonesia,
  // mis. "workshop_admin without scope_id cannot access mitra finance" yang
  // mengandung kata "mitra" — dulu pesan itu lolos apa adanya ke layar user.
  if (isTechnical(message)) return GENERIC_ERROR_MESSAGE;

  // Sisanya dipilah berdasarkan bahasa, bukan huruf besar/kecil: gateway punya
  // banyak pesan Indonesia yang huruf kecil semua ("email sudah digunakan") dan
  // itu memang untuk dibaca user. Yang berbahasa Inggris hampir selalu pesan
  // internal ("settlement flag not found") dan tidak boleh bocor ke layar.
  return isIndonesian(message) ? message : GENERIC_ERROR_MESSAGE;
}

/**
 * Deteksi pesan internal lewat kata fungsi Inggris yang praktis tak pernah
 * muncul di kalimat Indonesia.
 *
 * Sengaja TIDAK memakai identifier snake_case sebagai penanda: gateway juga
 * punya pesan Indonesia yang menyebut nama field mentah ("claim_number wajib
 * diisi", "towing_admin tanpa scope_id tidak dapat ..."), dan itu justru perlu
 * sampai ke user.
 */
function isTechnical(message: string): boolean {
  return TECHNICAL_MARKERS.test(message);
}

const TECHNICAL_MARKERS = new RegExp(
  '\\b(' +
    [
      'without',
      'cannot',
      'can',
      'only',
      'must',
      'invalid',
      'failed',
      'missing',
      'required',
      'unauthorized',
      'forbidden',
      'unsupported',
      'internal',
      'unexpected',
      'already',
      'exists',
      'timeout',
      'denied',
      'not found',
      'no rows',
      'not allowed',
    ].join('|') +
    ')\\b',
  'i',
);

/**
 * Deteksi kasar pesan berbahasa Indonesia lewat kata-kata yang sering muncul di
 * pesan gateway — kata tugas (tidak/sudah/wajib) dan istilah domain
 * (polis/klaim/armada). Cukup satu kecocokan.
 */
function isIndonesian(message: string): boolean {
  return INDONESIAN_MARKERS.test(message);
}

const INDONESIAN_MARKERS = new RegExp(
  '\\b(' +
    [
      // kata tugas
      'tidak',
      'sudah',
      'belum',
      'wajib',
      'harus',
      'dapat',
      'bisa',
      'ini',
      'itu',
      'dan',
      'atau',
      'milik',
      'bukan',
      'saat',
      'anda',
      'silakan',
      'kembali',
      'sedang',
      'hanya',
      'masih',
      'sendiri',
      'dulu',
      'lagi',
      'pada',
      'untuk',
      'dengan',
      'dari',
      'yang',
      'ke',
      // bentuk pasif & kata kerja
      'ditemukan',
      'ditolak',
      'diisi',
      'diunggah',
      'dijawab',
      'terkirim',
      'digunakan',
      'dibatalkan',
      'diakhiri',
      'disetujui',
      'dipakai',
      'hubungi',
      'gagal',
      'punya',
      'tercapai',
      'tersedia',
      'menerima',
      'menjadi',
      // istilah domain
      'akun',
      'polis',
      'klaim',
      'bengkel',
      'towing',
      'asuransi',
      'armada',
      'sopir',
      'mitra',
      'kemitraan',
      'undangan',
      'pekerjaan',
      'saldo',
      'penarikan',
      'kendaraan',
      'foto',
      'sandi',
      'kode',
      'alasan',
      'catatan',
      'akses',
      'status',
      'batas',
      'derek',
      'pemindaian',
      'insurer',
    ].join('|') +
    ')\\b',
  'i',
);

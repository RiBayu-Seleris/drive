/**
 * Menerjemahkan kegagalan izin perangkat menjadi kalimat yang bisa ditindaklanjuti.
 *
 * Browser melempar DOMException berbahasa Inggris yang sangat pendek — Chrome
 * Android mengirim "Permission denied" begitu saja. Ditampilkan apa adanya, itu
 * memberi tahu pengguna bahwa ada yang salah tanpa memberi tahu apa pun tentang
 * cara memperbaikinya, dan pada aplikasi yang dipasang ke layar utama justru di
 * situlah pertanyaannya: izinnya diatur di mana?
 */
export type DeviceKind = 'mikrofon' | 'kamera' | 'lokasi';

const SETTINGS_HINT =
  'Buka Pengaturan HP → Aplikasi → DRIVE → Izin, lalu aktifkan izinnya. Kalau DRIVE tidak ada di daftar, buka situsnya lewat Chrome dan atur izin di ikon gembok pada bilah alamat.';

export function deviceErrorMessage(error: unknown, device: DeviceKind): string {
  // DOMException tidak selalu lolos `instanceof Error` di semua mesin browser,
  // jadi namanya dibaca langsung dari objeknya.
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String(error.name)
      : '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return `Izin ${device} ditolak. ${SETTINGS_HINT}`;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return `Tidak ada ${device} yang terdeteksi di perangkat ini.`;
    case 'NotReadableError':
    case 'TrackStartError':
      return `${capitalize(device)} sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.`;
    case 'SecurityError':
      return `${capitalize(device)} hanya bisa dipakai lewat koneksi aman (HTTPS).`;
    default:
      return `${capitalize(device)} tidak bisa diakses. Coba lagi sebentar.`;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

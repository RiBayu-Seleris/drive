import { env } from '@/config/env';

/** Foto bawaan saat user belum pernah mengunggah apa pun. */
export const DEFAULT_AVATAR = '/assets/home/avatar.png';

/**
 * Mengubah `image_name` dari backend menjadi URL yang bisa dipasang di <img>.
 *
 * Backend mengirim nama berkas dalam beberapa bentuk (URL penuh, jalur `/fs/`,
 * atau nama polos), jadi penyeragamannya harus di satu tempat. Sebelumnya
 * fungsi ini tersembunyi di dalam ProfilePage, sehingga halaman lain yang butuh
 * foto user — beranda salah satunya — terpaksa memasang gambar bawaan dan
 * tidak pernah ikut berubah saat user mengganti fotonya.
 */
export function resolveAvatarSrc(imageName?: string): string {
  const value = imageName?.trim();
  if (!value) return DEFAULT_AVATAR;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/fs/')) return `${env.apiBaseUrl}/v1${value}`;
  if (value.startsWith('fs/')) return `${env.apiBaseUrl}/v1/${value}`;
  if (value.startsWith('/')) return value;
  return `${env.apiBaseUrl}/v1/fs/${encodeURIComponent(value)}`;
}

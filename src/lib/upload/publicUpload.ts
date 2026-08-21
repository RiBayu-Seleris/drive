import axios from 'axios';
import { env } from '@/config/env';
import { userApi } from '@/lib/api/client';

/**
 * Unggah satu file ke storage publik Seleris (tanpa autentikasi) dan kembalikan
 * URL hasilnya (`data.path`). Dipakai lintas fitur (analisis kerusakan user &
 * foto kelayakan armada oleh sopir) karena tidak butuh token AutoClaim.
 */
export async function uploadFilePublic(blob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await axios.post<{ data?: { path?: string } }>(env.selerisUploadUrl, form);
  const path = res.data?.data?.path;
  if (typeof path !== 'string' || !path) {
    throw new Error('Gagal mengunggah foto: respons tidak berisi path.');
  }
  return path;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

export async function uploadDocument(
  file: Blob,
  category: string,
  filename: string,
): Promise<string> {
  const publicForm = new FormData();
  publicForm.append('file', file, filename);

  try {
    const res = await axios.post<{ data?: { path?: string } }>(env.selerisUploadUrl, publicForm);
    const path = str(res.data?.data?.path);
    if (path) return path;
  } catch {
    // Fallback ke gateway AutoClaim untuk environment yang memblokir direct upload.
  }

  const gatewayForm = new FormData();
  gatewayForm.append('uploadfile', file, filename);
  gatewayForm.append('category', category);
  const res = await userApi.post<{ data?: { file_path?: string } }>(
    '/v1/s3/image/upload',
    gatewayForm,
  );
  const path = str(res.data?.data?.file_path);
  if (!path) throw new Error('Upload dokumen gagal: respons tidak berisi file path.');
  return path;
}

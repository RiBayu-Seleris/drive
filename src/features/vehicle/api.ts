import { userApi } from '@/lib/api/client';
import {
  parseSavedVehicle,
  toCreatePayload,
  toUpdatePayload,
  type SavedVehicle,
  type VehicleFormInput,
} from './types';

export async function getVehicles(): Promise<SavedVehicle[]> {
  const res = await userApi.get<{ data?: { vehicles?: unknown[] } }>('/v1/vehicle/');
  const list = res.data?.data?.vehicles ?? [];
  return list
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(parseSavedVehicle);
}

export async function createVehicle(input: VehicleFormInput): Promise<SavedVehicle> {
  const res = await userApi.post<{ data?: Record<string, unknown> }>(
    '/v1/vehicle/',
    toCreatePayload(input),
  );
  return res.data?.data
    ? parseSavedVehicle(res.data.data)
    : parseSavedVehicle(toCreatePayload(input));
}

export async function updateVehicle(input: VehicleFormInput): Promise<SavedVehicle> {
  const res = await userApi.put<{ data?: Record<string, unknown> }>(
    `/v1/vehicle/?plate=${encodeURIComponent(input.vehiclePlate)}`,
    toUpdatePayload(input),
  );
  return res.data?.data
    ? parseSavedVehicle(res.data.data)
    : parseSavedVehicle(toCreatePayload(input));
}

export async function deleteVehicle(plate: string): Promise<void> {
  await userApi.delete(`/v1/vehicle/?plate=${encodeURIComponent(plate)}`);
}

/**
 * Meminta pemilik terdaftar sebuah plat untuk melepasnya.
 *
 * Dipakai saat penambahan kendaraan ditolak karena platnya masih tercatat di
 * akun lain — biasanya pemilik sebelumnya, pada mobil yang sudah berpindah
 * tangan. Tidak memindahkan apa pun; hanya mengirim pemberitahuan. Yang
 * melepas tetap pemilik lama, lewat tombol "sudah terjual" di aplikasinya.
 */
export async function requestVehicleTransfer(plate: string): Promise<void> {
  await userApi.post('/v1/vehicle/transfer-request', { vehicle_plate: plate });
}

/**
 * Melepas kendaraan dari daftar karena sudah dijual.
 *
 * Terpisah dari `deleteVehicle`: penghapusan biasa ditolak backend kalau
 * kendaraan masih berpolis, padahal justru itu keadaan yang paling sering saat
 * mobil dijual. Endpoint ini juga mengabari orang yang pernah meminta platnya
 * dilepas.
 *
 * `toEmail` = email pembeli. Bila kendaraan ini punya polis berjalan, polisnya
 * ikut ditandai menunggu diambil alih oleh pemilik email tersebut — pembeli
 * tidak perlu sudah punya akun, undangannya dikirim ke sana.
 */
export async function markVehicleSold(plate: string, toEmail = ''): Promise<void> {
  await userApi.post('/v1/vehicle/mark-sold', {
    vehicle_plate: plate,
    to_email: toEmail.trim(),
  });
}

import { Truck, Wrench, ShieldCheck, Cog, type LucideIcon } from 'lucide-react';

export interface PartnerTypeOption {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /**
   * Jenis mitra yang alur bisnisnya belum dirancang. Menunya tetap tampil dan
   * bisa dipilih seperti biasa; yang dicegah hanya melanjutkan ke formulir —
   * backend pun belum menerimanya, jadi kalau dibiarkan lanjut, mitra baru
   * ditolak di langkah terakhir setelah mengisi seluruh formulir dan
   * mengunggah dokumen.
   */
  comingSoon?: boolean;
}

/**
 * Jenis mitra yang bisa mendaftar. "sparepart" adalah tipe BARU (aksesoris &
 * suku cadang) yang belum ada di Flutter/Vue. Login & dashboard mitra ada di
 * backoffice — di webapp ini hanya pendaftarannya.
 */
export const PARTNER_TYPES: PartnerTypeOption[] = [
  {
    value: 'towing_provider',
    label: 'Mitra Towing',
    description: 'Layanan derek / towing kendaraan',
    icon: Truck,
  },
  {
    value: 'workshop',
    label: 'Mitra Bengkel',
    description: 'Bengkel perbaikan kendaraan',
    icon: Wrench,
  },
  {
    value: 'insurance',
    label: 'Mitra Asuransi',
    description: 'Perusahaan asuransi kendaraan',
    icon: ShieldCheck,
  },
  {
    value: 'sparepart',
    label: 'Mitra Aksesoris & Sparepart',
    description: 'Toko aksesoris & suku cadang kendaraan',
    icon: Cog,
    comingSoon: true,
  },
];

export const ALLOWED_PARTNER_TYPES = new Set(PARTNER_TYPES.map((p) => p.value));

/** Jenis mitra yang pendaftarannya belum dibuka (lihat comingSoon). */
export const COMING_SOON_PARTNER_TYPES = new Set(
  PARTNER_TYPES.filter((p) => p.comingSoon).map((p) => p.value),
);

export function isPartnerTypeComingSoon(value: string): boolean {
  return COMING_SOON_PARTNER_TYPES.has(value);
}

export function partnerTypeLabel(value: string): string {
  return PARTNER_TYPES.find((p) => p.value === value)?.label ?? 'Mitra';
}

/** Label izin usaha menyesuaikan jenis mitra. */
export function licenseLabelFor(partnerType: string): string {
  switch (partnerType) {
    case 'workshop':
      return 'SIUP / Izin Usaha Bengkel';
    case 'insurance':
      return 'Izin Usaha / No. Izin OJK';
    default:
      return 'SIUP / Izin Usaha Towing';
  }
}

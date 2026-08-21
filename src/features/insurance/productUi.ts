import {
  CarFront,
  CloudLightning,
  Gavel,
  LifeBuoy,
  Lock,
  ShieldCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { InsuranceProduct } from './api';

/**
 * Label ramah pengguna untuk jenis pertanggungan. Backend menyimpan
 * `coverage_type` sebagai COMPREHENSIVE / TLO; desain menampilkannya sebagai
 * "All Risk" / "TLO".
 */
export function coverageLabel(product: InsuranceProduct): string {
  const raw = (product.coverageType || product.category || '').toUpperCase();
  if (raw.includes('TLO')) return 'TLO';
  if (raw.includes('COMPREHENSIVE') || raw.includes('ALL')) return 'All Risk';
  return product.category || product.coverageType || 'Lainnya';
}

/**
 * Inisial provider untuk tile logo. Produk asuransi belum menyimpan URL logo,
 * jadi tile inisial dipakai sebagai pengganti agar tata letak kartu tetap
 * sesuai desain.
 */
export function providerInitials(provider: string): string {
  const words = provider.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '–';
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** Kapan polis mulai berlaku, berdasarkan masa tunggu produk. */
export function activationLabel(product: InsuranceProduct): string {
  if (product.waitingPeriodDays > 0) return `${product.waitingPeriodDays} Hari`;
  return 'Instan';
}

/** Kalimat pendukung di bawah tombol beli, senada dengan `activationLabel`. */
export function activationNote(product: InsuranceProduct): string {
  if (product.waitingPeriodDays > 0) {
    return `Aktif ${product.waitingPeriodDays} hari setelah pembayaran`;
  }
  return 'Aktif seketika setelah pembayaran';
}

/** Premi tahunan; jatuh kembali ke 12x premi bulanan bila produk tak mengisinya. */
export function annualPremiumOf(product: InsuranceProduct): number {
  return product.annualPremium > 0 ? product.annualPremium : product.monthlyPremium * 12;
}

const BENEFIT_ICONS: ReadonlyArray<{ pattern: RegExp; icon: LucideIcon }> = [
  { pattern: /tabrak|tubrukan|kecelakaan|benturan/i, icon: CarFront },
  { pattern: /curi|pencurian|hilang|kehilangan|rampas/i, icon: Lock },
  { pattern: /banjir|bencana|gempa|badai|kerusuhan|huru-hara|huru hara/i, icon: CloudLightning },
  { pattern: /hukum|pihak ketiga|ke-3|tjh/i, icon: Gavel },
  { pattern: /derek|towing/i, icon: Truck },
  { pattern: /bengkel|servis|perbaikan|spare ?part/i, icon: Wrench },
  { pattern: /darurat|ambulans|bantuan|assistance/i, icon: LifeBuoy },
];

/** Ikon yang mewakili sebuah manfaat. Manfaat dari API hanya berupa teks bebas. */
export function benefitIcon(benefit: string): LucideIcon {
  return BENEFIT_ICONS.find((entry) => entry.pattern.test(benefit))?.icon ?? ShieldCheck;
}

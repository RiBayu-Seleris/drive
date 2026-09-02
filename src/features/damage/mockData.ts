import type { DamageItem, DamageResult, DamageSide } from './types';

const SAMPLE_IMAGE =
  'https://seleris.s3.ap-southeast-1.amazonaws.com/autoclaim-image/Fqf7cK1oLV7CsEv.jpeg';

const MINOR_DESC =
  'Kerusakan kecil pada mobil. Biasanya berupa goresan dangkal, penyok kecil, cat terkelupas, atau retak ringan pada komponen luar kendaraan. Umumnya tidak memengaruhi fungsi kendaraan dan mobil tetap aman dikendarai. Perbaikan bisa dilakukan dengan polishing, repaint sebagian, atau perbaikan panel ringan.';

const SIDES: DamageSide[] = ['front', 'back', 'left', 'right'];

/** Peta id sisi webapp (pakai `rear`) -> kunci DamageSide (pakai `back`). */
const WEBAPP_TO_SIDE: Record<string, DamageSide> = {
  front: 'front',
  rear: 'back',
  left: 'left',
  right: 'right',
};

/** Angka acak 2 desimal pada rentang [min, max]. */
function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function severityLabel(score: number): string {
  if (score <= 25) return 'MINOR';
  if (score <= 50) return 'MODERATE';
  if (score <= 75) return 'MAJOR';
  return 'SEVERE';
}

function averageDamagedSides(values: Record<DamageSide, number>): number {
  const damaged = SIDES.map((side) => values[side]).filter((value) => value > 0);
  if (damaged.length === 0) return 0;
  const total = damaged.reduce((sum, value) => sum + value, 0);
  return Math.round((total / damaged.length) * 10) / 10;
}

function mockDetailItems(position: DamageSide, count: number): DamageItem[] {
  return Array.from({ length: count }, () => {
    const score = rand(8, 65);
    return {
      damage_image: SAMPLE_IMAGE,
      description: MINOR_DESC,
      position,
      severity: severityLabel(score),
      severity_score: score,
    };
  });
}

/** Item estimasi contoh (di balik paywall) — dibiarkan tetap, bukan fokus. */
const ESTIMATION_ITEMS = [
  {
    change_severity: 'replaced',
    damage_image: SAMPLE_IMAGE,
    description:
      'Penyok atau deformasi pada kap mesin kendaraan. Sering terjadi akibat tabrakan frontal, benda jatuh, atau tekanan berlebih pada panel.',
    part_name: 'Hood',
    price_estimation: 'Rp 2.804.500 - Rp 8.579.530',
  },
  {
    change_severity: 'replaced',
    damage_image: SAMPLE_IMAGE,
    description:
      'Retakan, pecah, atau chip pada kaca depan kendaraan. Sering disebabkan kerikil terpental, perubahan suhu ekstrem, atau benturan langsung.',
    part_name: 'Windshield',
    price_estimation: 'Rp 3.188.000 - Rp 13.035.090',
  },
];

/**
 * Bangun hasil analisis MOCK dengan angka acak namun konsisten:
 * - Sisi yang rusak mengikuti input user (bila `submission` ada), kalau tidak acak.
 * - Tiap sisi rusak diberi severity acak + 1-3 detail; sisi aman = 0/kosong.
 * - `percentage` total = rata-rata sisi yang rusak, jadi gauge nyambung
 *   dengan kartu per-sisi dan sisi 0% tidak menurunkan skor utama.
 */
export function makeMockDamageResult(submission?: {
  sides: Array<{ id: string; damaged: boolean | null }>;
}): DamageResult {
  const damaged = new Set<DamageSide>();
  if (submission) {
    for (const s of submission.sides) {
      const side = WEBAPP_TO_SIDE[s.id];
      if (side && s.damaged) damaged.add(side);
    }
  } else {
    for (const side of SIDES) if (Math.random() < 0.5) damaged.add(side);
  }
  if (damaged.size === 0) damaged.add('front'); // jamin ada hasil untuk demo

  const avgSeverityPerSide = SIDES.reduce(
    (acc, side) => ({ ...acc, [side]: damaged.has(side) ? rand(10, 90) : 0 }),
    {} as Record<DamageSide, number>,
  );
  const detail = SIDES.reduce(
    (acc, side) => ({
      ...acc,
      [side]: damaged.has(side) ? mockDetailItems(side, 1 + Math.floor(Math.random() * 3)) : [],
    }),
    {} as Record<DamageSide, DamageItem[]>,
  );

  const percentage = averageDamagedSides(avgSeverityPerSide);

  return {
    repair: {
      avgSeverityPerSide,
      detail,
      percentage,
      severity: severityLabel(percentage),
      // Data contoh selalu "sudah terbuka", jadi ringkasannya dihitung langsung
      // dari rinciannya — sama seperti hasil sungguhan yang laporannya dibayar.
      damagePointCount: Object.values(detail).reduce((sum, items) => sum + items.length, 0),
      affectedSides: Object.values(avgSeverityPerSide).filter((v) => v > 0).length,
    },
    estimation: {
      items: ESTIMATION_ITEMS,
      totalPrice: 'Rp 5.992.500 - Rp 21.614.620',
    },
    createdAt: new Date().toISOString(),
    ticket: `MOCK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  };
}

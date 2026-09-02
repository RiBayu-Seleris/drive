import type { DamageSide } from '../types';

/**
 * Kartu putusan hasil analisis kerusakan.
 *
 * Menggantikan gauge donat di kepala halaman hasil. Gauge itu — apa pun
 * hiasannya — meminjam bahasa ALAT UKUR: jarum pada busur menyiratkan sesuatu
 * yang sedang berjalan dan bisa naik-turun, seperti speedometer. Padahal yang
 * disampaikan layar ini satu kesimpulan yang sudah selesai dihitung.
 *
 * Jadi susunannya dibalik mengikuti cara orang membaca laporan: putusannya dulu
 * (angka besar + sebutannya), baru buktinya (berapa titik, berapa sisi), baru
 * letaknya pada skala. Skalanya MENDATAR dan berpetak — pertanyaannya "seberapa
 * parah dibanding apa?", dan petak bernama menjawabnya jauh lebih langsung
 * daripada busur tanpa patokan.
 */

/** Petak keparahan; batas atas tiap petak sama dengan yang dipakai backend. */
const ZONES = [
  { max: 33, label: 'Ringan', color: 'var(--color-severity-green)' },
  { max: 66, label: 'Sedang', color: 'var(--color-severity-yellow)' },
  { max: 85, label: 'Berat', color: 'var(--color-warning)' },
  { max: 100, label: 'Fatal', color: 'var(--color-severity-red)' },
];

function zoneOf(value: number) {
  return ZONES.find((zone) => value <= zone.max) ?? ZONES[ZONES.length - 1]!;
}

function getSeverityLabel(value: number) {
  if (value <= 0) return 'Tidak Ada Kerusakan';
  if (value <= 33) return 'Kerusakan Ringan';
  if (value <= 66) return 'Kerusakan Sedang';
  if (value <= 85) return 'Kerusakan Berat';
  return 'Sangat Fatal';
}

interface AnalysisVerdictProps {
  /** Nilai 0..100. */
  percentage: number;
  avgSeverityPerSide: Record<DamageSide, number>;
  /** Jumlah titik kerusakan; ikut terkirim walau rinciannya masih terkunci. */
  damagePointCount: number;
  /** Berapa sisi kendaraan yang terdampak. */
  affectedSides: number;
  className?: string;
}

export function AnalysisVerdict({
  percentage,
  avgSeverityPerSide,
  damagePointCount,
  affectedSides,
  className,
}: AnalysisVerdictProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const zone = zoneOf(clamped);
  const color = zone.color;

  /*
   * Bukti pendukung dihitung dari hasil yang benar-benar ada, bukan angka
   * hiasan: jumlah titik kerusakan yang dilaporkan dan berapa sisi yang
   * terdampak. Keduanya bisa ditelusuri user ke daftar di bawah halaman ini.
   */
  /*
   * Nol kerusakan TIDAK menyalakan petak mana pun.
   *
   * `zoneOf(0)` mengembalikan petak "Ringan" karena 0 memang di bawah batas
   * atasnya, dan itu benar untuk memilih warna. Tapi menyorot "Ringan" pada
   * kendaraan yang mulus membantah putusan yang tertulis persis di atasnya —
   * "Tidak Ada Kerusakan".
   */
  const hasDamage = clamped > 0;

  /*
   * Bukti pendukung datang dari server, TIDAK dihitung ulang dari `detail`.
   *
   * Rincian per titik disensor server selama laporannya belum dibayar, jadi
   * menghitungnya dari situ selalu menghasilkan nol — kartu ini akan bilang
   * "0 titik" pada kendaraan yang jelas-jelas penyok, tepat di sebelah angka
   * 73%. Kedua angka ini dihitung server sebelum menyensor.
   */
  const totalSides = Object.keys(avgSeverityPerSide).length;

  return (
    <section className={className}>
      <div className="drive-card relative overflow-hidden rounded-2xl p-5">
        {/* Cahaya sewarna keparahan dari sudut atas — sumber cahaya yang sama
            dengan kartu lain, tapi warnanya ikut putusan. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 88% 0%, color-mix(in srgb, ${color} 16%, transparent), transparent 62%)`,
          }}
        />

        <div className="relative flex items-center justify-between gap-3">
          <span className="drive-eyebrow flex items-center gap-2">
            <span className="relative flex size-1.5">
              <span
                className="absolute inline-flex size-full rounded-full opacity-70"
                style={{ background: color }}
              />
            </span>
            Analisis DRIVE
          </span>
          <span className="hud-readout text-[10px] tracking-[0.14em] text-neutral-500 uppercase">
            {clamped > 0
              ? `${damagePointCount} titik · ${affectedSides}/${totalSides} sisi`
              : 'Bersih'}
          </span>
        </div>

        {/* Putusan: angka besar dulu, sebutannya menyusul. */}
        <div className="relative mt-4 flex items-end gap-3">
          <span className="font-display text-[56px] leading-[0.85] font-bold" style={{ color }}>
            {clamped.toFixed(0)}
            <span className="text-[26px] font-semibold">%</span>
          </span>
          <span className="pb-1">
            <span className="text-15 block leading-tight font-semibold text-neutral-900">
              {getSeverityLabel(clamped)}
            </span>
            <span className="text-11 block text-neutral-600">
              dari seluruh permukaan yang diperiksa
            </span>
          </span>
        </div>

        {/* Skala berpetak: memberi tahu angka itu jatuh di mana. */}
        <div className="relative mt-5">
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {ZONES.map((z, i) => {
              const from = i === 0 ? 0 : (ZONES[i - 1]?.max ?? 0);
              const isCurrent = hasDamage && z.label === zone.label;
              return (
                <span
                  key={z.label}
                  className="block h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${z.max - from}%`,
                    background: z.color,
                    // Petak yang bukan tempat nilainya jatuh diredupkan supaya
                    // pita ini tidak berubah jadi pelangi yang menarik mata
                    // lebih kuat daripada angkanya.
                    opacity: isCurrent ? 0.9 : 0.16,
                  }}
                />
              );
            })}
          </div>

          {/* Penanda posisi nilai pada skala. */}
          <span
            aria-hidden
            className="absolute top-1/2 block h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${clamped}%`,
              background: color,
              boxShadow: `0 0 0 3px var(--color-neutral-100), 0 0 12px 1px color-mix(in srgb, ${color} 60%, transparent)`,
            }}
          />

          <div className="text-10 mt-2 flex text-neutral-500">
            {ZONES.map((z, i) => {
              const from = i === 0 ? 0 : (ZONES[i - 1]?.max ?? 0);
              const isCurrent = hasDamage && z.label === zone.label;
              return (
                <span
                  key={z.label}
                  className="block text-center"
                  style={{
                    width: `${z.max - from}%`,
                    color: isCurrent ? color : undefined,
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {z.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

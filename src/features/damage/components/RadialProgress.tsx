import { useId } from 'react';

interface RadialProgressProps {
  /** Nilai 0..100. */
  value: number;
  label?: string;
  className?: string;
  size?: number;
  thickness?: number;
}

/** Besar bukaan di bagian bawah gauge (derajat). */
const GAP_DEG = 108;
const OUTER_RING_PADDING = 10;
const INNER_RING_SPREAD = 20;
const CENTER_DISC_PADDING = 16;

/*
 * Tiga lapis permukaan gauge.
 *
 * Rancangan aslinya bertumpuk seperti relief: piringan luar, lalu permukaan
 * cincin tempat track duduk, lalu cakram tengah tempat angkanya. Di tema terang
 * ketiganya PUTIH dan yang memisahkan cuma bayangan halus. Saat pindah ke tema
 * gelap, ketiganya diganti #131c24 begitu saja — satu warna untuk tiga lapis
 * yang berbeda, jadi reliefnya hilang dan seluruh bagian ini terbaca sebagai
 * satu gumpalan gelap.
 *
 * Tumpukannya dipertahankan; yang diperbaiki cara memisahkannya. Di latar gelap
 * bayangan hitam tidak terlihat, jadi pemisahnya beda TERANG antar lapis —
 * cincin lebih terang daripada piringan luar, cakram tengah lebih dalam —
 * ditambah garis rambut di tiap tepi.
 */
const SURFACE_RING = '#182430';
const SURFACE_DISC = '#0b1218';
const SURFACE_EDGE = '#223039';

function getSeverityColor(value: number) {
  if (value <= 33) return 'var(--color-severity-green)';
  if (value <= 66) return 'var(--color-severity-yellow)';
  if (value <= 85) return 'var(--color-warning)';
  return 'var(--color-severity-red)';
}

function getSeverityLabel(value: number) {
  if (value <= 0) return 'Tidak Ada Kerusakan';
  if (value <= 33) return 'Kerusakan Ringan';
  if (value <= 66) return 'Kerusakan Sedang';
  if (value <= 85) return 'Kerusakan Berat';
  return 'Sangat Fatal';
}

/**
 * Gauge donat tingkat kerusakan.
 *
 * Track dengan bukaan di bawah, lalu diisi busur gradient yang dipetakan ke
 * skala penuh 0..100: hijau di awal → kuning/oren → merah di akhir. Karena
 * isian hanya disingkap sampai `value`, kerusakan kecil (<10%) hanya
 * menampilkan hijau, sedangkan 100% memunculkan gabungan hijau-kuning-merah.
 *
 * Warna hijau/kuning/merah SENGAJA bukan hijau merek. Ia menyatakan seberapa
 * parah kerusakannya, memakai skala yang sudah dikenal orang dari lampu lalu
 * lintas; menggantinya dengan warna merek akan menghapus artinya.
 *
 * TIDAK ada tik skala di sini. Sempat dicoba dan hasilnya terbaca sebagai
 * speedometer — instrumen yang menunjukkan sesuatu sedang berjalan. Layar ini
 * menyampaikan satu kesimpulan yang sudah selesai dihitung, dan itu disampaikan
 * oleh angka besar di tengah, bukan oleh jarum pada skala.
 */
export function RadialProgress({
  value,
  label,
  className,
  size = 240,
  thickness,
}: RadialProgressProps) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `radial-grad-${uid}`;
  const glowId = `radial-glow-${uid}`;
  const clamped = Math.min(100, Math.max(0, value));
  const displayLabel = label ?? getSeverityLabel(clamped);

  const t = thickness ?? Math.round(size * 0.05);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - t - OUTER_RING_PADDING;
  const innerRingR = r + t / 2 + INNER_RING_SPREAD;
  const discR = r - t / 2 - CENTER_DISC_PADDING;

  // Busur: bukaan di bawah, mulai dari kiri-bawah memutar lewat atas ke kanan-bawah.
  const startDeg = 90 + GAP_DEG / 2; // 144°
  const endDeg = 90 - GAP_DEG / 2 + 360; // 396° (== 36°)
  const toXY = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const [ax, ay] = toXY(startDeg);
  const [bx, by] = toXY(endDeg);
  const arc = `M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${r} ${r} 0 1 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;

  const valueFontSize = Math.round(size * 0.15);
  const labelFontSize = Math.round(size * 0.052);
  const labelGap = Math.round(size * 0.04);
  const valueTextY = displayLabel ? cy - (labelFontSize + labelGap) / 2 : cy;
  const labelTextY = cy + (valueFontSize + labelGap) / 2 - size * 0.02;
  const severityColor = getSeverityColor(clamped);

  return (
    <div
      className={className ?? 'relative'}
      style={className ? undefined : { width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="block size-full overflow-visible"
        aria-label={`${displayLabel || 'Tingkat Kerusakan'}: ${clamped.toFixed(0)}%`}
      >
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={cx - r}
            y1={0}
            x2={cx + r}
            y2={0}
          >
            <stop offset="0%" stopColor="var(--color-severity-green)" />
            <stop offset="16%" stopColor="var(--color-severity-green)" />
            <stop offset="45%" stopColor="var(--color-severity-yellow)" />
            <stop offset="68%" stopColor="var(--color-warning)" />
            <stop offset="90%" stopColor="var(--color-severity-red)" />
            <stop offset="100%" stopColor="var(--color-severity-red)" />
          </linearGradient>
          {/* Pendar tipis di dalam cakram, berwarna sesuai tingkat keparahan —
              cukup untuk memisahkan angka dari cakramnya, tanpa menyala. */}
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={severityColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={severityColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Lapis 2 — permukaan cincin tempat track duduk. */}
        <circle
          cx={cx}
          cy={cy}
          r={innerRingR}
          fill={SURFACE_RING}
          stroke={SURFACE_EDGE}
          strokeWidth="1"
        />

        {/* Track: alur tempat isian berjalan. */}
        <path d={arc} fill="none" stroke="#223039" strokeWidth={t} strokeLinecap="round" />

        {/* Isian sesuai persentase. */}
        {clamped > 0 && (
          <path
            d={arc}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={t}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped} 100`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        )}

        {/* Lapis 3 — cakram tengah, lebih dalam daripada cincinnya. */}
        <circle
          cx={cx}
          cy={cy}
          r={discR}
          fill={SURFACE_DISC}
          stroke={SURFACE_EDGE}
          strokeWidth="1"
        />
        <circle cx={cx} cy={cy} r={discR} fill={`url(#${glowId})`} />

        <text
          x={cx}
          y={valueTextY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={severityColor}
          fontFamily="var(--font-display)"
          fontSize={valueFontSize}
          fontWeight={700}
        >
          {clamped.toFixed(0)}%
        </text>
        {displayLabel && (
          <text
            x={cx}
            y={labelTextY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-neutral-700)"
            fontSize={labelFontSize}
            fontWeight={500}
          >
            {displayLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

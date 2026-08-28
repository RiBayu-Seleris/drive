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
 * Gauge donat tingkat kerusakan (port ProgressLevel.vue).
 *
 * Track abu-abu dengan bukaan di bawah, lalu diisi busur gradient yang dipetakan
 * ke skala penuh 0..100: hijau di awal → kuning/oren → merah di akhir. Karena
 * isian hanya disingkap sampai `value`, kerusakan kecil (<10%) hanya menampilkan
 * hijau, sedangkan 100% memunculkan gabungan hijau-kuning/oren-merah.
 */
export function RadialProgress({
  value,
  label,
  className,
  size = 240,
  thickness,
}: RadialProgressProps) {
  const gradientId = `radial-grad-${useId().replace(/:/g, '')}`;
  const ringShadowId = `radial-ring-shadow-${useId().replace(/:/g, '')}`;
  const discShadowId = `radial-disc-shadow-${useId().replace(/:/g, '')}`;
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
  const valueFontSize = Math.round(size * 0.135);
  const labelFontSize = Math.round(size * 0.05);
  const labelGap = Math.round(size * 0.025);
  const valueTextY = displayLabel ? cy - (labelFontSize + labelGap) / 2 : cy;
  const labelTextY = cy + (valueFontSize + labelGap) / 2;
  const valueTextColor = getSeverityColor(clamped);

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
          <filter
            id={ringShadowId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="15"
              floodColor="#131c24"
              floodOpacity="0.06"
            />
          </filter>
          <filter
            id={discShadowId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="12.5"
              floodColor="#131c24"
              floodOpacity="0.10"
            />
          </filter>
        </defs>

        {/* Cincin dalam — permukaan putih tempat track berada (efek timbul). */}
        <circle cx={cx} cy={cy} r={innerRingR} fill="#131c24" filter={`url(#${ringShadowId})`} />

        {/* Track abu-abu. */}
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

        {/* Cakram tengah putih + teks. */}
        <circle cx={cx} cy={cy} r={discR} fill="#131c24" filter={`url(#${discShadowId})`} />
        <text
          x={cx}
          y={valueTextY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={valueTextColor}
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
            fill="#131c24"
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

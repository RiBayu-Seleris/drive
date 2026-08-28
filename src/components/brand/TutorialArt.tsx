/**
 * Ilustrasi tiga langkah tutorial "Cek Kondisi Kendaraan".
 *
 * Versi pertama memakai siluet mobil rata abu-abu di kanvas 240x180 — bentuknya
 * benar, tapi datar: tidak ada volume, tidak ada cahaya, dan terlalu kecil untuk
 * panel selebar 350px sehingga terlihat kosong di kiri-kanannya.
 *
 * Versi ini digambar di kanvas 320x210 dengan tiga hal yang sebelumnya tidak
 * ada: gradien bodi (memberi volume), cahaya tepi hijau di sisi atas (sumber
 * cahayanya sama dengan seluruh sistem — atas-kiri), dan bayangan di tanah.
 *
 * Tetap SVG inline: warnanya ikut token tema, tidak ada permintaan jaringan,
 * dan tajam di kepadatan layar berapa pun.
 */
import type { ReactNode } from 'react';

const GREEN = '#aded1f';
const GREEN_DEEP = '#83bd04';
const EDGE = '#3d5160';

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#31424f" />
        <stop offset="55%" stopColor="#1d2b35" />
        <stop offset="100%" stopColor="#121b22" />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#16222b" />
        <stop offset="100%" stopColor="#0a1016" />
      </linearGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={GREEN} stopOpacity="0" />
        <stop offset="35%" stopColor={GREEN} stopOpacity="0.9" />
        <stop offset="70%" stopColor={GREEN} stopOpacity="0.55" />
        <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="58%" r="52%">
        <stop offset="0%" stopColor={GREEN} stopOpacity="0.2" />
        <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-shadow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-cone`} x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor={GREEN} stopOpacity="0.28" />
        <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** Bodi mobil tampak samping — dipakai bersama langkah 1 dan 2. */
function Car({ id }: { id: string }) {
  return (
    <g>
      <ellipse cx="162" cy="180" rx="118" ry="14" fill={`url(#${id}-shadow)`} />
      <path
        d="M44 150c0-13 6-19 16-21l32-6 25-22c4-4 9-6 15-6h62c8 0 15 3 20 8l20 20 26 6c10 2 16 8 16 20v4c0 5-4 9-9 9H53c-5 0-9-4-9-9z"
        fill={`url(#${id}-body)`}
        stroke={EDGE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Cahaya tepi: garis tipis di sisi atas, arah cahaya sama dengan kartu */}
      <path
        d="M117 101c4-4 9-6 15-6h62c8 0 15 3 20 8l19 19"
        fill="none"
        stroke={`url(#${id}-rim)`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M104 124l21-19c2-2 5-3 8-3h27v22z"
        fill={`url(#${id}-glass)`}
        stroke={EDGE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M170 102h24c5 0 10 2 13 6l14 16h-51z"
        fill={`url(#${id}-glass)`}
        stroke={EDGE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M44 146h216" stroke={EDGE} strokeWidth="1.4" opacity="0.55" />
      <g>
        <circle cx="104" cy="160" r="21" fill="#0b1218" stroke={EDGE} strokeWidth="2.4" />
        <circle cx="104" cy="160" r="9" fill="#1a2630" stroke={EDGE} strokeWidth="1.6" />
        <circle cx="226" cy="160" r="21" fill="#0b1218" stroke={EDGE} strokeWidth="2.4" />
        <circle cx="226" cy="160" r="9" fill="#1a2630" stroke={EDGE} strokeWidth="1.6" />
      </g>
      {/* Lampu depan menyala tipis */}
      <path d="M256 132h10c4 0 6 3 6 6s-2 6-6 6h-10z" fill={GREEN} opacity="0.85" />
    </g>
  );
}

function Frame({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 210" role="img" aria-label={label} className="h-full w-full">
      <Defs id={id} />
      <ellipse cx="160" cy="120" rx="150" ry="98" fill={`url(#${id}-glow)`} />
      {children}
    </svg>
  );
}

/** Kurung bidik empat sudut. */
function Brackets() {
  return (
    <g fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 52V30a8 8 0 0 1 8-8h22" />
      <path d="M306 52V30a8 8 0 0 0-8-8h-22" />
      <path d="M14 158v22a8 8 0 0 0 8 8h22" />
      <path d="M306 158v22a8 8 0 0 1-8 8h-22" />
    </g>
  );
}

/** Langkah 1 — memotret kendaraan dari beberapa sudut. */
export function TutorialCapture() {
  const id = 'tc';
  return (
    <Frame id={id} label="Memotret kendaraan dari beberapa sudut">
      <Brackets />
      {/* Berkas cahaya dari kamera menuju kendaraan */}
      <path d="M264 176 120 96l-6 22 138 66z" fill={`url(#${id}-cone)`} />
      <Car id={id} />
      {/* Ponsel di latar depan, membingkai kendaraan */}
      <g transform="translate(238 128)">
        <rect
          x="0"
          y="0"
          width="52"
          height="70"
          rx="9"
          fill="#0d151b"
          stroke={GREEN}
          strokeWidth="2.4"
        />
        <rect x="7" y="12" width="38" height="42" rx="4" fill="#111c24" stroke={EDGE} strokeWidth="1.4" />
        <g fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round">
          <path d="M12 22v-4h5M40 22v-4h-5M12 44v4h5M40 44v4h-5" />
        </g>
        <circle cx="26" cy="33" r="6" fill="none" stroke={GREEN_DEEP} strokeWidth="2" />
        <circle cx="26" cy="62" r="3.5" fill={EDGE} />
        <rect x="19" y="5" width="14" height="3" rx="1.5" fill={EDGE} />
      </g>
    </Frame>
  );
}

/** Langkah 2 — kerusakan ditandai beserta tingkat keparahannya. */
export function TutorialAnalyze() {
  const id = 'ta';
  // Kotak deteksi dan keterangannya SENGAJA dipisah: saat label ditempel pada
  // tiap kotak, tiga label sekaligus menabrak atap dan roda, dan bentuk
  // mobilnya hilang di balik teks. Legenda di bawah menyampaikan hal yang sama
  // tanpa menutupi objek yang sedang dianalisis.
  const marks = [
    { x: 54, y: 114, w: 44, h: 26, tone: GREEN },
    { x: 128, y: 104, w: 56, h: 32, tone: '#fbbf24' },
    { x: 212, y: 110, w: 50, h: 30, tone: '#ff6b6b' },
  ];
  const legend = [
    { tone: GREEN, label: 'Ringan' },
    { tone: '#fbbf24', label: 'Sedang' },
    { tone: '#ff6b6b', label: 'Berat' },
  ];
  return (
    <Frame id={id} label="Kerusakan ditandai beserta tingkat keparahannya">
      <Car id={id} />

      {/* Kisi analisis, dibatasi pada bodi saja */}
      <g stroke={GREEN} strokeWidth="0.8" opacity="0.24">
        {[76, 106, 136, 166, 196, 226].map((x) => (
          <path key={x} d={`M${x} 98v46`} />
        ))}
        {[110, 128].map((y) => (
          <path key={y} d={`M52 ${y}h204`} />
        ))}
      </g>

      {marks.map((m) => (
        <g key={m.tone} fill="none" stroke={m.tone} strokeWidth="2.6" strokeLinecap="round">
          <path d={`M${m.x} ${m.y + 10}V${m.y}h10`} />
          <path d={`M${m.x + m.w - 10} ${m.y}h10v10`} />
          <path d={`M${m.x} ${m.y + m.h - 10}v10h10`} />
          <path d={`M${m.x + m.w} ${m.y + m.h - 10}v10h-10`} />
        </g>
      ))}

      {/* Garis pindai melintang */}
      <rect x="36" y="120" width="248" height="2.5" rx="1.25" fill={GREEN} opacity="0.5" />

      {/* Legenda tingkat keparahan */}
      <g transform="translate(56 190)">
        {legend.map((l, i) => (
          <g key={l.label} transform={`translate(${i * 72} 0)`}>
            <rect x="0" y="0" width="10" height="10" rx="3" fill={l.tone} />
            <text
              x="16"
              y="9"
              fontSize="11"
              fontWeight="600"
              fill="#94a3ae"
              fontFamily="ui-monospace, monospace"
            >
              {l.label}
            </text>
          </g>
        ))}
      </g>
    </Frame>
  );
}

/** Langkah 3 — laporan hasil dengan rincian dan perkiraan biaya. */
export function TutorialReport() {
  const id = 'tr';
  const rows = [
    { tone: GREEN, w: 92, label: 46 },
    { tone: '#fbbf24', w: 74, label: 38 },
    { tone: '#ff6b6b', w: 58, label: 52 },
  ];
  return (
    <Frame id={id} label="Laporan hasil dan perkiraan biaya">
      <rect
        x="34"
        y="20"
        width="252"
        height="170"
        rx="16"
        fill={`url(#${id}-body)`}
        stroke={EDGE}
        strokeWidth="2"
      />
      {/* Kepala laporan */}
      <path d="M34 36a16 16 0 0 1 16-16h220a16 16 0 0 1 16 16v18H34z" fill="#0c141a" />
      <rect x="50" y="30" width="58" height="9" rx="4.5" fill={GREEN} />
      <rect x="116" y="30" width="34" height="9" rx="4.5" fill={EDGE} />
      <circle cx="268" cy="34.5" r="4" fill={GREEN_DEEP} />

      {/* Cincin ringkasan */}
      <g transform="translate(224 118)">
        <circle r="38" fill="none" stroke="#22303a" strokeWidth="9" />
        <path
          d="M0-38a38 38 0 0 1 33 57"
          fill="none"
          stroke={GREEN}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <text
          x="0"
          y="6"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="#eef4f8"
          fontFamily="ui-monospace, monospace"
        >
          7
        </text>
      </g>

      {/* Baris rincian kerusakan */}
      {rows.map((r, i) => (
        <g key={r.tone} transform={`translate(56 ${80 + i * 26})`}>
          <rect x="0" y="0" width="14" height="7" rx="3.5" fill={r.tone} />
          <rect x="22" y="0.5" width={r.label} height="6" rx="3" fill="#43596a" />
          <rect x="0" y="13" width={r.w} height="4" rx="2" fill={r.tone} opacity="0.32" />
        </g>
      ))}

      {/* Baris total biaya */}
      <rect x="56" y="160" width="112" height="12" rx="6" fill={GREEN} opacity="0.9" />
      <rect x="176" y="162" width="44" height="8" rx="4" fill={EDGE} />
    </Frame>
  );
}

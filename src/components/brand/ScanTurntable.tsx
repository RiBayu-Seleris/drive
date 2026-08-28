import { useMemo } from 'react';

/**
 * Kendaraan rangka kawat yang berputar di atas meja putar — animasi utama
 * layar analisis.
 *
 * Versi sebelumnya memutar FOTO plat dan sisi kendaraan. Itu jujur, tapi plat
 * nomor bukan hal yang sedang dianalisis di tahap ini, dan menampilkannya
 * besar-besar justru menonjolkan bagian yang salah.
 *
 * Ini rotasi 3D SUNGGUHAN, bukan gambar datar yang dipipihkan: titik sudutnya
 * disimpan dalam koordinat tiga dimensi, diputar terhadap sumbu tegak, lalu
 * diproyeksikan dengan perspektif tiap frame. Karena itu bagian yang menjauh
 * benar-benar menyusut dan garisnya menyilang seperti benda nyata — hal yang
 * tidak bisa ditiru `transform: rotateY()` pada gambar datar.
 *
 * Nol library 3D. Matematikanya cuma dua rotasi dan satu pembagian.
 */

/** Sudut pandang: kamera sedikit di atas kendaraan, bukan sejajar tanah. */
const ELEVATION = 0.36;
/**
 * Jarak kamera untuk perspektif.
 *
 * Sempat 7.4 dan hasilnya salah baca: bagian yang mendekat membesar terlalu
 * kejam sehingga kendaraannya tampak MIRING, bukan berputar. 12 memberi
 * kedalaman yang cukup tanpa distorsi lensa lebar.
 */
const FOCAL = 12;
/** Skala dunia → piksel kanvas. */
const SCALE = 31;
const CX = 120;
const CY = 70;

type V3 = readonly [number, number, number];

/** Rangka bodi: kotak bawah, garis pinggang, dan kabin. */
const BODY: V3[] = [
  // 0-3 dasar
  [-0.9, 0.2, -1.95],
  [0.9, 0.2, -1.95],
  [0.9, 0.2, 1.95],
  [-0.9, 0.2, 1.95],
  // 4-7 garis pinggang
  [-0.9, 0.7, -1.85],
  [0.9, 0.7, -1.85],
  [0.9, 0.7, 1.85],
  [-0.9, 0.7, 1.85],
  // 8-11 dasar kabin
  [-0.78, 0.7, -1.15],
  [0.78, 0.7, -1.15],
  [0.78, 0.7, 0.78],
  [-0.78, 0.7, 0.78],
  // 12-15 atap
  [-0.62, 1.2, -0.85],
  [0.62, 1.2, -0.85],
  [0.62, 1.2, 0.42],
  [-0.62, 1.2, 0.42],
];

const BODY_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 8],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 12],
  [8, 12],
  [9, 13],
  [10, 14],
  [11, 15],
];

/** Roda: cincin tegak (bidang YZ) pada posisi x tetap. */
const WHEEL_SEGMENTS = 10;
const WHEEL_R = 0.36;
const WHEEL_POS: ReadonlyArray<readonly [number, number]> = [
  [-0.93, 1.25],
  [0.93, 1.25],
  [-0.93, -1.2],
  [0.93, -1.2],
];

function buildWheels(): Array<{ points: V3[] }> {
  return WHEEL_POS.map(([x, z]) => {
    const points: V3[] = [];
    for (let i = 0; i < WHEEL_SEGMENTS; i++) {
      const a = (i / WHEEL_SEGMENTS) * Math.PI * 2;
      points.push([x, 0.36 + Math.sin(a) * WHEEL_R, z + Math.cos(a) * WHEEL_R]);
    }
    return { points };
  });
}

/** Cincin meja putar di bawah kendaraan. */
function buildStage(radius: number, segments = 48): V3[] {
  const points: V3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push([Math.cos(a) * radius, 0, Math.sin(a) * radius * 0.62]);
  }
  return points;
}

interface Projected {
  x: number;
  y: number;
  /** Kedalaman setelah rotasi; dipakai meredupkan bagian yang menjauh. */
  depth: number;
}

function project([x, y, z]: V3, angle: number): Projected {
  // Putar terhadap sumbu tegak (Y).
  const sa = Math.sin(angle);
  const ca = Math.cos(angle);
  const rx = x * ca + z * sa;
  const rz = -x * sa + z * ca;

  // Miringkan agar kamera memandang dari atas.
  const se = Math.sin(ELEVATION);
  const ce = Math.cos(ELEVATION);
  const ry = y * ce - rz * se;
  const rzz = y * se + rz * ce;

  const k = FOCAL / (FOCAL + rzz);
  return { x: CX + rx * k * SCALE, y: CY - ry * k * SCALE, depth: rzz };
}

/** Bagian yang menjauh diredupkan — inilah yang memberi kesan ruang. */
function depthOpacity(depth: number, min = 0.22, max = 1): number {
  const t = Math.min(1, Math.max(0, (depth + 2.2) / 4.4));
  return max - (max - min) * t;
}

export function ScanTurntable({
  angle,
  scanning = true,
  className,
}: {
  /** Sudut putar dalam radian; dikendalikan pemanggil agar satu loop saja. */
  angle: number;
  /** Saat selesai, bidang pindai dan pendarnya berhenti. */
  scanning?: boolean;
  className?: string;
}) {
  const wheels = useMemo(buildWheels, []);
  const stageOuter = useMemo(() => buildStage(2.25), []);
  const stageInner = useMemo(() => buildStage(1.6), []);

  const body = BODY.map((v) => project(v, angle));
  const stageO = stageOuter.map((v) => project(v, angle));
  const stageI = stageInner.map((v) => project(v, angle));

  const toPath = (pts: Projected[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z';

  // Bidang pindai: cincin datar yang naik-turun MENEMBUS kendaraan. Bentuk
  // elips membuatnya terbaca sebagai bidang mendatar di ruang 3D; versi
  // pertama memakai garis lurus melintang dan itu terlihat seperti coretan.
  const sweepT = (Math.sin(angle * 0.8) + 1) / 2;
  // Tingginya dibatasi 0.05..1.15 — tetap DI DALAM badan kendaraan. Sempat
  // sampai 1.45 dan hasilnya melayang di atas atap seperti cincin piring
  // terbang, bukan bidang yang sedang menyapu.
  const sweepPlane = buildStage(1.5, 40).map(([x, , z]) =>
    project([x, 0.05 + sweepT * 1.1, z], angle),
  );

  return (
    <svg
      viewBox="0 0 240 135"
      className={className}
      role="img"
      aria-label="Kendaraan sedang dipindai dari segala sudut"
    >
      <defs>
        <radialGradient id="st-glow" cx="50%" cy="62%" r="52%">
          <stop offset="0%" stopColor="#aded1f" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#aded1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="st-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#aded1f" stopOpacity="0" />
          <stop offset="50%" stopColor="#aded1f" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#aded1f" stopOpacity="0" />
        </linearGradient>
      </defs>

      <ellipse cx={CX} cy={CY + 8} rx="112" ry="58" fill="url(#st-glow)" />

      {/* Meja putar */}
      <path d={toPath(stageO)} fill="none" stroke="#2c3a44" strokeWidth="1" />
      <path d={toPath(stageI)} fill="none" stroke="#223039" strokeWidth="1" />

      {/* Jari-jari meja: memberi tanda bahwa lantainya ikut berputar. Tanpa ini
          cincinnya diam saja dan rotasinya jadi kurang terbaca. */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = angle + (i / 6) * Math.PI * 2;
        const p = project([Math.cos(a) * 2.25, 0, Math.sin(a) * 2.25 * 0.62], 0);
        const q = project([Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6 * 0.62], 0);
        return (
          <line
            key={i}
            x1={q.x}
            y1={q.y}
            x2={p.x}
            y2={p.y}
            stroke="#aded1f"
            strokeOpacity={depthOpacity(p.depth, 0.1, 0.5)}
            strokeWidth="1"
          />
        );
      })}

      {/* Bidang pindai menembus kendaraan, digambar di belakang rangkanya */}
      {scanning && (
        <path
          d={toPath(sweepPlane)}
          fill="#aded1f"
          fillOpacity="0.05"
          stroke="#d5f77e"
          strokeOpacity="0.5"
          strokeWidth="1"
        />
      )}

      {/* Roda */}
      {wheels.map((wheel, wi) => {
        const pts = wheel.points.map((v) => project(v, angle));
        const avg = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
        return (
          <path
            key={wi}
            d={toPath(pts)}
            fill="none"
            stroke="#7c8b96"
            strokeOpacity={depthOpacity(avg, 0.18, 0.8)}
            strokeWidth="1.1"
          />
        );
      })}

      {/* Rangka bodi */}
      {BODY_EDGES.map(([a, b], i) => {
        const p = body[a];
        const q = body[b];
        // `noUncheckedIndexedAccess` menyala: indeksnya memang selalu ada,
        // tapi TypeScript tidak tahu itu — jaga saja daripada memaksa `!`.
        if (!p || !q) return null;
        const avg = (p.depth + q.depth) / 2;
        return (
          <line
            key={i}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="#aded1f"
            strokeOpacity={depthOpacity(avg, 0.2, 0.95)}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        );
      })}

      {/* Titik sudut — kesan "titik terdeteksi" pada pemindaian */}
      {body.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="1.5"
          fill="#d5f77e"
          fillOpacity={depthOpacity(p.depth, 0.15, 0.9)}
        />
      ))}

    </svg>
  );
}

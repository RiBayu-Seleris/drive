import { useMemo } from 'react';

/**
 * Kendaraan rangka kawat yang berputar di atas meja putar — animasi utama
 * layar analisis.
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
const SCALE = 30;
const CX = 120;
const CY = 68;
/** Tinggi viewBox; dipakai memetakan posisi pita cahaya ke ketinggian dunia. */
const VIEW_H = 135;

type V3 = readonly [number, number, number];

/*
 * Bentuk kendaraan: permukaan yang di-loft dari PENAMPANG MELINTANG, bukan
 * siluet samping yang diekstrusi.
 *
 * Dua versi sebelumnya gagal karena alasan yang sama — terlalu sedikit rusuk.
 * Kotak-di-atas-kotak terbaca sebagai mimbar; siluet samping yang diekstrusi
 * sudah berbentuk mobil tapi masih seperti origami. Yang membuat rangka kawat
 * terbaca sebagai kendaraan adalah rusuk melintang yang rapat: mata membaca
 * lengkung kap dan bahu pintu dari jarak antar-rusuknya, bukan dari garis
 * luarnya.
 *
 * Tiap stasiun sepanjang sumbu z memberi satu penampang. Lebar dan tingginya
 * berubah per stasiun — itu yang membentuk kap yang melandai, kabin yang
 * menyempit, dan buritan yang meruncing.
 */
interface Station {
  z: number;
  /** Bibir bawah bodi (jarak ke tanah) dan setengah lebarnya. */
  bottom: number;
  bottomHalf: number;
  /** Garis pinggang: titik TERLEBAR penampang, tempat bahu pintu berada. */
  belt: number;
  beltHalf: number;
  /** Permukaan atas — kap, atap, atau dek belakang. */
  top: number;
  topHalf: number;
}

const STATIONS: Station[] = [
  { z: 2.02, bottom: 0.26, bottomHalf: 0.58, belt: 0.64, beltHalf: 0.78, top: 0.7, topHalf: 0.56 },
  { z: 1.68, bottom: 0.23, bottomHalf: 0.7, belt: 0.74, beltHalf: 0.88, top: 0.8, topHalf: 0.7 },
  { z: 1.14, bottom: 0.22, bottomHalf: 0.74, belt: 0.78, beltHalf: 0.9, top: 0.84, topHalf: 0.74 },
  { z: 0.56, bottom: 0.22, bottomHalf: 0.76, belt: 0.82, beltHalf: 0.92, top: 0.9, topHalf: 0.74 },
  { z: 0.04, bottom: 0.22, bottomHalf: 0.76, belt: 0.86, beltHalf: 0.92, top: 1.32, topHalf: 0.6 },
  {
    z: -0.56,
    bottom: 0.22,
    bottomHalf: 0.76,
    belt: 0.86,
    beltHalf: 0.92,
    top: 1.34,
    topHalf: 0.62,
  },
  { z: -1.06, bottom: 0.22, bottomHalf: 0.74, belt: 0.84, beltHalf: 0.9, top: 1.24, topHalf: 0.54 },
  { z: -1.56, bottom: 0.24, bottomHalf: 0.72, belt: 0.8, beltHalf: 0.88, top: 0.92, topHalf: 0.72 },
  {
    z: -2.02,
    bottom: 0.26,
    bottomHalf: 0.58,
    belt: 0.68,
    beltHalf: 0.78,
    top: 0.76,
    topHalf: 0.58,
  },
];

/** Titik per penampang: puncak, 4 sisi kanan, dasar, 4 sisi kiri. */
const RING_POINTS = 10;

/**
 * Satu penampang tertutup, ditelusuri dari puncak → kanan → dasar → kiri.
 *
 * Sisi kanan dan kiri sengaja cermin sempurna. Kendaraan memang simetris, dan
 * asimetri sekecil apa pun di rangka kawat langsung terbaca sebagai penyok.
 */
function buildRing(s: Station): V3[] {
  const right: Array<readonly [number, number]> = [
    [0, s.top], // puncak
    [s.topHalf, s.top - (s.top - s.belt) * 0.14], // bibir atas (talang atap / tepi kap)
    [s.beltHalf, s.belt], // garis pinggang
    [s.bottomHalf + (s.beltHalf - s.bottomHalf) * 0.4, s.bottom + (s.belt - s.bottom) * 0.42],
    [s.bottomHalf, s.bottom], // bibir bawah
    [0, s.bottom], // dasar
  ];
  const ring: V3[] = right.map(([x, y]) => [x, y, s.z] as const);
  // Balik ke atas lewat sisi kiri, melewati puncak & dasar yang sudah ada.
  for (let i = right.length - 2; i >= 1; i--) {
    const p = right[i];
    if (p) ring.push([-p[0], p[1], s.z]);
  }
  return ring;
}

const RINGS: V3[][] = STATIONS.map(buildRing);

/*
 * Titik, rusuk, dan BIDANG disimpan sebagai indeks ke satu larik titik.
 *
 * Versi sebelumnya menyimpan pasangan koordinat langsung di tiap rusuk, jadi
 * satu titik sudut ikut diproyeksikan sekali untuk tiap rusuk yang menyentuhnya
 * — tiga sampai empat kali per frame untuk titik yang sama. Dengan indeks, tiap
 * titik diproyeksikan tepat sekali lalu dipakai bersama rusuk dan bidang.
 */
const VERTS: V3[] = [];
const EDGES: Array<readonly [number, number]> = [];
/** Bidang cangkang: urutan indeks titik, berlawanan arah jarum jam dari luar. */
const FACES: number[][] = [];
/** Normal tiap bidang di ruang dunia; dipakai menghitung pendar tepi. */
const FACE_NORMALS: V3[] = [];

function pushVert(v: V3): number {
  VERTS.push(v);
  return VERTS.length - 1;
}

/** Normal bidang dari tiga titik pertamanya (bidang di sini selalu cembung). */
function faceNormal(a: V3, b: V3, c: V3): V3 {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  const n: [number, number, number] = [
    u[1] * w[2] - u[2] * w[1],
    u[2] * w[0] - u[0] * w[2],
    u[0] * w[1] - u[1] * w[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

function pushFace(indexes: number[]): void {
  const a = VERTS[indexes[0] ?? 0];
  const b = VERTS[indexes[1] ?? 0];
  const c = VERTS[indexes[2] ?? 0];
  if (!a || !b || !c) return;
  FACES.push(indexes);
  FACE_NORMALS.push(faceNormal(a, b, c));
}

/** Roda: pelek + jari-jari, seperti pada rangka kawat rujukan. */
const WHEEL_SEGMENTS = 10;
const WHEEL_R = 0.38;
const WHEEL_Y = 0.38;
const WHEEL_SPOKES = 5;
const WHEEL_POS: ReadonlyArray<readonly [number, number]> = [
  [-0.88, 1.24],
  [0.88, 1.24],
  [-0.88, -1.3],
  [0.88, -1.3],
];

(function buildGeometry() {
  // Penampang → indeks titik.
  const ringIdx: number[][] = RINGS.map((ring) => ring.map(pushVert));

  for (const ring of ringIdx) {
    for (let i = 0; i < ring.length; i++) {
      EDGES.push([ring[i] ?? 0, ring[(i + 1) % ring.length] ?? 0]);
    }
  }
  for (let r = 0; r < ringIdx.length - 1; r++) {
    const cur = ringIdx[r];
    const next = ringIdx[r + 1];
    if (!cur || !next) continue;
    for (let i = 0; i < RING_POINTS; i++) {
      EDGES.push([cur[i] ?? 0, next[i] ?? 0]);
      // Bidang cangkang antara dua penampang bersebelahan.
      const j = (i + 1) % RING_POINTS;
      pushFace([cur[i] ?? 0, cur[j] ?? 0, next[j] ?? 0, next[i] ?? 0]);
    }
  }
  // Tutup depan & belakang, supaya cangkangnya tidak berlubang saat dilihat
  // dari arah memanjang.
  const first = ringIdx[0];
  const last = ringIdx[ringIdx.length - 1];
  if (first) pushFace([...first].reverse());
  if (last) pushFace([...last]);

  for (const pos of WHEEL_POS) {
    const [x, z] = pos;
    const rim: number[] = [];
    for (let i = 0; i < WHEEL_SEGMENTS; i++) {
      const a = (i / WHEEL_SEGMENTS) * Math.PI * 2;
      rim.push(pushVert([x, WHEEL_Y + Math.sin(a) * WHEEL_R, z + Math.cos(a) * WHEEL_R]));
    }
    for (let i = 0; i < rim.length; i++) {
      EDGES.push([rim[i] ?? 0, rim[(i + 1) % rim.length] ?? 0]);
    }
    pushFace([...rim]);
    const hub = pushVert([x, WHEEL_Y, z]);
    for (let i = 0; i < WHEEL_SPOKES; i++) {
      const a = (i / WHEEL_SPOKES) * Math.PI * 2;
      EDGES.push([
        hub,
        pushVert([x, WHEEL_Y + Math.sin(a) * WHEEL_R * 0.82, z + Math.cos(a) * WHEEL_R * 0.82]),
      ]);
    }
  }
})();

/** Elips mendatar di ketinggian y — dipakai meja putar dan bidang pindai. */
function buildEllipse(radiusX: number, radiusZ: number, y = 0, segments = 48, centerZ = 0): V3[] {
  const points: V3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push([Math.cos(a) * radiusX, y, centerZ + Math.sin(a) * radiusZ]);
  }
  return points;
}

interface Projected {
  x: number;
  y: number;
  /** Kedalaman setelah rotasi; makin kecil makin dekat ke kamera. */
  depth: number;
}

function project([x, y, z]: V3, angle: number, flip = false): Projected {
  const yy = flip ? -y : y;
  // Putar terhadap sumbu tegak (Y).
  const sa = Math.sin(angle);
  const ca = Math.cos(angle);
  const rx = x * ca + z * sa;
  const rz = -x * sa + z * ca;

  /*
   * Miringkan agar kamera memandang dari SEDIKIT DI ATAS garis pinggang.
   *
   * Tandanya sempat terbalik: rz dikurangkan dari ry, bukan ditambahkan. Ujung
   * yang menjauh jadi jatuh ke BAWAH layar padahal seharusnya naik menuju
   * cakrawala — artinya kameranya berada di bawah lantai, memandang ke atas.
   * Pada rangka 27 rusuk kesalahan itu lolos; begitu mesh-nya rapat, yang
   * terlihat justru kolong kendaraan.
   */
  const se = Math.sin(ELEVATION);
  const ce = Math.cos(ELEVATION);
  const ry = yy * ce + rz * se;
  const rzz = rz * ce - yy * se;

  const k = FOCAL / (FOCAL + rzz);
  return { x: CX + rx * k * SCALE, y: CY - ry * k * SCALE, depth: rzz };
}

/**
 * Komponen normal sepanjang sumbu pandang, setelah bidangnya ikut diputar.
 *
 * Normal itu ARAH, jadi ia hanya ikut rotasi — tidak ikut geseran maupun
 * pembagian perspektif. Nilainya negatif kalau bidang menghadap kamera.
 */
function facingOf([nx, ny, nz]: V3, angle: number): number {
  const sa = Math.sin(angle);
  const ca = Math.cos(angle);
  const rz = -nx * sa + nz * ca;
  return rz * Math.cos(ELEVATION) - ny * Math.sin(ELEVATION);
}

/*
 * Cangkang hologram.
 *
 * Bidangnya tidak dicat rata. Yang menyala justru bidang yang MENYEROMPET
 * pandangan — makin tegak lurus ke kamera, makin redup. Itu yang membuat benda
 * tembus pandang terbaca sebagai benda: cahaya menumpuk di siluetnya, persis
 * seperti kaca atau kabut. Kalau semua bidang dicat sama rata, hasilnya cuma
 * gumpalan hijau tanpa bentuk.
 *
 * Bidang yang membelakangi kamera tetap digambar — memang harus tembus pandang —
 * tapi diredupkan supaya sisi depan tetap menang.
 */
const FILL_BASE = 0.05;
const FILL_RIM = 0.24;
const FILL_BACK = 0.45;
/** Banyak tingkat opasitas bidang; tiap tingkat jadi SATU path. */
const FILL_STEPS = 6;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Ubah posisi pita cahaya di panel (0 = tepi atas, 1 = tepi bawah) menjadi
 * ketinggian di ruang 3D.
 *
 * Perspektifnya diabaikan di sini: pada ELEVATION sekecil ini faktor k hanya
 * bergerak antara 1,00 dan 0,96 sepanjang tinggi kendaraan — selisih kurang
 * dari satu piksel, tidak sebanding dengan rumit balikannya.
 */
function panelToWorldY(fraction: number): number {
  return (CY - fraction * VIEW_H) / (SCALE * Math.cos(ELEVATION));
}

/*
 * Bidang pindai: irisan mendatar yang mengikuti pita cahaya di panel.
 *
 * Ukurannya MENGECIL seiring naik, mengikuti penampang kendaraan di ketinggian
 * itu — lebar di dekat tanah, tinggal selebar kabin di atap. Pusatnya ikut
 * mundur karena kabin duduk di belakang, bukan di tengah; tanpa itu elipsnya
 * menjulur melewati kap dan terbaca sebagai gelang yang menggantung.
 */
const SWEEP_LOW = 0.05;
const SWEEP_HIGH = 1.36;
const CABIN_CENTER_Z = -0.5;

function sweepSlice(y: number): { y: number; radiusX: number; radiusZ: number; centerZ: number } {
  const shrink = Math.max(0, (y - 0.72) / (SWEEP_HIGH - 0.72));
  return {
    y,
    radiusX: lerp(0.96, 0.64, shrink),
    radiusZ: lerp(2.06, 0.62, shrink),
    centerZ: lerp(0, CABIN_CENTER_Z, shrink),
  };
}

/*
 * Rusuk dikelompokkan per jarak, lalu tiap kelompok digambar sebagai SATU path.
 *
 * Versi lama menggambar satu elemen <line> per rusuk. Dengan 30 rusuk itu tidak
 * terasa; dengan 230 rusuk, React harus merekonsiliasi ratusan simpul DOM enam
 * puluh kali sedetik dan animasinya mulai tersendat di ponsel. Empat path yang
 * isinya untaian "M…L…" memberi gradasi jarak yang sama dengan sepuluh simpul.
 */
const DEPTH_BANDS = [
  { max: -1.1, opacity: 1 },
  { max: -0.2, opacity: 0.78 },
  { max: 0.7, opacity: 0.52 },
  { max: Infinity, opacity: 0.3 },
];

function bandOf(depth: number): number {
  for (let i = 0; i < DEPTH_BANDS.length; i++) {
    const band = DEPTH_BANDS[i];
    if (band && depth <= band.max) return i;
  }
  return DEPTH_BANDS.length - 1;
}

export function ScanTurntable({
  angle,
  sweep = 0,
  scanning = true,
  className,
}: {
  /** Sudut putar dalam radian; dikendalikan pemanggil agar satu loop saja. */
  angle: number;
  /**
   * Posisi pita cahaya pemindai di panel: 0 = tepi atas, 1 = tepi bawah.
   *
   * Skalanya sengaja mengikuti PANEL, bukan tinggi kendaraan, supaya nilai yang
   * sama bisa dipakai menempatkan pita cahaya di lapisan HTML di atas gambar
   * ini. Irisan yang memotong kendaraan dihitung dari nilai itu juga, jadi
   * keduanya selalu berada di ketinggian layar yang sama — dan irisannya
   * MENGHILANG saat pitanya melewati ruang kosong di atas atap atau di bawah
   * roda, karena di situ memang tidak ada yang dipotong.
   */
  sweep?: number;
  /**
   * Gambar irisan pemindainya atau tidak.
   *
   * Dipakai untuk menghormati "kurangi animasi" di setelan sistem — BUKAN untuk
   * menandai analisis sudah selesai. Setelah 100% sapuannya sengaja tetap
   * jalan, cuma melambat: layar yang membeku total terasa seperti aplikasinya
   * mati, padahal user masih harus menekan tombol hasil.
   */
  scanning?: boolean;
  className?: string;
}) {
  const stageOuter = useMemo(() => buildEllipse(2.5, 1.55), []);
  const stageInner = useMemo(() => buildEllipse(1.8, 1.12), []);

  const toPath = (pts: Projected[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z';

  const seg = (a: Projected, b: Projected) =>
    `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;

  // Satu lintasan atas seluruh rusuk: bangun untaian per kelompok jarak
  // sekaligus untaian pantulan, supaya tiap titik hanya diproyeksikan sekali.
  // Tiap titik diproyeksikan SEKALI, lalu dipakai bersama rusuk dan bidang.
  const points = VERTS.map((v) => project(v, angle));
  const mirrored = VERTS.map((v) => project(v, angle, true));

  const bands = DEPTH_BANDS.map(() => '');
  let mirror = '';
  for (const [ia, ib] of EDGES) {
    const a = points[ia];
    const b = points[ib];
    const ma = mirrored[ia];
    const mb = mirrored[ib];
    if (!a || !b || !ma || !mb) continue;
    bands[bandOf((a.depth + b.depth) / 2)] += seg(a, b);
    mirror += seg(ma, mb);
  }

  // Cangkang: bidang dikelompokkan per tingkat opasitas, satu path per tingkat.
  const shell = Array.from({ length: FILL_STEPS }, () => '');
  for (let f = 0; f < FACES.length; f++) {
    const face = FACES[f];
    const normal = FACE_NORMALS[f];
    if (!face || !normal) continue;
    const facing = facingOf(normal, angle);
    const rim = 1 - Math.min(1, Math.abs(facing));
    const alpha = (FILL_BASE + FILL_RIM * rim * rim) * (facing < 0 ? 1 : FILL_BACK);
    const step = Math.min(
      FILL_STEPS - 1,
      Math.round((alpha / (FILL_BASE + FILL_RIM)) * (FILL_STEPS - 1)),
    );
    let d = '';
    for (let i = 0; i < face.length; i++) {
      const p = points[face[i] ?? 0];
      if (!p) continue;
      d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    if (d) shell[step] += d + 'Z';
  }

  const stageO = stageOuter.map((v) => project(v, angle));
  const stageI = stageInner.map((v) => project(v, angle));

  const sweepY = panelToWorldY(Math.min(1, Math.max(0, sweep)));
  const cutsBody = sweepY >= SWEEP_LOW && sweepY <= SWEEP_HIGH;
  const slice = sweepSlice(sweepY);
  const sweepPlane = buildEllipse(slice.radiusX, slice.radiusZ, slice.y, 40, slice.centerZ).map(
    (v) => project(v, angle),
  );

  return (
    <svg
      viewBox="0 0 240 135"
      className={className}
      role="img"
      aria-label="Kendaraan sedang dipindai dari segala sudut"
    >
      <defs>
        <radialGradient id="st-glow" cx="50%" cy="60%" r="52%">
          <stop offset="0%" stopColor="#aded1f" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#aded1f" stopOpacity="0" />
        </radialGradient>
        {/* Pantulan meluruh ke bawah — lantai yang memantul, bukan salinan
            kendaraan yang digantung terbalik. */}
        <linearGradient id="st-reflect" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="st-reflect-mask" maskUnits="userSpaceOnUse" x="0" y="68" width="240" height="67">
          <rect x="0" y="68" width="240" height="67" fill="url(#st-reflect)" />
        </mask>
      </defs>

      <ellipse cx={CX} cy={CY + 12} rx="112" ry="56" fill="url(#st-glow)" />

      {/* Pantulan di lantai, digambar paling bawah. */}
      <g mask="url(#st-reflect-mask)">
        <path
          d={mirror}
          fill="none"
          stroke="#aded1f"
          strokeOpacity="0.42"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>

      {/* Meja putar */}
      <path d={toPath(stageO)} fill="none" stroke="#2c3a44" strokeWidth="1" />
      <path d={toPath(stageI)} fill="none" stroke="#223039" strokeWidth="1" />

      {/* Jari-jari meja: memberi tanda bahwa lantainya ikut berputar. */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = angle + (i / 6) * Math.PI * 2;
        const p = project([Math.cos(a) * 2.5, 0, Math.sin(a) * 1.55], 0);
        const q = project([Math.cos(a) * 1.8, 0, Math.sin(a) * 1.12], 0);
        return (
          <line
            key={i}
            x1={q.x}
            y1={q.y}
            x2={p.x}
            y2={p.y}
            stroke="#aded1f"
            strokeOpacity="0.28"
            strokeWidth="1"
          />
        );
      })}

      {/* Bidang pindai di belakang rangka: isian redupnya terbaca sebagai kabut
          di dalam bodi, bukan tirai yang menutupi mobilnya. */}
      {scanning && cutsBody && (
        <path
          d={toPath(sweepPlane)}
          fill="#aded1f"
          fillOpacity="0.06"
          stroke="#e6ffa8"
          strokeOpacity="0.8"
          strokeWidth="1"
        />
      )}

      {/*
        Cangkang hologram, digambar SEBELUM rangka kawat supaya garisnya tetap
        di atas permukaan — seperti tulang di dalam kaca, bukan tertimbun.
      */}
      {shell.map((d, i) =>
        d ? (
          <path
            key={`shell-${i}`}
            d={d}
            fill="#aded1f"
            fillOpacity={((i + 1) / FILL_STEPS) * (FILL_BASE + FILL_RIM)}
            stroke="none"
          />
        ) : null,
      )}

      {/*
        Pendar neon: salinan tebal beropasitas rendah di bawah garis intinya —
        lebih murah daripada filter blur SVG, yang harus dihitung ulang tiap
        frame karena isinya berubah terus.

        Pendarnya IKUT diredupkan per jarak. Sempat dipasang satu selimut
        seragam untuk semua rusuk, dan itu menghapus kesan ruang: sisi yang
        membelakangi kamera bersinar sama terangnya dengan sisi depan, sehingga
        rangkanya terbaca datar seperti coretan, bukan benda.
      */}
      {bands.map((d, i) => (
        <path
          key={`glow-${i}`}
          d={d}
          fill="none"
          stroke="#aded1f"
          strokeOpacity={(DEPTH_BANDS[i]?.opacity ?? 0.4) * 0.16}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      ))}

      {/* Rangka kendaraan, satu path per kelompok jarak. */}
      {bands.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#c8f45a"
          strokeOpacity={DEPTH_BANDS[i]?.opacity ?? 0.4}
          strokeWidth="0.85"
          strokeLinecap="round"
        />
      ))}

      {/* Garis pindai yang MELINTAS di depan rangka — tipis saja. Inilah yang
          membuatnya terbaca menembus kendaraan, bukan lewat di belakangnya. */}
      {scanning && cutsBody && (
        <path
          d={toPath(sweepPlane)}
          fill="none"
          stroke="#f2ffd0"
          strokeOpacity="0.5"
          strokeWidth="0.8"
        />
      )}
    </svg>
  );
}

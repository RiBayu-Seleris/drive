/**
 * Ilustrasi portal mitra — derek dan pendaftaran.
 *
 * Menggantikan aset merek lama: `hero-towing.svg` (245 KB hasil ekspor Figma,
 * biru–oranye) dan `logo-register-mitra.png` (klipart truk oranye + orang).
 * Keduanya menyala sendiri di atas latar gelap DRIVE — terlihat seperti
 * tempelan dari aplikasi lain.
 *
 * Tetap SVG inline, alasan yang sama dengan `ScanHero` dan `TutorialArt`:
 * warnanya mengikuti token tema, tidak menambah permintaan jaringan, dan tajam
 * di kepadatan layar berapa pun. Nol berkas gambar, nol library.
 *
 * Aturan cahaya sistem tetap dipatuhi: sumber cahaya dari ATAS-KIRI, jadi tepi
 * atas bodi diberi garis hijau tipis dan bayangan jatuh ke bawah.
 */
import type { ReactNode } from 'react';

const GREEN = '#aded1f';
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
        <stop offset="70%" stopColor={GREEN} stopOpacity="0.5" />
        <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="55%" r="55%">
        <stop offset="0%" stopColor={GREEN} stopOpacity="0.2" />
        <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-shadow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** Roda: pelek gelap dengan tapak bergaris, dipakai truk maupun mobil muatan. */
function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0b1218" stroke={EDGE} strokeWidth={r > 14 ? 2.4 : 1.8} />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.42}
        fill="#1a2630"
        stroke={EDGE}
        strokeWidth={r > 14 ? 1.6 : 1.2}
      />
    </g>
  );
}

/**
 * Hero portal mitra towing dan halaman tugas sopir.
 *
 * Kanvasnya 393x266 — SAMA dengan aset lama. Gambar ini dipakai sebagai lapisan
 * dasar full-bleed dengan logo dan profil menumpang di atasnya, jadi tingginya
 * ikut menentukan tinggi header. Mengubah rasionya menggeser tata letak kedua
 * halaman. Isi digambar di paruh bawah supaya paruh atas tetap kosong untuk
 * konten yang menumpang.
 */
export function TowingHero({ className }: { className?: string }) {
  const id = 'mt-tow';
  return (
    <svg
      viewBox="0 0 393 266"
      className={className}
      role="img"
      aria-label="Ilustrasi truk derek mengangkut kendaraan"
    >
      <Defs id={id} />
      <ellipse cx="196" cy="170" rx="200" ry="110" fill={`url(#${id}-glow)`} />

      {/* Jalan */}
      <ellipse cx="196" cy="238" rx="170" ry="16" fill={`url(#${id}-shadow)`} />
      <path d="M0 236h393" stroke={EDGE} strokeWidth="1.6" opacity="0.7" />
      <g stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" opacity="0.45">
        <path d="M24 246h30" />
        <path d="M84 246h30" />
        <path d="M144 246h30" />
        <path d="M204 246h30" />
        <path d="M264 246h30" />
        <path d="M324 246h30" />
      </g>

      {/* Mobil muatan, berdiri di atas bak */}
      <g>
        <path
          d="M92 182v-13c0-6 4-10 10-12l28-8 21-15c4-3 8-4 12-4h32c6 0 11 2 15 6l15 15 13 4c6 2 9 6 9 12v15z"
          fill={`url(#${id}-body)`}
          stroke={EDGE}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M163 130c4-3 8-4 12-4h32c6 0 11 2 15 6l14 14"
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M137 152l17-14c2-2 4-3 7-3h20v17z"
          fill={`url(#${id}-glass)`}
          stroke={EDGE}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M188 135h18c4 0 8 2 11 5l11 12h-40z"
          fill={`url(#${id}-glass)`}
          stroke={EDGE}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <Wheel cx={128} cy={171} r={11} />
        <Wheel cx={210} cy={171} r={11} />
      </g>

      {/* Bak datar + landai muat di ujung kiri */}
      <path
        d="M18 206l46-24h8v12l-38 20h-12z"
        fill="#16222b"
        stroke={EDGE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="64" y="182" width="196" height="12" fill="#1a2630" stroke={EDGE} strokeWidth="1.6" />
      <path d="M64 182h196" stroke={GREEN} strokeWidth="1.6" opacity="0.55" />
      <rect x="76" y="194" width="176" height="8" fill="#101922" stroke={EDGE} strokeWidth="1.2" />

      {/* Tiang derek di ujung bak, dekat kabin */}
      <rect x="246" y="156" width="10" height="26" fill="#16222b" stroke={EDGE} strokeWidth="1.4" />
      <circle cx="251" cy="152" r="5" fill="#0b1218" stroke={GREEN} strokeWidth="1.6" />

      {/* Kabin */}
      <g>
        <path
          d="M262 196v-38c0-6 4-10 10-10h24l20 22h14c7 0 12 5 12 12v14z"
          fill={`url(#${id}-body)`}
          stroke={EDGE}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M262 158c0-6 4-10 10-10h24l19 21"
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M272 156h22l16 18h-38z"
          fill={`url(#${id}-glass)`}
          stroke={EDGE}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Lampu depan menyala tipis */}
        <path d="M334 178h6c4 0 6 2 6 5s-2 5-6 5h-6z" fill={GREEN} opacity="0.9" />
        {/* Lampu rotator di atap */}
        <rect x="276" y="142" width="18" height="6" rx="3" fill={GREEN} opacity="0.8" />
      </g>

      <Wheel cx={112} cy={206} r={20} />
      <Wheel cx={182} cy={206} r={20} />
      <Wheel cx={300} cy={206} r={20} />

      {/* Kurung bidik — bahasa visual yang sama dengan layar pemindaian */}
      <g fill="none" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 92V70a8 8 0 0 1 8-8h22" />
        <path d="M375 92V70a8 8 0 0 0-8-8h-22" />
      </g>
    </svg>
  );
}

/**
 * Ilustrasi halaman pendaftaran mitra.
 *
 * Menampilkan kendaraan di dalam bingkai bidik dengan tiga lencana jenis
 * kemitraan mengelilinginya — derek, bengkel, dan perlindungan. Bukan jabat
 * tangan: yang dipilih di halaman itu jenis layanan, bukan kesepakatan.
 *
 * Kanvasnya persegi (240x240) mengikuti aset lama yang 984x981, supaya tinggi
 * yang dipatok di halaman (`h-[172px]` dan `h-[230px]`) tidak berubah artinya.
 */
export function PartnerHero({ className }: { className?: string }) {
  const id = 'mt-partner';
  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role="img"
      aria-label="Ilustrasi jenis kemitraan DRIVE"
    >
      <Defs id={id} />
      <circle cx="120" cy="120" r="112" fill={`url(#${id}-glow)`} />

      {/* Cincin orbit tempat lencana duduk */}
      <circle
        cx="120"
        cy="120"
        r="88"
        fill="none"
        stroke={EDGE}
        strokeWidth="1.4"
        strokeDasharray="5 7"
        opacity="0.8"
      />

      {/* Kendaraan tampak samping di tengah bingkai */}
      <g>
        <ellipse cx="120" cy="160" rx="62" ry="9" fill={`url(#${id}-shadow)`} />
        <path
          d="M64 152v-10c0-5 3-8 8-10l22-6 17-12c3-2 6-3 9-3h26c5 0 9 2 12 5l12 12 10 3c5 2 7 5 7 10v11z"
          fill={`url(#${id}-body)`}
          stroke={EDGE}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M120 111c3-2 6-3 9-3h26c5 0 9 2 12 5l11 11"
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M100 129l13-11c2-1 3-2 5-2h16v13z"
          fill={`url(#${id}-glass)`}
          stroke={EDGE}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M139 116h14c3 0 6 1 8 4l9 9h-31z"
          fill={`url(#${id}-glass)`}
          stroke={EDGE}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <Wheel cx={92} cy={152} r={12} />
        <Wheel cx={158} cy={152} r={12} />
      </g>

      {/* Tiga lencana jenis kemitraan, duduk tepat di cincin orbit. */}
      <PartnerBadge cx={120} cy={32}>
        {/* Derek — truk bak datar */}
        <path d="M-11 3h13v-8h4l4 4v4h-2" />
        <circle cx="-6" cy="5" r="2.4" />
        <circle cx="7" cy="5" r="2.4" />
      </PartnerBadge>
      <PartnerBadge cx={44} cy={164}>
        {/* Bengkel — gir. Gigi HARUS menempel ke poros; begitu ada jarak,
            bentuknya terbaca sebagai matahari, bukan gir. */}
        <circle r="6" />
        <path d="M0-9v3M0 6v3M-9 0h3M6 0h3M-6.4-6.4l2.1 2.1M4.3 4.3l2.1 2.1M6.4-6.4l-2.1 2.1M-4.3 4.3l-2.1 2.1" />
      </PartnerBadge>
      <PartnerBadge cx={196} cy={164}>
        {/* Perlindungan — perisai */}
        <path d="M0-9l8.5 3.2v6.4C8.5 4.8 5 8.2 0 10.2-5 8.2-8.5 4.8-8.5.6V-5.8z" />
      </PartnerBadge>
    </svg>
  );
}

/** Lencana bulat berisi satu simbol; simbolnya digambar relatif ke titik pusat. */
function PartnerBadge({ cx, cy, children }: { cx: number; cy: number; children: ReactNode }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r="21" fill="#101922" stroke={GREEN} strokeWidth="1.8" />
      <circle r="21" fill={GREEN} opacity="0.08" />
      <g
        fill="none"
        stroke={GREEN}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="scale(1.05)"
      >
        {children}
      </g>
    </g>
  );
}

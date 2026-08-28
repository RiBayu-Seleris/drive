/**
 * Grafis pembuka halaman masuk/daftar.
 *
 * Menggantikan `/assets/auth/icon-login.png` — klipart oranye-biru bergaya
 * merek lama yang bertabrakan dengan tema gelap DRIVE.
 *
 * Sengaja SVG inline, bukan berkas gambar:
 *   - warnanya mengikuti token tema, jadi rebrand berikutnya tidak perlu aset
 *   - tidak menambah permintaan jaringan dan tetap tajam di layar kepadatan apa pun
 *   - isinya tidak mengandung teks yang tercetak, jadi tetap bisa diterjemahkan
 *
 * Bentuknya mengikuti bahasa visual poster: kendaraan dilihat dari depan di
 * dalam bingkai pemindaian bersudut, dengan sapuan garis pindai hijau.
 */
export function ScanHero({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Ilustrasi pemindaian kendaraan"
    >
      <defs>
        <radialGradient id="dh-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#aded1f" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#aded1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="dh-scan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#aded1f" stopOpacity="0" />
          <stop offset="50%" stopColor="#d5f77e" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#aded1f" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dh-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#243440" />
          <stop offset="100%" stopColor="#131c24" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#dh-glow)" />

      {/* Bingkai pemindaian bersudut */}
      <g
        fill="none"
        stroke="#aded1f"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M26 62V38a8 8 0 0 1 8-8h24" />
        <path d="M174 62V38a8 8 0 0 0-8-8h-24" />
        <path d="M26 138v24a8 8 0 0 0 8 8h24" />
        <path d="M174 138v24a8 8 0 0 1-8 8h-24" />
      </g>

      {/* Kendaraan dari depan */}
      <g>
        <path
          d="M62 84 74 60a10 10 0 0 1 9-6h34a10 10 0 0 1 9 6l12 24Z"
          fill="url(#dh-body)"
          stroke="#3a4c59"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M74 80 83 62a4 4 0 0 1 4-2h26a4 4 0 0 1 4 2l9 18Z"
          fill="#0d141a"
          stroke="#465c6b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect
          x="48"
          y="82"
          width="104"
          height="50"
          rx="14"
          fill="url(#dh-body)"
          stroke="#3a4c59"
          strokeWidth="2.5"
        />
        <rect x="57" y="94" width="24" height="11" rx="5.5" fill="#d5f77e" opacity="0.9" />
        <rect x="119" y="94" width="24" height="11" rx="5.5" fill="#d5f77e" opacity="0.9" />
        <rect x="84" y="112" width="32" height="10" rx="4" fill="#0d141a" />
        <g stroke="#3a4c59" strokeWidth="2" strokeLinecap="round">
          <path d="M88 117h24" />
        </g>
        <rect x="56" y="132" width="18" height="9" rx="3" fill="#0d141a" />
        <rect x="126" y="132" width="18" height="9" rx="3" fill="#0d141a" />
      </g>

      {/* Sapuan garis pindai */}
      <rect x="34" y="105" width="132" height="3" rx="1.5" fill="url(#dh-scan)" />
    </svg>
  );
}

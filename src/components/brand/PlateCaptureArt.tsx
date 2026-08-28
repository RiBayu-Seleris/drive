/**
 * Panduan memotret plat nomor.
 *
 * Menggantikan `bg_licenseplate.png` (888 KB), foto stok siang terang dengan
 * BINGKAI PUTIH yang ikut tercetak di dalam berkasnya — bingkai itu tidak bisa
 * dihilangkan lewat CSS dan bertabrakan dengan tema gelap. Platnya juga
 * bertulis "ABC-1234", format asing yang tidak pernah dipakai di Indonesia.
 *
 * Gambar ini mengajarkan hal yang sebenarnya diminta halaman itu: penuhi
 * bingkai dengan platnya, tegak lurus, dan terbaca. Foto stok kemarin justru
 * menampilkan bagasi ringsek — pesan yang berbeda dari yang diminta.
 *
 * Yang membuat versi pertamanya terasa kaku, dan bagaimana diperbaiki:
 *   - Bodinya kotak rata tanpa isi. Sekarang punya kaca belakang, tutup bagasi
 *     dengan garis sambungan, bemper, diffuser, dan knalpot.
 *   - Lampu belakang cuma dua balok merah. Sekarang berlapis: rumah lampu,
 *     garis lensa, dan pendarnya yang jatuh ke bodi.
 *   - Semuanya rata tanpa cahaya. Sekarang ada kilau tepi di atap, sorot
 *     spekular di tutup bagasi, dan pantulan hijau tipis di bemper — semuanya
 *     jatuh dari ATAS-KIRI, aturan cahaya yang sama dengan seluruh sistem.
 *   - Pendar latar tepat di tengah bikin komposisinya mati. Sekarang digeser
 *     ke atas-kiri.
 *
 * Platnya sendiri sengaja TETAP tegak lurus dan di tengah — itu justru yang
 * sedang diajarkan; memiringkannya demi gaya akan mengajarkan hal yang salah.
 *
 * Tetap SVG inline seperti `ScanHero` dan `TutorialArt`: warnanya ikut token
 * tema, tidak menambah permintaan jaringan, dan tajam di kepadatan layar mana
 * pun.
 */
const GREEN = '#aded1f';
const EDGE = '#3d5160';
const LAMP = '#e0574f';

export function PlateCaptureArt({ className }: { className?: string }) {
  const id = 'plate-guide';
  return (
    <svg
      viewBox="0 0 320 180"
      className={className}
      role="img"
      aria-label="Panduan memotret plat nomor: plat memenuhi bingkai, tegak lurus, dan terbaca jelas"
    >
      <defs>
        <linearGradient id={`${id}-paint`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#33454f" />
          <stop offset="45%" stopColor="#1d2b35" />
          <stop offset="100%" stopColor="#0f171e" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#22323d" />
          <stop offset="55%" stopColor="#131e26" />
          <stop offset="100%" stopColor="#0b1218" />
        </linearGradient>
        <linearGradient id={`${id}-bumper`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#243440" />
          <stop offset="100%" stopColor="#131c24" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={GREEN} stopOpacity="0" />
          <stop offset="28%" stopColor={GREEN} stopOpacity="0.85" />
          <stop offset="62%" stopColor={GREEN} stopOpacity="0.32" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-spec`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-lamp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0837a" />
          <stop offset="100%" stopColor="#a8322c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="30%" cy="24%" r="78%">
          <stop offset="0%" stopColor={GREEN} stopOpacity="0.2" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-lampglow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={LAMP} stopOpacity="0.5" />
          <stop offset="100%" stopColor={LAMP} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-shadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={GREEN} stopOpacity="0" />
          <stop offset="50%" stopColor={GREEN} stopOpacity="0.8" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="320" height="180" fill="#0f1720" />
      {/* Pendar merek datang dari atas-kiri, bukan dari tengah — komposisi yang
          simetris sempurna itu yang membuat versi pertamanya terasa mati. */}
      <ellipse cx="104" cy="46" rx="196" ry="128" fill={`url(#${id}-glow)`} />

      {/* Bayangan di lantai, memberi pijakan */}
      <ellipse cx="160" cy="166" rx="118" ry="13" fill={`url(#${id}-shadow)`} />

      {/* ---------- Buritan kendaraan ---------- */}
      <g>
        {/* Kaca belakang, menyempit ke atas */}
        <path
          d="M96 42h128l16 34H80z"
          fill={`url(#${id}-glass)`}
          stroke={EDGE}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Bodi: tutup bagasi + sisi */}
        <path
          d="M46 150V92c0-10 6-16 16-16h196c10 0 16 6 16 16v58z"
          fill={`url(#${id}-paint)`}
          stroke={EDGE}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Kilau tepi di atap — sumber cahaya atas-kiri */}
        <path
          d="M46 94c0-10 6-16 16-16h196c10 0 16 6 16 16"
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Sorot spekular di tutup bagasi — inilah yang memberi kesan cat */}
        <path d="M62 84h148l-28 28H62z" fill={`url(#${id}-spec)`} />

        {/* Lampu belakang: rumah lampu, garis lensa, dan pendarnya */}
        <g>
          <ellipse cx="74" cy="107" rx="36" ry="24" fill={`url(#${id}-lampglow)`} />
          <ellipse cx="246" cy="107" rx="36" ry="24" fill={`url(#${id}-lampglow)`} />
          <path
            d="M50 96h36c4 0 6 2 6 6v10c0 4-2 6-6 6H50z"
            fill={`url(#${id}-lamp)`}
            stroke="#7d211d"
            strokeWidth="1"
          />
          <path
            d="M270 96h-36c-4 0-6 2-6 6v10c0 4 2 6 6 6h36z"
            fill={`url(#${id}-lamp)`}
            stroke="#7d211d"
            strokeWidth="1"
          />
          {/* Garis lensa — detail kecil yang membedakan lampu dari balok merah */}
          <g stroke="#ffd7d2" strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round">
            <path d="M56 103h30" />
            <path d="M56 112h26" />
            <path d="M264 103h-30" />
            <path d="M264 112h-26" />
          </g>
        </g>

        {/* Garis sambungan tutup bagasi */}
        <path d="M46 126h228" stroke={EDGE} strokeWidth="1.2" opacity="0.75" />

        {/* Bemper */}
        <path
          d="M46 126h228v18c0 4-3 6-7 6H53c-4 0-7-2-7-6z"
          fill={`url(#${id}-bumper)`}
          stroke={EDGE}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Pantulan hijau tipis di bemper — lantai memantulkan pendar merek */}
        <path d="M62 144h196" stroke={GREEN} strokeWidth="1.6" opacity="0.2" />

        {/* Diffuser & knalpot */}
        <path d="M92 150h136v6H92z" fill="#0b1218" opacity="0.8" />
        <rect
          x="100"
          y="150"
          width="18"
          height="5"
          rx="2.5"
          fill="#0b1218"
          stroke={EDGE}
          strokeWidth="0.9"
        />
        <rect
          x="202"
          y="150"
          width="18"
          height="5"
          rx="2.5"
          fill="#0b1218"
          stroke={EDGE}
          strokeWidth="0.9"
        />
      </g>

      {/* ---------- Plat: terang, tegak lurus, memenuhi kurung bidik ---------- */}
      <g>
        {/* Ceruk plat, supaya platnya duduk DI DALAM bodi bukan menempel */}
        <rect x="106" y="86" width="108" height="38" rx="5" fill="#0b1218" opacity="0.6" />
        <rect x="110" y="89" width="100" height="32" rx="4" fill="#eef3f6" />
        <rect
          x="110"
          y="89"
          width="100"
          height="32"
          rx="4"
          fill="none"
          stroke="#aebbc4"
          strokeWidth="1.1"
        />
        {/* Baut plat — detail kecil, tapi ini yang membuatnya terbaca sebagai
            benda nyata dan bukan kotak putih. */}
        <circle cx="119" cy="105" r="1.7" fill="#9aa9b2" />
        <circle cx="201" cy="105" r="1.7" fill="#9aa9b2" />
        {/* Format plat Indonesia, bukan "ABC-1234" seperti foto stok lama. */}
        <text
          x="160"
          y="111"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontSize="15"
          fontWeight="700"
          letterSpacing="0.6"
          fill="#0f1720"
        >
          B 1234 ABC
        </text>
      </g>

      {/* Kurung bidik memeluk plat — inilah yang diajarkan halaman ini */}
      <g fill="none" stroke={GREEN} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M96 96V85a5 5 0 0 1 5-5h11" />
        <path d="M224 96V85a5 5 0 0 0-5-5h-11" />
        <path d="M96 114v11a5 5 0 0 0 5 5h11" />
        <path d="M224 114v11a5 5 0 0 1-5 5h-11" />
      </g>

      {/* Sapuan pindai lewat DI BAWAH plat, bukan menyeberanginya — versi
          pertama memotong tulisan platnya dan justru mengurangi keterbacaan
          hal yang sedang diajarkan. */}
      <rect x="70" y="135" width="180" height="2" fill={`url(#${id}-sweep)`} />

      {/* Siku jendela bidik — menggantikan kotak polos yang terasa kaku */}
      <g fill="none" stroke={EDGE} strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
        <path d="M12 34V18a6 6 0 0 1 6-6h16" />
        <path d="M308 34V18a6 6 0 0 0-6-6h-16" />
        <path d="M12 146v16a6 6 0 0 0 6 6h16" />
        <path d="M308 146v16a6 6 0 0 1-6 6h-16" />
      </g>
      {/* Titik bidik — penanda kecil bahwa kameranya sedang aktif */}
      <circle cx="160" cy="20" r="2.6" fill={GREEN} opacity="0.7" />
    </svg>
  );
}

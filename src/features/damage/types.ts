export type DamageSide = 'front' | 'back' | 'left' | 'right';

export interface DamageItem {
  damage_image: string;
  description: string;
  position: string;
  severity: string;
  severity_score: number;
}

export interface EstimationItem {
  change_severity: string;
  damage_image: string;
  description: string;
  part_name: string;
  price_estimation: string;
}

export interface DamageResult {
  repair: {
    avgSeverityPerSide: Record<DamageSide, number>;
    detail: Record<DamageSide, DamageItem[]>;
    percentage: number;
    severity: string;
    /*
     * Ringkasan yang TETAP dikirim walau laporannya belum dibayar.
     *
     * `detail` disensor server saat belum dibayar, jadi menghitungnya dari situ
     * selalu menghasilkan nol — dan layar hasil akan bilang "0 titik" pada
     * kendaraan yang jelas-jelas penyok. Dua angka ini dihitung server SEBELUM
     * menyensor: jumlahnya bukan isi laporan, justru itu yang membuat orang
     * tahu ada apa di balik kunci.
     */
    damagePointCount: number;
    affectedSides: number;
  };
  estimation: {
    items: EstimationItem[];
    totalPrice: string;
  };
  createdAt: string;
  /** Tiket inferensi (untuk membuka detail setelah bayar). */
  ticket?: string;
  /** Plat kendaraan sumber inference, dipakai untuk memulihkan status asuransi setelah refresh. */
  plateNumber?: string;
  /** True jika backend sudah menandai laporan AI untuk ticket ini sebagai terbayar/terbuka. */
  reportUnlocked?: boolean;
  /**
   * True bila angkanya TIDAK berasal dari analisis foto sungguhan — mesin
   * `/assess` sedang mati sehingga backend mengundi angkanya, atau mode uji
   * kerusakan ringan sedang menyala. Dipakai untuk memasang label DATA DUMMY.
   *
   * Tanpa label ini, angka dadu dan angka sungguhan terlihat persis sama di
   * layar. Begitu `/assess` hidup kembali, penanda ini berhenti terkirim dan
   * labelnya hilang sendiri.
   */
  isMock?: boolean;
  /** Alasan angka ditandai palsu, dari backend. Ditampilkan sebagai keterangan. */
  mockNote?: string;
}

/** Ringkasan input scan yang dikirim untuk dianalisis. */
export interface DamageSubmission {
  plateNumber: string | null;
  /** Foto plat — wajib untuk inference backend (dipetakan ke field plate_image). */
  plateImage?: Blob | null;
  sides: Array<{ id: string; damaged: boolean | null; image?: Blob | null }>;
  /**
   * Untuk apa pemindaian ini dilakukan.
   *
   * Dikirim ke server karena mode pengujian "kerusakan ringan" HANYA berlaku
   * untuk penilaian kelayakan beli polis. Analisis kerusakan biasa dan klaim
   * tetap memakai hasil apa adanya — memaksa keduanya jadi ringan akan membuat
   * pengujian klaim menghasilkan angka yang tidak mungkin diperiksa.
   */
  purpose?: 'standard' | 'insurance_purchase';
}

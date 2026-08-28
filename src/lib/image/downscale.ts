/**
 * Mengecilkan foto sebelum diunggah.
 *
 * Foto dari kamera ponsel sekarang lazim 3–5 MB. Untuk foto kendaraan yang
 * hanya dipakai sebagai latar kartu berukuran beberapa ratus piksel, itu jauh
 * berlebihan: daftar berisi empat kendaraan berarti belasan megabyte diunduh
 * ulang tiap kali halaman dibuka — berat sekali di jaringan seluler.
 *
 * Dikecilkan di ponsel, bukan di server, supaya beban unggahnya ikut turun.
 * Pengguna dengan koneksi lambat justru yang paling diuntungkan.
 */
const MAX_EDGE = 1280;
const QUALITY = 0.82;

export async function downscaleImage(file: File): Promise<File> {
  // Bukan gambar raster (mis. SVG) — biarkan apa adanya daripada menghasilkan
  // berkas rusak.
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));

    // Sudah cukup kecil. Tidak dikompres ulang, karena mengompres ulang JPEG
    // menurunkan mutu tanpa menghemat banyak.
    if (scale === 1) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    // Browser lama atau format yang tidak terbaca: kirim aslinya. Lebih baik
    // berat daripada gagal sama sekali.
    return file;
  }
}

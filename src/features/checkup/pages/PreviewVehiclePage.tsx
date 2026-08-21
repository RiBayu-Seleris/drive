import { useEffect, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { confirm } from '@/components/feedback/confirm';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import { isInsuranceScan, useScanStore } from '@/features/vehicle-scan/store/scanStore';
import type { CapturedImage } from '@/features/vehicle-scan/types';
import { analyzeDamage } from '@/features/damage/api/damageApi';
import { useDamageStore } from '@/features/damage/store/damageStore';

/**
 * Sidik jari isi pemindaian: plat + foto plat + foto tiap sisi.
 *
 * Memakai `url` (object URL) tiap foto, bukan isinya. Object URL dibuat sekali
 * per pengambilan gambar, jadi memotret ulang satu sisi saja sudah mengubah
 * sidik jarinya — persis yang diinginkan: analisis ulang hanya bila memang ada
 * yang berubah. Membandingkan isi blob akan jauh lebih mahal tanpa hasil yang
 * lebih benar.
 */
function scanSignature(
  plateNumber: string | null,
  plateImage: CapturedImage | null,
  sides: Array<{ id: string; damaged: boolean | null; photo?: CapturedImage | null }>,
): string {
  const parts = [plateNumber ?? '', plateImage?.url ?? ''];
  for (const side of sides) {
    parts.push(`${side.id}:${side.damaged ?? ''}:${side.photo?.url ?? ''}`);
  }
  return parts.join('|');
}

export function PreviewVehiclePage() {
  const navigate = useNavigate();
  const plate = useScanStore((s) => s.plate);
  const sides = useScanStore((s) => s.sides);
  const scanPurpose = useScanStore((s) => s.scanPurpose);
  const answerSide = useScanStore((s) => s.answerSide);
  const setSidePhoto = useScanStore((s) => s.setSidePhoto);
  const clearSidePhoto = useScanStore((s) => s.clearSidePhoto);
  const setResult = useDamageStore((s) => s.setResult);
  const setAnalyzing = useDamageStore((s) => s.setAnalyzing);
  const lastResult = useDamageStore((s) => s.result);
  const lastSignature = useDamageStore((s) => s.analyzedSignature);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<number | null>(null);
  const [pendingCapture, setPendingCapture] = useState<CapturedImage | null>(null);
  // Alur foto 4 sisi berlaku untuk kedua jalur asuransi (beli & darurat).
  const insuranceMode = isInsuranceScan(scanPurpose);

  // Refresh halaman menghapus scan state (plat + foto) karena store hanya di
  // memori. Samakan dengan webapp lama: beri tahu lalu wajib foto plat dari awal.
  useEffect(() => {
    if (plate.image) return;
    let active = true;
    void confirm({
      title: 'Foto Plat Tidak Ditemukan',
      message: 'Silakan ambil ulang foto plat kendaraan untuk melanjutkan proses.',
      confirmText: 'Ambil Foto Plat',
      hideCancel: true,
    }).then(() => {
      if (active) {
        navigate(ROUTES.licensePlate, { replace: true, state: { autoOpenCamera: true } });
      }
    });
    return () => {
      active = false;
    };
  }, [plate.image, navigate]);

  const handleSubmit = async () => {
    if (insuranceMode && !sides.every((side) => side.photo)) {
      toast.error(
        'Foto semua sisi kendaraan wajib diambil untuk membeli asuransi dari Bantuan Darurat.',
      );
      return;
    }

    // Foto yang persis sama tidak dianalisis ulang.
    //
    // Tombol ini dulu selalu mengirim ulang, jadi user yang bolak-balik
    // melihat hasilnya (hasil → kembali → hasil) melahirkan pemindaian baru
    // tiap kali — satu kendaraan menumpuk belasan catatan identik, dan tiap
    // pengulangan membebani layanan AI tanpa menghasilkan apa pun yang baru.
    const signature = scanSignature(plate.number, plate.image, sides);
    if (lastResult && lastSignature && lastSignature === signature) {
      navigate(ROUTES.damageAnalysis);
      return;
    }

    setIsSubmitting(true);
    setAnalyzing(true);
    try {
      const result = await analyzeDamage({
        plateNumber: plate.number,
        plateImage: plate.image?.blob ?? null,
        sides: sides.map((s) => ({ id: s.id, damaged: s.damaged, image: s.photo?.blob ?? null })),
        purpose: scanPurpose,
      });
      setResult(result, signature);
      if (insuranceMode && result.repair.percentage <= 0) {
        navigate(ROUTES.insuranceSearch, { state: { requiresDamageFreeScan: true } });
      } else {
        navigate(ROUTES.damageAnalysis);
      }
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menganalisis kerusakan.'));
    } finally {
      setIsSubmitting(false);
      setAnalyzing(false);
    }
  };

  const openCamera = (index: number) => {
    setSelectedSide(index);
    setPendingCapture(null);
    setCameraOpen(true);
  };

  const handleCapture = (image: CapturedImage) => {
    setCameraOpen(false);
    if (selectedSide !== null) setPendingCapture(image);
  };

  const usePendingCapture = () => {
    if (selectedSide !== null && pendingCapture) {
      if (!insuranceMode) {
        answerSide(selectedSide, true);
      }
      setSidePhoto(selectedSide, pendingCapture);
    }
    setPendingCapture(null);
    setSelectedSide(null);
  };

  const retakePendingCapture = () => {
    setPendingCapture(null);
    setCameraOpen(true);
  };

  const cancelPendingCapture = () => {
    setPendingCapture(null);
    setSelectedSide(null);
  };

  const handleDeletePhoto = async (index: number, label: string) => {
    const approved = await confirm({
      title: 'Hapus Foto',
      message: `Hapus foto ${label}? Jika bagian ini rusak, Anda bisa mengambil foto ulang setelahnya.`,
      confirmText: 'Hapus Foto',
      tone: 'danger',
    });
    if (!approved) return;
    if (insuranceMode) {
      clearSidePhoto(index);
    } else {
      answerSide(index, false);
    }
    if (selectedSide === index) {
      setPendingCapture(null);
      setCameraOpen(false);
      setSelectedSide(null);
    }
  };

  return (
    <PageContainer>
      <div className="flex w-full flex-col items-center overflow-y-auto p-6 pb-28 text-center text-neutral-800">
        <button type="button" onClick={() => navigate(ROUTES.home)}>
          <Logo className="[&_img]:h-10" />
        </button>
        <h3 className="mt-5 text-xl leading-tight font-semibold text-neutral-900">
          Pratinjau Hasil Foto Kendaraan
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-700">
          Lihat dan foto ulang jika hasil foto kerusakan kurang terlihat
        </p>

        <div className="mt-6 grid w-full grid-cols-1 gap-4">
          {sides.map((side, index) => (
            <div key={side.id} className="flex flex-col items-start rounded-xl">
              <p className="text-deep-blue-500 text-start text-xs font-medium">{side.label}</p>
              {side.photo ? (
                <div className="mt-2 flex w-full flex-col text-start">
                  <img
                    src={side.photo.url}
                    alt={side.label}
                    className="h-[200px] w-full rounded-lg object-cover"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openCamera(index)}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#C7CEE2] bg-white px-3 text-xs font-medium text-deep-blue-500 transition active:scale-[0.98]"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      Foto Ulang
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePhoto(index, side.label)}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 transition active:scale-[0.98]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Hapus Foto
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openCamera(index)}
                  className="mt-2 flex h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#C7CEE2] bg-[#EDEFF680] text-xs text-gray-500 transition-all duration-150 active:scale-95 active:border-[#A0AEC0] active:bg-[#D1D5DB]"
                >
                  <p className="text-deep-blue-500 text-xs">Tidak ada kerusakan pada bagian ini</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Jika mengalami kerusakan, klik disini untuk mengambil foto
                  </p>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-neutral-300 bg-white px-4 py-5 text-xs text-neutral-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <Button onClick={handleSubmit} isLoading={isSubmitting}>
          Lanjut Analisis Kerusakan
        </Button>
      </div>

      <CameraCapture
        open={cameraOpen}
        facingMode="environment"
        guideText="Foto bagian kendaraan"
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
      />

      {pendingCapture ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 px-4 py-5 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-white p-4 text-left shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-neutral-900">Gunakan Foto Ini?</h4>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                  Periksa hasil foto sebelum mengganti foto kendaraan yang tersimpan.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelPendingCapture}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-600"
                aria-label="Tutup pratinjau foto"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <img
              src={pendingCapture.url}
              alt="Pratinjau foto kendaraan"
              className="mt-4 h-[320px] w-full rounded-lg bg-neutral-100 object-contain"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={retakePendingCapture}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#C7CEE2] bg-white px-3 text-xs font-semibold text-deep-blue-500 transition active:scale-[0.98]"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Foto Ulang
              </button>
              <button
                type="button"
                onClick={usePendingCapture}
                className="h-11 rounded-lg bg-[#1E4D7B] px-3 text-xs font-semibold text-white transition active:scale-[0.98]"
              >
                Gunakan Foto
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

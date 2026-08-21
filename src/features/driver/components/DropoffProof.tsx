import { useState } from 'react';
import { Camera, CheckCircle2, Info, RotateCcw } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { uploadFilePublic } from '@/lib/upload/publicUpload';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import type { CapturedImage } from '@/features/vehicle-scan/types';
import { driverDestinationLabel } from '../types';
import type { DriverTask } from '../types';

type AngleId = 'front' | 'rear';

const ANGLES: { id: AngleId; label: string; hint: string }[] = [
  { id: 'front', label: 'Serong depan-kiri', hint: 'Tampak depan & sisi kiri' },
  { id: 'rear', label: 'Serong belakang-kanan', hint: 'Tampak belakang & sisi kanan' },
];

/**
 * Foto bukti serah-terima saat sopir menurunkan kendaraan di tujuan.
 *
 * DUA sudut serong, bukan empat sisi dan bukan video. Dua sudut sudah mencakup
 * keempat sisi bodi sehingga bisa disandingkan dengan foto 4 sisi yang diambil
 * user saat pemindaian di lokasi kejadian — dari situ ketahuan apakah ada
 * kerusakan yang muncul selama pengangkutan. Video dihindari karena sopir
 * berada di pinggir jalan dengan sinyal seadanya; berkas puluhan MB gampang
 * gagal terunggah, dan bukti yang gagal terunggah sama dengan tidak ada.
 */
export function DropoffProof({
  task,
  onBack,
  onDone,
}: {
  task: DriverTask;
  onBack: () => void;
  /** Dipanggil dengan URL kedua foto yang sudah terunggah. */
  onDone: (frontUrl: string, rearUrl: string) => Promise<void> | void;
}) {
  const [photos, setPhotos] = useState<Record<AngleId, CapturedImage | null>>({
    front: null,
    rear: null,
  });
  const [cameraAngle, setCameraAngle] = useState<AngleId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCapture = (image: CapturedImage) => {
    if (!cameraAngle) return;
    setPhotos((prev) => {
      const previous = prev[cameraAngle];
      if (previous) URL.revokeObjectURL(previous.url);
      return { ...prev, [cameraAngle]: image };
    });
    setCameraAngle(null);
  };

  const handleSubmit = async () => {
    if (!photos.front || !photos.rear) {
      toast.error('Ambil kedua foto sudut kendaraan dulu.');
      return;
    }
    setSubmitting(true);
    try {
      const [frontUrl, rearUrl] = await Promise.all([
        uploadFilePublic(photos.front.blob, 'dropoff_front.jpg'),
        uploadFilePublic(photos.rear.blob, 'dropoff_rear.jpg'),
      ]);
      await onDone(frontUrl, rearUrl);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengunggah foto. Coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="bg-white">
      <AppHeader title="Bukti Serah Terima" onBack={submitting ? undefined : onBack} />
      <div className="flex flex-1 flex-col px-5 py-4">
        <div className="bg-deep-blue-50 text-12 flex items-start gap-2 rounded-lg px-3 py-2.5 text-neutral-700">
          <Info className="text-deep-blue-500 mt-0.5 size-4 shrink-0" />
          <span>
            Foto kendaraan setelah diturunkan di{' '}
            <span className="font-semibold">{driverDestinationLabel(task)}</span>. Dua foto serong
            sudah mencakup keempat sisi bodi.
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {ANGLES.map(({ id, label, hint }) => {
            const photo = photos[id];
            return (
              <div key={id}>
                <p className="text-12 font-semibold text-neutral-900">{label}</p>
                <p className="text-12 text-neutral-600">{hint}</p>
                <button
                  type="button"
                  onClick={() => setCameraAngle(id)}
                  disabled={submitting}
                  className="mt-2 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-400 bg-neutral-100 disabled:opacity-60"
                >
                  {photo ? (
                    <img src={photo.url} alt={label} className="size-full object-cover" />
                  ) : (
                    <span className="text-12 flex flex-col items-center gap-2 text-neutral-600">
                      <Camera className="size-8" />
                      Ambil foto
                    </span>
                  )}
                </button>
                {photo && (
                  <Button
                    variant="ghost"
                    size="md"
                    className="mt-1"
                    leftIcon={<RotateCcw className="size-4" />}
                    disabled={submitting}
                    onClick={() => setCameraAngle(id)}
                  >
                    Ambil ulang
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-12 mt-4 leading-5 text-neutral-500">
          Foto ini dikirim ke pemilik kendaraan sebagai tanda mobilnya sudah sampai, dan dipakai
          bengkel saat mengonfirmasi penerimaan. Foto juga melindungi Anda bila kondisi kendaraan
          dipersoalkan belakangan.
        </p>

        <div className="mt-auto pt-6">
          <Button
            size="lg"
            isLoading={submitting}
            disabled={!photos.front || !photos.rear}
            leftIcon={<CheckCircle2 className="size-5" />}
            onClick={() => void handleSubmit()}
          >
            Kirim & Tandai Tiba
          </Button>
        </div>
      </div>

      <CameraCapture
        open={cameraAngle !== null}
        onClose={() => setCameraAngle(null)}
        onCapture={handleCapture}
        guideText={
          cameraAngle === 'rear'
            ? 'Ambil dari sudut belakang-kanan, seluruh bodi terlihat'
            : 'Ambil dari sudut depan-kiri, seluruh bodi terlihat'
        }
        confirmBeforeCapture
      />
    </PageContainer>
  );
}

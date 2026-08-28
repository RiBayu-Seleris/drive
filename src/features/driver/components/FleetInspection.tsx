import { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Info, RotateCcw, Truck } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { toast } from '@/components/feedback/toast';
import { cn } from '@/lib/utils/cn';
import { extractErrorMessage } from '@/lib/api/client';
import { uploadFilePublic } from '@/lib/upload/publicUpload';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import type { CapturedImage } from '@/features/vehicle-scan/types';
import { submitFleetInspection } from '../api/driverApi';
import type { DriverTask } from '../types';

type SideId = 'front' | 'rear' | 'left' | 'right';

const SIDES: { id: SideId; label: string }[] = [
  { id: 'front', label: 'Depan' },
  { id: 'rear', label: 'Belakang' },
  { id: 'left', label: 'Kiri' },
  { id: 'right', label: 'Kanan' },
];

type Photos = Record<SideId, CapturedImage | null>;
const EMPTY_PHOTOS: Photos = { front: null, rear: null, left: null, right: null };

async function uploadSide(image: CapturedImage | null, name: string): Promise<string> {
  if (!image) return '';
  return uploadFilePublic(image.blob, name);
}

/**
 * Cek kelayakan armada oleh sopir (manual, tanpa AI). Sopir memotret 4 sisi
 * armada towing lalu memutuskan LAYAK (berangkat) atau TIDAK LAYAK (minta ganti
 * armada, wajib beri alasan). Meniru pola foto 4 sisi kendaraan user.
 */
export function FleetInspection({
  task,
  onBack,
  onDone,
}: {
  task: DriverTask;
  onBack: () => void;
  onDone: (verdict: 'FIT' | 'UNFIT') => void;
}) {
  const [photos, setPhotos] = useState<Photos>(EMPTY_PHOTOS);
  const [cameraSide, setCameraSide] = useState<SideId | null>(null);
  const [unfitMode, setUnfitMode] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const takenCount = SIDES.filter((s) => photos[s.id]).length;
  const allTaken = takenCount === SIDES.length;

  const handleCapture = (image: CapturedImage) => {
    if (!cameraSide) return;
    setPhotos((prev) => {
      const prevImage = prev[cameraSide];
      if (prevImage) URL.revokeObjectURL(prevImage.url);
      return { ...prev, [cameraSide]: image };
    });
    setCameraSide(null);
  };

  const handleSubmitFit = async () => {
    if (!allTaken) {
      toast.error('Ambil foto keempat sisi armada dulu.');
      return;
    }
    setSubmitting(true);
    try {
      const [photoFront, photoRear, photoLeft, photoRight] = await Promise.all([
        uploadSide(photos.front, 'fleet_front.jpg'),
        uploadSide(photos.rear, 'fleet_rear.jpg'),
        uploadSide(photos.left, 'fleet_left.jpg'),
        uploadSide(photos.right, 'fleet_right.jpg'),
      ]);
      await submitFleetInspection(task.orderCode, {
        verdict: 'FIT',
        notes: '',
        photoFront,
        photoRear,
        photoLeft,
        photoRight,
      });
      toast.success('Armada dinyatakan layak.');
      onDone('FIT');
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim pemeriksaan armada.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUnfit = async () => {
    if (!reason.trim()) {
      toast.error('Isi alasan armada tidak layak dulu.');
      return;
    }
    setSubmitting(true);
    try {
      const [photoFront, photoRear, photoLeft, photoRight] = await Promise.all([
        uploadSide(photos.front, 'fleet_front.jpg'),
        uploadSide(photos.rear, 'fleet_rear.jpg'),
        uploadSide(photos.left, 'fleet_left.jpg'),
        uploadSide(photos.right, 'fleet_right.jpg'),
      ]);
      await submitFleetInspection(task.orderCode, {
        verdict: 'UNFIT',
        notes: reason.trim(),
        photoFront,
        photoRear,
        photoLeft,
        photoRight,
      });
      toast.success('Laporan armada terkirim ke admin mitra.');
      onDone('UNFIT');
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim laporan armada.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader title="Cek Kelayakan Armada" onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-5 py-5 pb-28">
        <div className="drive-card rounded-2xl p-4 shadow-md">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#131c24] text-[#c2f347]">
              <Truck className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-14 font-bold text-neutral-900">
                {task.fleetPlateNumber || 'Armada towing'}
              </p>
              <p className="text-12 text-neutral-600">
                {task.fleetType || 'Towing'} · #{task.orderCode}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-[#131c24] p-4 text-[#c2f347]">
          <Info className="mt-0.5 size-5 shrink-0" />
          <p className="text-12">
            Foto keempat sisi armada sebelum berangkat. Masalah ringan (mis. ban kurang angin)
            boleh dibereskan dulu lalu tetap tandai <b>Layak</b>. Bila armada tidak bisa berangkat
            (mis. mesin bermasalah), pilih <b>Tidak Layak</b> dan sertakan alasan.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-16 font-bold text-neutral-900">Foto Armada (4 Sisi)</h2>
          <span className="text-12 font-semibold text-[#c2f347]">{takenCount}/4</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SIDES.map((side) => {
            const image = photos[side.id];
            return (
              <button
                key={side.id}
                type="button"
                onClick={() => setCameraSide(side.id)}
                className={cn(
                  'relative flex aspect-[4/3] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed text-center transition',
                  image
                    ? 'border-transparent'
                    : 'border-neutral-300 bg-neutral-200 text-neutral-500 hover:border-[#aded1f]',
                )}
              >
                {image ? (
                  <>
                    <img src={image.url} alt={side.label} className="absolute inset-0 size-full object-cover" />
                    <span className="absolute inset-0 bg-black/25" />
                    <span className="relative z-10 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-11 font-semibold text-[#6ae78b]">
                      <CheckCircle2 className="size-3.5" /> {side.label}
                    </span>
                    <span className="relative z-10 flex items-center gap-1 text-11 font-medium text-white">
                      <RotateCcw className="size-3" /> Ambil ulang
                    </span>
                  </>
                ) : (
                  <>
                    <Camera className="size-6" />
                    <span className="text-12 font-semibold">{side.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {unfitMode && (
          <div className="drive-card rounded-2xl p-4 shadow-md">
            <TextArea
              label="Alasan armada tidak layak"
              rows={3}
              placeholder="Contoh: mesin bermasalah, tidak bisa berangkat"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
      </main>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-neutral-200 bg-neutral-200 px-5 py-4">
        {unfitMode ? (
          <>
            <Button
              variant="danger"
              className="h-12 rounded-2xl"
              leftIcon={<AlertTriangle className="size-5" />}
              isLoading={submitting}
              onClick={handleSubmitUnfit}
            >
              Kirim Laporan Tidak Layak
            </Button>
            <Button
              variant="ghost"
              className="h-11 rounded-2xl"
              disabled={submitting}
              onClick={() => setUnfitMode(false)}
            >
              Batal
            </Button>
          </>
        ) : (
          <>
            <Button
              className="h-12 rounded-2xl"
              leftIcon={<CheckCircle2 className="size-5" />}
              disabled={!allTaken || submitting}
              isLoading={submitting}
              onClick={handleSubmitFit}
            >
              Armada Layak — Berangkat
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-danger text-danger hover:bg-danger/5"
              leftIcon={<AlertTriangle className="size-5" />}
              disabled={submitting}
              onClick={() => setUnfitMode(true)}
            >
              Armada Tidak Layak
            </Button>
          </>
        )}
      </div>

      <CameraCapture
        open={cameraSide !== null}
        facingMode="environment"
        confirmBeforeCapture
        guideText={
          cameraSide ? `Foto sisi ${SIDES.find((s) => s.id === cameraSide)?.label.toLowerCase()}` : undefined
        }
        onClose={() => setCameraSide(null)}
        onCapture={handleCapture}
      />
    </PageContainer>
  );
}

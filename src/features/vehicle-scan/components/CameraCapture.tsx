import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, RefreshCw, RotateCcw, X } from 'lucide-react';
import type { CapturedImage } from '../types';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (image: CapturedImage) => void;
  facingMode?: 'environment' | 'user';
  /** Teks panduan kecil di bawah bingkai (mis. "Posisikan plat di dalam kotak"). */
  guideText?: string;
  /** Tampilkan preview dan tombol "Gunakan Foto" sebelum foto dikirim. */
  confirmBeforeCapture?: boolean;
  confirmLabel?: string;
  retakeLabel?: string;
  /** Bila true, hasil foto hanya berisi area bingkai panduan. */
  cropToGuide?: boolean;
  /** Rasio bingkai panduan. Contoh plat nomor: 3.2. */
  guideFrameAspectRatio?: number;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Akses kamera ditolak. Mohon izinkan akses kamera di browser.';
      case 'NotFoundError':
        return 'Kamera tidak ditemukan pada perangkat ini.';
      case 'NotReadableError':
        return 'Kamera sedang dipakai aplikasi lain.';
      case 'OverconstrainedError':
        return 'Kamera tidak mendukung pengaturan yang diminta.';
      default:
        return 'Tidak dapat mengakses kamera.';
    }
  }
  return 'Browser tidak mendukung akses kamera.';
}

interface SourceCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveGuideCrop(video: HTMLVideoElement, frame: HTMLElement): SourceCrop | null {
  const videoRect = video.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();

  if (
    video.videoWidth <= 0 ||
    video.videoHeight <= 0 ||
    videoRect.width <= 0 ||
    videoRect.height <= 0 ||
    frameRect.width <= 0 ||
    frameRect.height <= 0
  ) {
    return null;
  }

  const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (videoRect.width - renderedWidth) / 2;
  const offsetY = (videoRect.height - renderedHeight) / 2;

  const frameLeft = frameRect.left - videoRect.left;
  const frameTop = frameRect.top - videoRect.top;

  const x1 = clamp((frameLeft - offsetX) / scale, 0, video.videoWidth);
  const y1 = clamp((frameTop - offsetY) / scale, 0, video.videoHeight);
  const x2 = clamp((frameLeft + frameRect.width - offsetX) / scale, 0, video.videoWidth);
  const y2 = clamp((frameTop + frameRect.height - offsetY) / scale, 0, video.videoHeight);
  const sw = x2 - x1;
  const sh = y2 - y1;

  if (sw <= 1 || sh <= 1) return null;

  return {
    sx: x1,
    sy: y1,
    sw,
    sh,
    width: Math.round(sw),
    height: Math.round(sh),
  };
}

export function CameraCapture({
  open,
  onClose,
  onCapture,
  facingMode = 'environment',
  guideText,
  confirmBeforeCapture = false,
  confirmLabel = 'Gunakan Foto',
  retakeLabel = 'Ambil Ulang',
  cropToGuide = false,
  guideFrameAspectRatio,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const guideFrameRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFacing, setCurrentFacing] = useState<'environment' | 'user'>(facingMode);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [pendingImage, setPendingImage] = useState<CapturedImage | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsReady(false);
  }, []);

  const discardPendingImage = useCallback(() => {
    setPendingImage((image) => {
      if (image) URL.revokeObjectURL(image.url);
      return null;
    });
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Browser tidak mendukung akses kamera.');
      return;
    }
    try {
      setError(null);
      setIsReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
        setIsReady(true);
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch {
        /* enumerasi opsional */
      }
    } catch (err) {
      setError(describeError(err));
    }
  }, [currentFacing]);

  // Start/stop kamera mengikuti status open & arah kamera.
  useEffect(() => {
    if (!open) return;
    discardPendingImage();
    void startCamera();
    return () => stopCamera();
  }, [open, startCamera, stopCamera, discardPendingImage]);

  useEffect(() => {
    if (open) return;
    discardPendingImage();
  }, [open, discardPendingImage]);

  const handleClose = useCallback(() => {
    discardPendingImage();
    onClose();
  }, [discardPendingImage, onClose]);

  // Tutup dengan tombol Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose, open]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isReady) return;

    const crop =
      cropToGuide && guideFrameRef.current ? resolveGuideCrop(video, guideFrameRef.current) : null;

    canvas.width = crop?.width ?? video.videoWidth;
    canvas.height = crop?.height ?? video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (crop) {
      ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const image = {
          blob,
          url: URL.createObjectURL(blob),
          dataUrl,
          width: canvas.width,
          height: canvas.height,
          facingMode: currentFacing,
        };
        if (confirmBeforeCapture) {
          setPendingImage(image);
          stopCamera();
          return;
        }
        onCapture(image);
      },
      'image/jpeg',
      0.9,
    );
  }, [confirmBeforeCapture, cropToGuide, currentFacing, isReady, onCapture, stopCamera]);

  const handleRetake = useCallback(() => {
    discardPendingImage();
    void startCamera();
  }, [discardPendingImage, startCamera]);

  const handleUsePhoto = useCallback(() => {
    if (!pendingImage) return;
    const image = pendingImage;
    setPendingImage(null);
    onCapture(image);
  }, [onCapture, pendingImage]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex justify-center bg-black">
      <div className="relative flex h-dvh w-full max-w-[480px] flex-col">
        {/* Video */}
        <div className="relative flex-1 overflow-hidden bg-black">
          {pendingImage ? (
            <img
              src={pendingImage.url}
              alt="Preview foto"
              className="absolute inset-0 size-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Bingkai sudut */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-7">
            <div
              ref={guideFrameRef}
              className={
                guideFrameAspectRatio ? 'relative w-full max-w-[390px]' : 'relative size-full'
              }
              style={guideFrameAspectRatio ? { aspectRatio: guideFrameAspectRatio } : undefined}
            >
              <span className="absolute top-0 left-0 size-14 rounded-tl-2xl border-t-4 border-l-4 border-white" />
              <span className="absolute top-0 right-0 size-14 rounded-tr-2xl border-t-4 border-r-4 border-white" />
              <span className="absolute bottom-0 left-0 size-14 rounded-bl-2xl border-b-4 border-l-4 border-white" />
              <span className="absolute right-0 bottom-0 size-14 rounded-br-2xl border-r-4 border-b-4 border-white" />
            </div>
          </div>

          {/* Tombol tutup */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup kamera"
            className="absolute top-4 left-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <X className="size-6" />
          </button>

          {/* Tombol ganti kamera */}
          {hasMultipleCameras && !pendingImage && (
            <button
              type="button"
              onClick={() => setCurrentFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              aria-label="Ganti kamera"
              className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white"
            >
              <RefreshCw className="size-5" />
            </button>
          )}

          {guideText && !error && !pendingImage && (
            <p className="text-12 absolute inset-x-0 bottom-4 text-center text-white/90">
              {guideText}
            </p>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 text-center text-white">
              <p className="text-14">{error}</p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="bg-deep-blue-500 text-14 rounded-lg px-5 py-2.5 font-semibold"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>

        {/* Kontrol bawah */}
        <div className="flex h-40 items-center justify-center bg-[#131c24] px-5">
          {pendingImage ? (
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-white/40 text-sm font-semibold text-white"
              >
                <RotateCcw className="size-4" />
                {retakeLabel}
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="bg-deep-blue-500 flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-[#10200a]"
              >
                <Check className="size-4" />
                {confirmLabel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={!isReady}
              aria-label="Ambil foto"
              className="flex size-20 items-center justify-center rounded-full bg-neutral-100 p-2 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              <span className="bg-deep-blue-50 flex size-full items-center justify-center rounded-full">
                <Camera className="size-8 text-neutral-800" />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

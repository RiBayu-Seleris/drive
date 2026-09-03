import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocateFixed, Mic, Square, Volume2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { deviceErrorMessage } from '@/lib/utils/deviceError';
import { ROUTES } from '@/app/routes';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { normalizeIDRLabel } from '@/features/damage/api/damageApi';
import { getAccuratePosition } from '@/lib/geo/geolocation';
import { reverseGeocode } from '@/lib/geo/nominatim';
import { transcribeClaimAudio, uploadClaimEvidence } from '../api';
import { useClaimDraftStore } from '../store/claimDraftStore';

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  /** Mengakhiri sesi dan menunggu hasil final. */
  stop: () => void;
  /** Mengakhiri sesi seketika; hasil yang belum final dibuang. */
  abort: () => void;
}

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

// "Bencana Alam" & "Pencurian" sementara dihilangkan: alur klaim ini bertumpu
// pada foto kerusakan 4 sisi, yang tidak mungkin dipenuhi untuk mobil hilang.
// Kembalikan bila alur khusus untuk keduanya sudah tersedia.
const CLAIM_TYPES = ['Kecelakaan', 'Tabrakan', 'Lainnya'];

export function ClaimDetailPage() {
  const navigate = useNavigate();
  const damage = useDamageStore((state) => state.result);
  const policy = useClaimDraftStore((state) => state.policy);
  const draft = useClaimDraftStore();
  const setNarration = useClaimDraftStore((state) => state.setNarration);
  const setIncident = useClaimDraftStore((state) => state.setIncident);

  const [incidentDate, setIncidentDate] = useState(draft.incidentDate);
  const [incidentLocation, setIncidentLocation] = useState(draft.incidentLocation);
  const [claimType, setClaimType] = useState(draft.claimType);
  const [transcript, setTranscript] = useState(draft.transcript);
  const [audioUrl, setAudioUrl] = useState(draft.audioUrl);
  const [source, setSource] = useState<'SERVER_ASR' | 'BROWSER_ASR' | ''>(
    draft.transcriptionSource,
  );
  const [previewUrl, setPreviewUrl] = useState('');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const browserTranscriptRef = useRef('');
  const startingRef = useRef(false);
  const recognitionReleaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  /*
   * Pelepasan mikrofon HANYA saat halaman ditinggalkan.
   *
   * Dulu ini menumpang efek pembersih previewUrl, jadi ia ikut berjalan setiap
   * kali pratinjau rekaman berganti — mematikan perangkat di tengah hidupnya
   * komponen. Kebetulan belum pernah kelihatan karena urutannya selalu pas,
   * tapi itu kebetulan, bukan jaminan.
   */
  useEffect(
    () => () => {
      if (recognitionReleaseRef.current !== null) {
        window.clearTimeout(recognitionReleaseRef.current);
      }
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      // Halaman sudah ditinggalkan; tidak ada lagi yang menunggu hasil final,
      // jadi mikrofon dilepas seketika.
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  if (!policy) {
    return (
      <PageContainer>
        <AppHeader title="Detail Klaim" />
        <div className="p-5">
          <Button onClick={() => navigate(ROUTES.claimSelectPolicy)}>Pilih Polis</Button>
        </div>
      </PageContainer>
    );
  }

  const startRecording = async () => {
    /*
     * Mikrofon, kamera, dan pengenalan suara hanya hidup di konteks aman.
     * Dibuka lewat http://192.168.x.x dari HP, `navigator.mediaDevices` bahkan
     * tidak ada — dan pesan "browser tidak mendukung" mengirim orang mencari
     * jawaban di tempat yang salah, karena browsernya sebenarnya mendukung.
     */
    if (!window.isSecureContext) {
      toast.error(
        'Perekaman suara hanya jalan lewat koneksi aman. Buka aplikasi ini lewat alamat https, bukan http.',
        { duration: 6000 },
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Browser ini tidak mendukung perekaman suara.');
      return;
    }
    // Izin mikrofon butuh waktu; `recording` baru menyala setelah izin turun.
    // Tanpa penjaga ini, dua ketukan cepat melahirkan dua perekam sekaligus dan
    // yang pertama kehilangan pemiliknya — mikrofon menyala terus.
    if (startingRef.current || recorderRef.current) return;
    startingRef.current = true;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const activeStream = stream;
      chunksRef.current = [];
      browserTranscriptRef.current = '';
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => void processRecording(recorder.mimeType || 'audio/webm', activeStream);
      recorderRef.current = recorder;

      const speechWindow = window as SpeechRecognitionWindow;
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = 'id-ID';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let text = browserTranscriptRef.current;
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            if (result?.isFinal && result[0]) text += ` ${result[0].transcript}`;
          }
          browserTranscriptRef.current = text.trim();
          if (text.trim()) setTranscript(text.trim());
        };
        recognition.onerror = () => undefined;
        recognition.onend = () => {
          if (recognitionReleaseRef.current !== null) {
            window.clearTimeout(recognitionReleaseRef.current);
            recognitionReleaseRef.current = null;
          }
          recognitionRef.current = null;
        };
        /*
         * Transkripsi langsung dari browser cuma bonus: kalau mesinnya menolak
         * start (mis. sesi sebelumnya belum benar-benar berhenti), perekaman
         * suaranya tetap harus jalan. Rekaman itu yang jadi bukti klaim.
         */
        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          recognitionRef.current = null;
        }
      }

      recorder.start(500);
      setRecording(true);
    } catch (error) {
      // Mikrofon sudah menyala sebelum kegagalan ini; tanpa dimatikan, lampu
      // rekam di HP tetap hidup padahal tidak ada yang direkam.
      stream?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      toast.error(deviceErrorMessage(error, 'mikrofon'));
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = () => {
    /*
     * `stop()` mengakhiri sesi pengenalan suara tapi menunggu hasil final, dan
     * selama menunggu itu Chrome Android masih memegang mikrofonnya — lampu
     * rekam di HP tetap menyala meski perekaman sudah selesai. Kalau sesinya
     * tidak juga berakhir, `abort()` melepasnya paksa.
     */
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      if (recognitionReleaseRef.current !== null) {
        window.clearTimeout(recognitionReleaseRef.current);
      }
      recognitionReleaseRef.current = window.setTimeout(() => {
        recognitionReleaseRef.current = null;
        if (recognitionRef.current === recognition) {
          recognition.abort();
          recognitionRef.current = null;
        }
      }, 1200);
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const processRecording = async (mimeType: string, stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (blob.size === 0) {
      toast.error('Rekaman suara kosong. Silakan rekam ulang.');
      return;
    }
    setProcessing(true);
    const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const filename = `kronologi.${extension}`;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    try {
      const uploadedUrl = await uploadClaimEvidence(blob, 'claim_audio', filename);
      let finalTranscript = browserTranscriptRef.current.trim();
      let finalSource: 'SERVER_ASR' | 'BROWSER_ASR' = 'BROWSER_ASR';
      /*
       * Kegagalan transkripsi dulu ditelan diam-diam, lalu pengguna diberi
       * pesan "isi manual" — seolah rekamannya yang bermasalah. Padahal
       * penyebabnya bisa jauh lebih spesifik, dan cuma satu di antaranya yang
       * bisa dia perbuat sesuatu.
       */
      let transcriptionIssue: 'none' | 'not_configured' | 'failed' = 'none';
      if (!finalTranscript) {
        try {
          const result = await transcribeClaimAudio(blob, filename);
          finalTranscript = result.text.trim();
          finalSource = 'SERVER_ASR';
        } catch (transcribeError) {
          const status = (transcribeError as { response?: { status?: number } })?.response?.status;
          transcriptionIssue = status === 503 ? 'not_configured' : 'failed';
          finalTranscript = '';
        }
      }
      setAudioUrl(uploadedUrl);
      setSource(finalSource);
      setTranscript(finalTranscript);
      if (finalTranscript) {
        toast.success('Rekaman dan transkripsi berhasil diproses.');
      } else if (transcriptionIssue === 'not_configured') {
        toast.warning(
          'Rekaman tersimpan. Alih suara ke teks belum aktif di server, jadi tulis kronologinya sendiri dulu.',
          { duration: 6000 },
        );
      } else if (transcriptionIssue === 'failed') {
        toast.warning(
          'Rekaman tersimpan, tapi suaranya gagal diubah jadi teks. Tulis kronologinya sendiri, atau rekam ulang di tempat yang lebih sepi.',
          { duration: 6000 },
        );
      } else {
        toast.warning('Rekaman tersimpan. Silakan isi hasil transkripsi secara manual.');
      }
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Rekaman belum dapat diproses.'));
    } finally {
      setProcessing(false);
    }
  };

  const detectCurrentAddress = async () => {
    setLocating(true);
    setLocationAccuracy(null);
    try {
      const position = await getAccuratePosition({ desiredAccuracyM: 15, timeoutMs: 15_000 });
      const found = await reverseGeocode(position.latitude, position.longitude);
      const fallbackAddress = `Koordinat ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
      setIncidentLocation(found?.displayName ?? fallbackAddress);
      setLocationAccuracy(position.accuracy);
      toast.success(`Alamat terdeteksi (akurasi ±${Math.round(position.accuracy)} m).`);
    } catch {
      toast.error('Gagal mendeteksi alamat. Pastikan izin lokasi aktif dan GPS/sinyal bagus.');
    } finally {
      setLocating(false);
    }
  };

  const continueToReview = () => {
    if (!incidentLocation.trim()) {
      toast.warning('Lokasi kejadian wajib diisi.');
      return;
    }
    const finalSource = source || 'BROWSER_ASR';
    if (!audioUrl || transcript.trim().length < 10) {
      toast.warning('Rekam kronologi suara dan pastikan hasil transkripsinya tersedia.');
      return;
    }
    setIncident({ incidentDate, incidentLocation: incidentLocation.trim(), claimType });
    setNarration({ audioUrl, transcript: transcript.trim(), transcriptionSource: finalSource });
    navigate(ROUTES.claimReview);
  };

  const estimatedCost = normalizeIDRLabel(damage?.estimation.totalPrice ?? '0');

  return (
    <PageContainer>
      <AppHeader title="Detail Klaim" />
      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <Card className="space-y-2 text-neutral-800">
          <div className="flex justify-between">
            <span className="text-14">Tanggal kejadian</span>
            <span className="text-14">{incidentDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-14">Estimasi perbaikan</span>
            <span className="text-14">{estimatedCost}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-14">Plat nomor</span>
            <span className="text-14">{policy.vehiclePlate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-14">Nomor polis</span>
            <span className="text-14">{policy.policyNumber}</span>
          </div>
        </Card>

        <Input
          label="Tanggal Kejadian"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={incidentDate}
          onChange={(event) => setIncidentDate(event.target.value)}
          disabled
        />
        <div>
          <Input
            label="Lokasi Kejadian"
            value={incidentLocation}
            onChange={(event) => {
              setIncidentLocation(event.target.value);
              setLocationAccuracy(null);
            }}
            placeholder="Contoh: Jl. Sudirman, Jakarta"
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            isLoading={locating}
            leftIcon={<LocateFixed className="size-4" />}
            onClick={() => void detectCurrentAddress()}
          >
            {locating ? 'Mendeteksi alamat...' : 'Deteksi alamat saat ini'}
          </Button>
          {locationAccuracy !== null && (
            <p className="mt-1 text-xs text-neutral-600">
              Akurasi lokasi sekitar ±{Math.round(locationAccuracy)} meter.
            </p>
          )}
        </div>
        <div>
          <p className="text-14 mb-2 font-medium text-neutral-900">Jenis Klaim</p>
          <div className="flex flex-wrap gap-2">
            {CLAIM_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setClaimType(value)}
                className={`rounded-full border px-3 py-2 text-xs ${claimType === value ? 'border-deep-blue-500 bg-deep-blue-50 text-deep-blue-600' : 'border-neutral-400 text-neutral-700'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-14 mb-2 font-medium text-neutral-900">Kronologi Suara</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={recording ? stopRecording : () => void startRecording()}
              disabled={processing}
              className={`flex size-12 items-center justify-center rounded-full text-[#10200a] ${recording ? 'bg-danger' : 'bg-deep-blue-500'}`}
              aria-label={recording ? 'Hentikan rekaman' : 'Mulai rekaman'}
            >
              {recording ? <Square className="size-5" /> : <Mic className="size-5" />}
            </button>
            <div className="flex-1">
              <p className="text-13 font-medium text-neutral-900">
                {recording
                  ? 'Sedang merekam…'
                  : processing
                    ? 'Memproses transkripsi…'
                    : audioUrl
                      ? 'Rekaman siap'
                      : 'Tekan untuk merekam'}
              </p>
              <p className="text-11 text-neutral-600">
                Gunakan Bahasa Indonesia dan ceritakan kejadian secara runtut.
              </p>
            </div>
            {previewUrl && <Volume2 className="text-deep-blue-500 size-5" />}
          </div>
          {previewUrl && <audio controls src={previewUrl} className="mt-3 w-full" />}
        </div>

        <TextArea
          label="Hasil Transkripsi"
          rows={5}
          value={transcript}
          onChange={(event) => {
            setTranscript(event.target.value);
            if (event.target.value.trim() && !source) setSource('BROWSER_ASR');
          }}
          placeholder="Teks kronologi akan muncul dari rekaman suara"
        />

        <div className="mt-auto pt-2">
          <Button size="lg" disabled={recording || processing} onClick={continueToReview}>
            Review Pengajuan
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

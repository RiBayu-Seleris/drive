import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Pencil, ShieldCheck, Volume2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/feedback/StateViews';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { createClaim } from '../api';
import { claimDocumentsList, useClaimDraftStore } from '../store/claimDraftStore';

const rupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

function parseAmount(value: string): number {
  return Number(value.replace(/[^0-9]/g, '')) || 0;
}

export function ClaimReviewPage() {
  const navigate = useNavigate();
  const damage = useDamageStore((state) => state.result);
  const draft = useClaimDraftStore();
  const documents = claimDocumentsList(draft.documents);
  const policy = draft.policy;
  const inferenceTicket = damage?.ticket ?? draft.inferenceTicket;
  const engineEvidenceComplete =
    draft.engineNumber.trim().length >= 5 && Boolean(draft.engineNumberImageUrl);
  const chassisEvidenceComplete =
    draft.chassisNumber.trim().length >= 5 && Boolean(draft.chassisNumberImageUrl);
  const missingReasons = [
    !policy ? 'Polis belum dipilih.' : '',
    !damage ? 'Hasil estimasi biaya belum tersedia.' : '',
    !inferenceTicket ? 'Tiket hasil analisis kerusakan belum tersedia.' : '',
    documents.length !== 3 ? 'Dokumen KTP, SIM, dan STNK belum lengkap.' : '',
    !draft.engineNumberImageUrl ? 'Foto nomor mesin belum tersedia.' : '',
    draft.engineNumber.trim().length < 5 ? 'Nomor mesin belum lengkap.' : '',
    !draft.chassisNumberImageUrl ? 'Foto nomor rangka/VIN belum tersedia.' : '',
    draft.chassisNumber.trim().length < 5 ? 'Nomor rangka/VIN belum lengkap.' : '',
    !draft.audioUrl ? 'Rekaman kronologi belum tersedia.' : '',
    draft.transcript.trim().length < 10 ? 'Transkripsi kronologi belum lengkap.' : '',
  ].filter(Boolean);
  const completionRoute = !policy
    ? ROUTES.claimSelectPolicy
    : !damage
      ? ROUTES.estimatedCost
      : !inferenceTicket
        ? ROUTES.damageAnalysis
        : documents.length !== 3 || !engineEvidenceComplete || !chassisEvidenceComplete
          ? ROUTES.claimDocuments
          : ROUTES.claimDetail;

  const mutation = useMutation({
    mutationFn: () =>
      createClaim({
        policyNumber: policy!.policyNumber,
        inferenceTicket,
        claimType: draft.claimType,
        vehiclePlate: policy!.vehiclePlate,
        vehicleEngineNumber: draft.engineNumber,
        vehicleEngineNumberImageUrl: draft.engineNumberImageUrl,
        vehicleChassisNumber: draft.chassisNumber,
        vehicleChassisNumberImageUrl: draft.chassisNumberImageUrl,
        description: draft.transcript,
        incidentDate: draft.incidentDate,
        incidentLocation: draft.incidentLocation,
        chronologyAudioUrl: draft.audioUrl,
        transcriptionSource: draft.transcriptionSource as 'SERVER_ASR' | 'BROWSER_ASR',
        documents,
      }),
    onSuccess: (claim) => {
      draft.setSubmittedClaim(claim);
      toast.success(
        claim.status === 'APPROVED'
          ? 'Klaim memenuhi rule dan otomatis disetujui.'
          : 'Klaim berhasil diajukan untuk review.',
      );
      navigate(ROUTES.claimStatus, { replace: true, state: claim });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Klaim gagal diajukan.')),
  });

  if (!policy || !damage || missingReasons.length > 0) {
    return (
      <PageContainer>
        <AppHeader title="Review Klaim" />
        <EmptyState
          title="Data klaim belum lengkap"
          description={missingReasons.join(' ')}
          action={<Button onClick={() => navigate(completionRoute)}>Lengkapi Klaim</Button>}
        />
      </PageContainer>
    );
  }

  const estimate = parseAmount(damage.estimation.totalPrice);
  const covered = Math.min(estimate, policy.coverageAmount);

  return (
    <PageContainer>
      <AppHeader title="Review Klaim" />
      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <div className="bg-deep-blue-500 -mx-5 flex items-center gap-3 px-5 py-4 text-white">
          <ShieldCheck className="size-6" />
          <strong>Pengajuan Klaim Asuransi</strong>
        </div>

        <section>
          <SectionHeading title="Ringkasan Klaim" onEdit={() => navigate(ROUTES.claimDetail)} />
          <Card className="text-12 space-y-2 text-neutral-800">
            <Row label="Tanggal Kejadian" value={draft.incidentDate} />
            <Row label="Estimasi Ditanggung" value={rupiah(covered)} />
            <Row label="Plat Nomor" value={policy.vehiclePlate} />
            <Row label="Nomor Mesin" value={draft.engineNumber} />
            <Row label="Nomor Rangka/VIN" value={draft.chassisNumber} />
            <Row label="Nomor Polis" value={policy.policyNumber} />
            <Row label="Pembayaran" value="Langsung ke bengkel" />
          </Card>
        </section>

        <section>
          <SectionHeading title="Kronologi" onEdit={() => navigate(ROUTES.claimDetail)} />
          <Card className="text-13 whitespace-pre-wrap text-neutral-800">{draft.transcript}</Card>
          {/* Rekaman bisa didengar ulang di sini sebelum klaim dikirim. */}
          {draft.audioUrl && (
            <div className="mt-3">
              <p className="text-12 mb-2 flex items-center gap-2 text-neutral-700">
                <Volume2 className="text-deep-blue-500 size-4" />
                Rekaman suara terlampir
              </p>
              <audio controls src={draft.audioUrl} className="w-full" />
            </div>
          )}
        </section>

        <section>
          <SectionHeading title="Dokumen Pribadi" onEdit={() => navigate(ROUTES.claimDocuments)} />
          <Button
            variant="outline"
            leftIcon={<FileText className="size-5" />}
            onClick={() => navigate(ROUTES.claimDocumentsView)}
          >
            Lihat Dokumen Pribadi
          </Button>
        </section>

        <div className="mt-auto pt-4">
          <Button size="lg" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            Ajukan
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * Judul bagian dengan tombol "Ubah". Tanpa ini user tidak tahu data masih bisa
 * diperbaiki — satu-satunya jalan mundur cuma tombol back yang tidak terlihat.
 */
function SectionHeading({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-16 font-semibold text-neutral-900">{title}</h2>
      <button
        type="button"
        onClick={onEdit}
        className="text-12 text-deep-blue-500 flex items-center gap-1 font-medium"
      >
        <Pencil className="size-3.5" />
        Ubah
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-600">{label}</span>
      <strong className="text-right text-neutral-900">{value}</strong>
    </div>
  );
}

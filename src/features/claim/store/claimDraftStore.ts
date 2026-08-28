import { create } from 'zustand';
import type { InsurancePolicy } from '@/features/insurance/api';
import type { Claim, ClaimDocument, ClaimDocumentType } from '../api';

interface ClaimDraftState {
  policy: InsurancePolicy | null;
  documents: Partial<Record<ClaimDocumentType, ClaimDocument>>;
  engineNumber: string;
  engineNumberImageUrl: string;
  engineNumberOcrConfidence: number | null;
  chassisNumber: string;
  chassisNumberImageUrl: string;
  chassisNumberOcrConfidence: number | null;
  audioUrl: string;
  transcript: string;
  transcriptionSource: 'SERVER_ASR' | 'BROWSER_ASR' | '';
  inferenceTicket: string;
  incidentDate: string;
  incidentLocation: string;
  claimType: string;
  submittedClaim: Claim | null;
  /**
   * Klaim atas mobil yang polisnya masih atas nama orang lain — biasanya
   * pemilik sebelumnya, saat mobil sudah berpindah tangan tapi polisnya belum.
   *
   * Klaim seperti ini TIDAK bisa disetujui otomatis (mesin butuh polis untuk
   * mencocokkan benefit), jadi backend melemparnya ke telaah manual dengan
   * alasan POLICY_REQUIRED. Penanda ini yang membedakannya dari "polis belum
   * dipilih" — keduanya sama-sama tanpa polis, tapi yang satu disengaja.
   */
  policyOwnedByOther: boolean;
  setPolicy: (policy: InsurancePolicy) => void;
  setPolicyOwnedByOther: (value: boolean) => void;
  setDocument: (document: ClaimDocument) => void;
  setEngineEvidence: (values: {
    engineNumber?: string;
    imageUrl?: string;
    confidence?: number | null;
  }) => void;
  setChassisEvidence: (values: {
    chassisNumber?: string;
    imageUrl?: string;
    confidence?: number | null;
  }) => void;
  setNarration: (values: {
    audioUrl: string;
    transcript: string;
    transcriptionSource: 'SERVER_ASR' | 'BROWSER_ASR';
  }) => void;
  setIncident: (values: {
    incidentDate: string;
    incidentLocation: string;
    claimType: string;
  }) => void;
  setInferenceTicket: (ticket: string) => void;
  setSubmittedClaim: (claim: Claim) => void;
  reset: () => void;
}

const initialState = {
  policy: null,
  policyOwnedByOther: false,
  documents: {},
  engineNumber: '',
  engineNumberImageUrl: '',
  engineNumberOcrConfidence: null,
  chassisNumber: '',
  chassisNumberImageUrl: '',
  chassisNumberOcrConfidence: null,
  audioUrl: '',
  transcript: '',
  transcriptionSource: '' as const,
  inferenceTicket: '',
  incidentDate: new Date().toISOString().slice(0, 10),
  incidentLocation: '',
  claimType: 'Kecelakaan',
  submittedClaim: null,
};

export const useClaimDraftStore = create<ClaimDraftState>((set) => ({
  ...initialState,
  setPolicy: (policy) => set({ policy, policyOwnedByOther: false }),
  setPolicyOwnedByOther: (policyOwnedByOther) => set({ policyOwnedByOther, policy: null }),
  setDocument: (document) =>
    set((state) => ({
      documents: { ...state.documents, [document.documentType]: document },
    })),
  setEngineEvidence: (values) =>
    set((state) => ({
      engineNumber:
        values.engineNumber !== undefined
          ? values.engineNumber.toUpperCase().trim()
          : state.engineNumber,
      engineNumberImageUrl:
        values.imageUrl !== undefined ? values.imageUrl : state.engineNumberImageUrl,
      engineNumberOcrConfidence:
        values.confidence !== undefined ? values.confidence : state.engineNumberOcrConfidence,
    })),
  setChassisEvidence: (values) =>
    set((state) => ({
      chassisNumber:
        values.chassisNumber !== undefined
          ? values.chassisNumber.toUpperCase().trim()
          : state.chassisNumber,
      chassisNumberImageUrl:
        values.imageUrl !== undefined ? values.imageUrl : state.chassisNumberImageUrl,
      chassisNumberOcrConfidence:
        values.confidence !== undefined ? values.confidence : state.chassisNumberOcrConfidence,
    })),
  setNarration: (values) => set(values),
  setIncident: (values) => set(values),
  setInferenceTicket: (inferenceTicket) => set({ inferenceTicket }),
  setSubmittedClaim: (submittedClaim) => set({ submittedClaim }),
  reset: () => set({ ...initialState, incidentDate: new Date().toISOString().slice(0, 10) }),
}));

export function claimDocumentsList(
  documents: Partial<Record<ClaimDocumentType, ClaimDocument>>,
): ClaimDocument[] {
  return (['KTP', 'SIM', 'STNK'] as const)
    .map((type) => documents[type])
    .filter((document): document is ClaimDocument => Boolean(document));
}

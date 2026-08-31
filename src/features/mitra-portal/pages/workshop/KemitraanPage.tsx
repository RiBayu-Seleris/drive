import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Handshake, Link2Off, Search, Send } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/TextArea';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/Spinner';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { MitraShell } from '../../components/MitraShell';
import { MitraFab } from '../../components/MitraFab';
import { MitraFilterChips } from '../../components/MitraFilterChips';
import { partnershipStatusLabel, type PartnershipStatus } from '../../partnershipApi';
import {
  getWorkshopPartnershipCandidates,
  getWorkshopPartnerships,
  inviteWorkshopPartnership,
  respondWorkshopPartnership,
  terminateWorkshopPartnership,
  type WorkshopPartnership,
  type WorkshopPartnershipCandidate,
} from '../../workshopPartnershipApi';

const FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'TERMINATED', label: 'Berakhir' },
];

const STATUS_TONE: Record<PartnershipStatus, string> = {
  PENDING: 'bg-warning/12 text-warning',
  ACTIVE: 'bg-green-cust/12 text-green-cust',
  REJECTED: 'bg-danger/12 text-danger',
  TERMINATED: 'bg-neutral-200 text-neutral-600',
};

function dateLabel(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

type NoteAction = { row: WorkshopPartnership; kind: 'REJECT' | 'TERMINATE' };

/**
 * Kemitraan mitra bengkel dengan perusahaan asuransi.
 *
 * Mengikat butuh persetujuan dua pihak — undangan hanya bisa dijawab oleh pihak
 * yang diundang. Keluar boleh sepihak. Hanya kemitraan AKTIF yang membuat
 * bengkel ini direkomendasikan untuk nasabah asuransi tersebut.
 */
export function WorkshopKemitraanPage() {
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState<WorkshopPartnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    getWorkshopPartnerships()
      .then(setRows)
      .catch((error) => {
        // Polling senyap tidak boleh membanjiri layar dengan toast saat sinyal
        // putus-nyambung di lapangan.
        if (!silent) toast.error(extractErrorMessage(error, 'Gagal memuat kemitraan.'));
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const busy = () => showInvite || noteAction !== null;
    const refresh = () => {
      if (document.hidden || busy()) return;
      load(true);
    };
    const intervalId = window.setInterval(refresh, 20000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, showInvite, noteAction]);

  const list = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );

  const activeCount = useMemo(() => rows.filter((row) => row.status === 'ACTIVE').length, [rows]);
  const inboxCount = useMemo(
    () => rows.filter((row) => row.status === 'PENDING' && row.canRespond).length,
    [rows],
  );

  async function handleAccept(row: WorkshopPartnership) {
    const ok = await confirm({
      title: 'Terima kemitraan',
      message: `Terima undangan dari ${row.insurerName || 'asuransi ini'}? Nasabah asuransi tersebut akan diarahkan ke bengkel Anda.`,
      confirmText: 'Terima',
    });
    if (!ok) return;

    setBusyId(row.id);
    try {
      await respondWorkshopPartnership(row.id, 'ACCEPT');
      toast.success('Kemitraan aktif.');
      load();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menerima undangan.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleNoteSubmit() {
    if (!noteAction) return;
    const { row, kind } = noteAction;
    setBusyId(row.id);
    try {
      if (kind === 'REJECT') {
        await respondWorkshopPartnership(row.id, 'REJECT', note.trim());
        toast.success('Undangan ditolak.');
      } else {
        await terminateWorkshopPartnership(row.id, note.trim());
        toast.success('Kemitraan diakhiri.');
      }
      setNoteAction(null);
      load();
    } catch (error) {
      toast.error(
        extractErrorMessage(
          error,
          kind === 'REJECT' ? 'Gagal menolak undangan.' : 'Gagal mengakhiri kemitraan.',
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <MitraShell>
      <AppHeader title="Kemitraan Asuransi" />

      <div className="space-y-4 px-5 pt-4">
        {/*
          Kartu gelap dengan aksen hijau — pola yang dipakai seluruh aplikasi
          ini. Sebelumnya berupa slab hijau terang setinggi penuh dengan baris
          kedua `text-white/70`: putih di atas #aded1f praktis tidak terbaca,
          dan bidang hijau sebesar itu menyilaukan di tema gelap.
        */}
        <div className="drive-card flex items-center gap-3 p-4">
          <span className="drive-chip grid size-11 shrink-0 place-items-center rounded-full">
            <Handshake className="text-deep-blue-500 size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-14 font-semibold text-neutral-900">
              <span className="text-deep-blue-500">{activeCount}</span> kemitraan aktif
            </p>
            <p className="text-12 text-neutral-600">
              {inboxCount > 0
                ? `${inboxCount} undangan menunggu jawaban Anda`
                : 'Nasabah asuransi rekanan diarahkan ke bengkel Anda'}
            </p>
          </div>
        </div>

        <MitraFilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-3 px-5">
        {loading ? (
          <LoadingState label="Memuat kemitraan…" />
        ) : list.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="mx-auto size-9 text-neutral-500" />
            <p className="text-12 mt-3 text-neutral-500">
              {filter === 'all'
                ? 'Belum ada kemitraan asuransi.'
                : 'Tidak ada kemitraan pada filter ini.'}
            </p>
            {filter === 'all' && (
              <p className="text-11 mt-1 text-neutral-400">
                Ajukan kemitraan lewat tombol + di kanan bawah.
              </p>
            )}
          </div>
        ) : (
          list.map((row) => (
            <div key={row.id} className="drive-card rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="bg-deep-blue-50 text-deep-blue-600 grid size-11 shrink-0 place-items-center rounded-full">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-14 truncate font-semibold text-neutral-900">
                    {row.insurerName || `Asuransi #${row.insurerId}`}
                  </p>
                  <p className="text-11 text-neutral-500">
                    {row.initiatedBy === 'WORKSHOP' ? 'Anda mengundang' : 'Mengundang Anda'} ·{' '}
                    {dateLabel(row.terminatedAt || row.respondedAt || row.invitedAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-11 shrink-0 rounded-full px-2.5 py-1 font-medium',
                    STATUS_TONE[row.status],
                  )}
                >
                  {partnershipStatusLabel(row.status)}
                </span>
              </div>

              {row.note && (
                <p className="text-12 mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-neutral-600">
                  {row.note}
                </p>
              )}

              {row.status === 'PENDING' && row.canRespond && (
                <div className="mt-3 flex gap-2 border-t border-neutral-300 pt-3">
                  <Button size="sm" isLoading={busyId === row.id} onClick={() => handleAccept(row)}>
                    Terima
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setNote('');
                      setNoteAction({ row, kind: 'REJECT' });
                    }}
                  >
                    Tolak
                  </Button>
                </div>
              )}

              {row.status === 'PENDING' && !row.canRespond && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-300 pt-3">
                  <span className="text-12 text-neutral-500">Menunggu jawaban asuransi</span>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setNote('');
                      setNoteAction({ row, kind: 'TERMINATE' });
                    }}
                    className="text-12 text-danger shrink-0 font-medium disabled:opacity-50"
                  >
                    Batalkan
                  </button>
                </div>
              )}

              {row.status === 'ACTIVE' && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-300 pt-3">
                  <span className="text-12 text-green-cust font-medium">
                    Direkomendasikan ke nasabahnya
                  </span>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setNote('');
                      setNoteAction({ row, kind: 'TERMINATE' });
                    }}
                    className="text-12 flex shrink-0 items-center gap-1.5 font-medium text-neutral-500 disabled:opacity-50"
                  >
                    <Link2Off className="size-4" />
                    Akhiri
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <MitraFab label="Ajukan Kemitraan" onClick={() => setShowInvite(true)} />

      <InviteSheet
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvited={() => {
          setShowInvite(false);
          load();
        }}
      />

      <Modal
        open={noteAction !== null}
        onClose={() => setNoteAction(null)}
        title={noteAction?.kind === 'REJECT' ? 'Tolak Undangan' : 'Akhiri Kemitraan'}
        variant="sheet"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setNoteAction(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              isLoading={noteAction !== null && busyId === noteAction.row.id}
              onClick={handleNoteSubmit}
            >
              {noteAction?.kind === 'REJECT' ? 'Tolak' : 'Akhiri'}
            </Button>
          </div>
        }
      >
        <p className="text-12 mb-3 text-neutral-600">
          {noteAction?.kind === 'REJECT' ? (
            <>
              Undangan dari{' '}
              <span className="font-semibold text-neutral-900">
                {noteAction.row.insurerName || 'asuransi ini'}
              </span>{' '}
              akan ditolak.
            </>
          ) : (
            <>
              Kemitraan dengan{' '}
              <span className="font-semibold text-neutral-900">
                {noteAction?.row.insurerName || 'asuransi ini'}
              </span>{' '}
              akan berakhir. Nasabahnya tidak lagi diarahkan ke bengkel Anda.
            </>
          )}
        </p>
        <TextArea
          label="Alasan (opsional)"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            noteAction?.kind === 'REJECT' ? 'Contoh: tarif belum sesuai' : 'Contoh: kontrak berakhir'
          }
        />
      </Modal>
    </MitraShell>
  );
}

/** Daftar asuransi yang belum punya relasi PENDING/ACTIVE dengan bengkel ini. */
function InviteSheet({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<WorkshopPartnershipCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      getWorkshopPartnershipCandidates(query.trim())
        .then((rows) => active && setCandidates(rows))
        .catch((error) => {
          if (active) toast.error(extractErrorMessage(error, 'Gagal memuat daftar asuransi.'));
        })
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  async function invite(candidate: WorkshopPartnershipCandidate) {
    setSendingId(candidate.id);
    try {
      await inviteWorkshopPartnership(candidate.id);
      toast.success('Undangan terkirim.');
      onInvited();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim undangan.'));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajukan Kemitraan" variant="sheet">
      <Input
        placeholder="Cari nama asuransi…"
        leftIcon={<Search className="size-5" />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="mt-4 space-y-2">
        {loading ? (
          <LoadingState label="Memuat asuransi…" />
        ) : candidates.length === 0 ? (
          <p className="text-12 py-8 text-center text-neutral-500">
            {query ? 'Tidak ada asuransi yang cocok.' : 'Semua asuransi sudah punya relasi.'}
          </p>
        ) : (
          candidates.map((candidate) => (
            <div key={candidate.id} className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
              <span className="bg-deep-blue-50 text-deep-blue-600 grid size-10 shrink-0 place-items-center rounded-full">
                <Building2 className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-13 truncate font-semibold text-neutral-900">{candidate.name}</p>
                <p className="text-11 truncate text-neutral-500">
                  {candidate.address || 'Alamat belum diisi'}
                </p>
              </div>
              <Button
                size="sm"
                fullWidth={false}
                isLoading={sendingId === candidate.id}
                onClick={() => invite(candidate)}
              >
                <Send className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

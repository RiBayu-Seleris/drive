import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronRight,
  Handshake,
  Link2Off,
  Mail,
  MapPin,
  Phone,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/TextArea';
import { LoadingState } from '@/components/ui/Spinner';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { MitraShell } from '../../components/MitraShell';
import { MitraFab } from '../../components/MitraFab';
import { MitraFilterChips } from '../../components/MitraFilterChips';
import {
  getOwnershipImpact,
  getPartnershipCandidates,
  getTowingPartnerships,
  invitePartnership,
  partnershipStatusLabel,
  respondPartnership,
  terminatePartnership,
  type OwnershipImpact,
  type PartnershipCandidate,
  type PartnershipStatus,
  type TowingPartnership,
} from '../../partnershipApi';

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

/** Dialog catatan untuk aksi yang perlu alasan (tolak / akhiri). */
type NoteAction = { row: TowingPartnership; kind: 'REJECT' | 'TERMINATE' };

/**
 * Konfirmasi undangan kepemilikan eksklusif. Dipisah dari `confirm()` biasa
 * karena keputusannya memutus seluruh kemitraan lain — mitra harus melihat
 * daftar yang ia lepas dan mencentang persetujuan lebih dulu.
 */
type OwnershipPrompt = {
  row: TowingPartnership;
  impacts: OwnershipImpact[];
  loading: boolean;
};

/**
 * Kemitraan mitra towing dengan perusahaan asuransi.
 *
 * Mengikat butuh persetujuan dua pihak — undangan hanya bisa dijawab oleh pihak
 * yang diundang. Keluar boleh sepihak. Hanya kemitraan AKTIF yang membuat mitra
 * ini diprioritaskan saat asuransi tersebut mengirim order derek.
 */
export function KemitraanPage() {
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState<TowingPartnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);
  const [note, setNote] = useState('');
  const [detailRow, setDetailRow] = useState<TowingPartnership | null>(null);
  const [ownershipPrompt, setOwnershipPrompt] = useState<OwnershipPrompt | null>(null);
  const [ownershipAgreed, setOwnershipAgreed] = useState(false);

  // `silent` menyegarkan data tanpa status memuat dan tanpa toast — dipakai
  // polling supaya daftar tidak berkedip dan jaringan putus tidak memunculkan
  // pesan galat berulang tiap 20 detik.
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    getTowingPartnerships()
      .then(setRows)
      .catch((error) => {
        if (!silent) toast.error(extractErrorMessage(error, 'Gagal memuat kemitraan.'));
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Undangan datang dari perangkat lain (portal asuransi) dan sistem ini belum
  // punya kanal push, jadi daftar harus menyegarkan diri. Ditunda selama ada
  // lembar/dialog terbuka agar isinya tidak berubah saat sedang dibaca.
  useEffect(() => {
    const busy = () =>
      showInvite || noteAction !== null || detailRow !== null || ownershipPrompt !== null;
    const refresh = () => {
      if (document.hidden || busy()) return;
      load(true);
    };
    const intervalId = window.setInterval(refresh, 20000);
    // Kembali ke aplikasi setelah berpindah adalah saat paling sering mitra
    // berharap undangan barunya sudah muncul.
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, showInvite, noteAction, detailRow, ownershipPrompt]);

  const list = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );

  const activeCount = useMemo(() => rows.filter((row) => row.status === 'ACTIVE').length, [rows]);
  const inboxCount = useMemo(
    () => rows.filter((row) => row.status === 'PENDING' && row.canRespond).length,
    [rows],
  );

  async function acceptRow(row: TowingPartnership) {
    setBusyId(row.id);
    try {
      await respondPartnership(row.id, 'ACCEPT');
      toast.success(
        row.relationType === 'OWNERSHIP'
          ? 'Anda kini armada eksklusif asuransi ini.'
          : 'Kemitraan aktif.',
      );
      setOwnershipPrompt(null);
      load();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menerima undangan.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAccept(row: TowingPartnership) {
    // Kepemilikan eksklusif memutus semua relasi lain, jadi mitra harus melihat
    // dampaknya lebih dulu — bukan sekadar dialog ya/tidak.
    if (row.relationType === 'OWNERSHIP') {
      setOwnershipAgreed(false);
      setOwnershipPrompt({ row, impacts: [], loading: true });
      try {
        const impacts = await getOwnershipImpact(row.id);
        setOwnershipPrompt((prev) =>
          prev && prev.row.id === row.id ? { ...prev, impacts, loading: false } : prev,
        );
      } catch (error) {
        setOwnershipPrompt(null);
        toast.error(extractErrorMessage(error, 'Gagal memuat dampak kepemilikan.'));
      }
      return;
    }

    const ok = await confirm({
      title: 'Terima kemitraan',
      message: `Terima undangan kemitraan dari ${row.insurerName || 'asuransi ini'}? Order derek dari asuransi tersebut akan diprioritaskan ke Anda.`,
      confirmText: 'Terima',
    });
    if (!ok) return;
    await acceptRow(row);
  }

  function openNote(row: TowingPartnership, kind: NoteAction['kind']) {
    setNote('');
    setNoteAction({ row, kind });
  }

  async function handleNoteSubmit() {
    if (!noteAction) return;
    const { row, kind } = noteAction;
    setBusyId(row.id);
    try {
      if (kind === 'REJECT') {
        await respondPartnership(row.id, 'REJECT', note.trim());
        toast.success('Undangan ditolak.');
      } else {
        await terminatePartnership(row.id, note.trim());
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
        <div className="bg-deep-blue-500 rounded-2xl p-4 text-[#10200a]">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15">
              <Handshake className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-14 font-semibold">{activeCount} kemitraan aktif</p>
              <p className="text-12 text-white/70">
                {inboxCount > 0
                  ? `${inboxCount} undangan menunggu jawaban Anda`
                  : 'Order derek dari asuransi rekanan diprioritaskan ke Anda'}
              </p>
            </div>
          </div>
        </div>

        <MitraFilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-3 px-5">
        {loading ? (
          <LoadingState label="Memuat kemitraan…" />
        ) : list.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="mx-auto size-9 text-neutral-300" />
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
            <PartnershipCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onAccept={() => handleAccept(row)}
              onReject={() => openNote(row, 'REJECT')}
              onTerminate={() => openNote(row, 'TERMINATE')}
              onDetail={() => setDetailRow(row)}
            />
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

      <InsurerDetailSheet
        row={detailRow}
        busy={detailRow !== null && busyId === detailRow.id}
        onClose={() => setDetailRow(null)}
        onAccept={() => {
          const row = detailRow;
          setDetailRow(null);
          if (row) void handleAccept(row);
        }}
        onReject={() => {
          const row = detailRow;
          setDetailRow(null);
          if (row) openNote(row, 'REJECT');
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
              akan berakhir. Anda tidak lagi diprioritaskan untuk order derek dari asuransi
              tersebut.
            </>
          )}
        </p>
        <TextArea
          label="Alasan (opsional)"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            noteAction?.kind === 'REJECT'
              ? 'Contoh: tarif belum sesuai'
              : 'Contoh: kontrak berakhir'
          }
        />
      </Modal>

      <Modal
        open={ownershipPrompt !== null}
        onClose={() => setOwnershipPrompt(null)}
        title="Setujui Armada Eksklusif"
        variant="sheet"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOwnershipPrompt(null)}>
              Batal
            </Button>
            <Button
              disabled={!ownershipAgreed || (ownershipPrompt?.loading ?? false)}
              isLoading={ownershipPrompt !== null && busyId === ownershipPrompt.row.id}
              onClick={() => {
                if (ownershipPrompt) void acceptRow(ownershipPrompt.row);
              }}
            >
              Setuju
            </Button>
          </div>
        }
      >
        {ownershipPrompt?.loading ? (
          <LoadingState label="Memeriksa dampak…" />
        ) : (
          ownershipPrompt && (
            <div className="space-y-3">
              <p className="text-12 text-neutral-600">
                <span className="font-semibold text-neutral-900">
                  {ownershipPrompt.row.insurerName || 'Asuransi ini'}
                </span>{' '}
                menyatakan armada Anda miliknya atau terikat eksklusif dengannya.
              </p>

              {ownershipPrompt.impacts.length > 0 && (
                <div className="bg-danger/8 rounded-xl px-3 py-2.5">
                  <p className="text-12 text-neutral-700">
                    Menyetujui berarti mengakhiri {ownershipPrompt.impacts.length} relasi yang
                    sedang berjalan:
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {ownershipPrompt.impacts.map((impact, index) => (
                      <li
                        key={`${impact.insurerName}-${index}`}
                        className="text-12 text-neutral-900"
                      >
                        •{' '}
                        <span className="font-semibold">
                          {impact.insurerName || 'Asuransi tanpa nama'}
                        </span>
                        <span className="text-neutral-500">
                          {' '}
                          — {impact.relationType === 'OWNERSHIP'
                            ? 'undangan eksklusif'
                            : 'rekanan'}{' '}
                          {impact.status === 'ACTIVE' ? 'aktif' : 'menunggu'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-12 text-neutral-600">
                Setelah ini Anda hanya melayani{' '}
                <span className="font-semibold text-neutral-900">
                  {ownershipPrompt.row.insurerName || 'asuransi tersebut'}
                </span>{' '}
                dan tidak dapat bermitra dengan asuransi lain.
              </p>

              {/* Aplikasi hanya memutus relasi DI SISTEM. Kontrak di luar aplikasi
                  tetap mengikat dan bisa berpenalti — itu urusan mitra sendiri. */}
              <p className="text-12 rounded-xl bg-neutral-50 px-3 py-2 text-neutral-600">
                Pastikan Anda sudah menyelesaikan perjanjian yang masih berjalan dengan asuransi
                tersebut.
              </p>

              {ownershipPrompt.row.agreementRef && (
                <p className="text-12 text-neutral-500">
                  Rujukan perjanjian:{' '}
                  <span className="font-medium text-neutral-700">
                    {ownershipPrompt.row.agreementRef}
                  </span>
                </p>
              )}

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={ownershipAgreed}
                  onChange={(event) => setOwnershipAgreed(event.target.checked)}
                  className="text-deep-blue-600 focus:ring-deep-blue-500 mt-0.5 size-4 shrink-0 rounded border-neutral-300"
                />
                <span className="text-12 text-neutral-700">
                  Saya mengerti dan menyetujui menjadi armada eksklusif.
                </span>
              </label>
            </div>
          )
        )}
      </Modal>
    </MitraShell>
  );
}

function PartnershipCard({
  row,
  busy,
  onAccept,
  onReject,
  onTerminate,
  onDetail,
}: {
  row: TowingPartnership;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onTerminate: () => void;
  onDetail: () => void;
}) {
  const stamp = row.terminatedAt || row.respondedAt || row.invitedAt;

  return (
    <div className="drive-card rounded-2xl p-4">
      {/* Header dapat diketuk agar profil asuransi tetap terjangkau pada semua
          status, bukan hanya saat undangan menunggu jawaban. */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onDetail}
          className="-m-1 flex min-w-0 flex-1 items-start gap-3 rounded-xl p-1 text-left active:bg-neutral-50"
        >
          <span className="bg-deep-blue-50 text-deep-blue-600 grid size-11 shrink-0 place-items-center rounded-full">
            <Building2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-14 block truncate font-semibold text-neutral-900">
              {row.insurerName || `Asuransi #${row.insurerId}`}
            </span>
            <span className="text-11 block text-neutral-500">
              {row.initiatedBy === 'TOWING' ? 'Anda mengundang' : 'Mengundang Anda'} ·{' '}
              {dateLabel(stamp)}
            </span>
          </span>
          <ChevronRight className="mt-3 size-4 shrink-0 text-neutral-300" />
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[14px] font-medium',
              STATUS_TONE[row.status],
            )}
          >
            {partnershipStatusLabel(row.status)}
          </span>
          {row.relationType === 'OWNERSHIP' && (
            <span className="bg-deep-blue-50 text-deep-blue-600 rounded-full px-2.5 py-1 text-[14px] font-medium">
              Eksklusif
            </span>
          )}
        </div>
      </div>

      {row.note && (
        <p className="text-12 mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-neutral-600">
          {row.note}
        </p>
      )}

      {/* Undangan hanya bisa dijawab oleh pihak yang diundang. */}
      {row.status === 'PENDING' && row.canRespond && (
        <div className="mt-3 flex gap-2 border-t border-neutral-300 pt-3">
          <Button size="sm" isLoading={busy} onClick={onAccept}>
            Terima
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onReject}>
            Tolak
          </Button>
          <Button size="sm" variant="ghost" onClick={onDetail}>
            Detail
          </Button>
        </div>
      )}

      {row.status === 'PENDING' && !row.canRespond && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-300 pt-3">
          <span className="text-12 text-neutral-500">Menunggu jawaban asuransi</span>
          <button
            type="button"
            disabled={busy}
            onClick={onTerminate}
            className="text-12 text-danger shrink-0 font-medium disabled:opacity-50"
          >
            Batalkan
          </button>
        </div>
      )}

      {row.status === 'ACTIVE' && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-300 pt-3">
          <span className="text-12 text-green-cust font-medium">
            {row.relationType === 'OWNERSHIP'
              ? 'Armada eksklusif — tidak dapat bermitra dengan asuransi lain'
              : 'Diprioritaskan saat dispatch'}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onTerminate}
            className="text-12 flex shrink-0 items-center gap-1.5 font-medium text-neutral-500 disabled:opacity-50"
          >
            <Link2Off className="size-4" />
            Akhiri
          </button>
        </div>
      )}
    </div>
  );
}

/** Satu baris info dengan ikon; `href` membuatnya jadi tautan aksi (telepon/email/peta). */
function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  href?: string;
}) {
  if (!value) return null;

  const body = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-neutral-400" />
      <span className="min-w-0 flex-1">
        <span className="text-11 block text-neutral-400">{label}</span>
        <span
          className={cn(
            'text-12 block wrap-break-word',
            href ? 'text-deep-blue-600' : 'text-neutral-800',
          )}
        >
          {value}
        </span>
      </span>
    </>
  );

  if (!href) {
    return <div className="flex items-start gap-2.5">{body}</div>;
  }

  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-start gap-2.5 active:opacity-70"
    >
      {body}
    </a>
  );
}

/**
 * Profil asuransi di balik sebuah undangan/kemitraan.
 *
 * Mitra towing perlu tahu siapa yang mengajak sebelum memutuskan, jadi tombol
 * Terima/Tolak ikut disediakan di sini agar tidak perlu menutup dulu. Data
 * sudah ikut pada baris kemitraan sehingga sheet ini tidak memuat ulang apa pun.
 */
function InsurerDetailSheet({
  row,
  busy,
  onClose,
  onAccept,
  onReject,
}: {
  row: TowingPartnership | null;
  busy: boolean;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  if (!row) return null;

  const { insurer } = row;
  const name = row.insurerName || `Asuransi #${row.insurerId}`;
  const canRespond = row.status === 'PENDING' && row.canRespond;
  const hasContact = Boolean(insurer.contactName || insurer.contactEmail || insurer.contactPhone);
  const mapsQuery = [name, insurer.address].filter(Boolean).join(' ');

  return (
    <Modal
      open
      onClose={onClose}
      title="Detail Asuransi"
      variant="sheet"
      footer={
        canRespond ? (
          <div className="flex gap-3">
            <Button variant="outline" disabled={busy} onClick={onReject}>
              Tolak
            </Button>
            <Button isLoading={busy} onClick={onAccept}>
              Terima
            </Button>
          </div>
        ) : (
          <Button variant="outline" fullWidth onClick={onClose}>
            Tutup
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="bg-deep-blue-50 text-deep-blue-600 grid size-12 shrink-0 place-items-center rounded-full">
            <Building2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-14 font-semibold text-neutral-900">{name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {insurer.code && (
                <span className="text-11 rounded-full bg-neutral-200 px-2 py-0.5 font-medium text-neutral-600">
                  {insurer.code}
                </span>
              )}
              <span
                className={cn(
                  'text-11 rounded-full px-2 py-0.5 font-medium',
                  STATUS_TONE[row.status],
                )}
              >
                {partnershipStatusLabel(row.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-neutral-50 p-3">
          <DetailRow
            icon={MapPin}
            label="Alamat"
            value={insurer.address}
            href={
              insurer.address
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
                : undefined
            }
          />
          <DetailRow
            icon={Phone}
            label="Telepon"
            value={insurer.phone}
            href={insurer.phone ? `tel:${insurer.phone}` : undefined}
          />
          <DetailRow
            icon={Mail}
            label="Email"
            value={insurer.email}
            href={insurer.email ? `mailto:${insurer.email}` : undefined}
          />
          {!insurer.address && !insurer.phone && !insurer.email && (
            <p className="text-12 text-neutral-400 italic">
              Asuransi ini belum melengkapi data perusahaan.
            </p>
          )}
        </div>

        <div>
          <p className="text-11 mb-2 font-medium text-neutral-500">Penanggung jawab</p>
          {hasContact ? (
            <div className="space-y-3 rounded-xl bg-neutral-50 p-3">
              <DetailRow
                icon={UserRound}
                label={insurer.contactPosition || 'Kontak'}
                value={insurer.contactName}
              />
              <DetailRow
                icon={Phone}
                label="Telepon PIC"
                value={insurer.contactPhone}
                href={insurer.contactPhone ? `tel:${insurer.contactPhone}` : undefined}
              />
              <DetailRow
                icon={Mail}
                label="Email PIC"
                value={insurer.contactEmail}
                href={insurer.contactEmail ? `mailto:${insurer.contactEmail}` : undefined}
              />
            </div>
          ) : (
            <p className="text-12 rounded-xl bg-neutral-50 p-3 text-neutral-400 italic">
              Kontak PIC belum tersedia.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl bg-neutral-50 p-3">
          <DetailRow
            icon={Handshake}
            label={row.initiatedBy === 'TOWING' ? 'Anda mengundang' : 'Mengundang Anda'}
            value={dateLabel(row.invitedAt)}
          />
          {row.note && <DetailRow icon={Building2} label="Catatan" value={row.note} />}
        </div>
      </div>
    </Modal>
  );
}

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
  const [candidates, setCandidates] = useState<PartnershipCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    // Debounce ringan supaya pencarian tidak menembak tiap ketikan.
    const timer = window.setTimeout(() => {
      getPartnershipCandidates(query.trim())
        .then((items) => {
          if (active) setCandidates(items);
        })
        .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat daftar asuransi.')))
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  async function handleInvite(candidate: PartnershipCandidate) {
    setSendingId(candidate.id);
    try {
      await invitePartnership(candidate.id);
      toast.success('Undangan terkirim. Menunggu jawaban asuransi.');
      onInvited();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim undangan.'));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajukan Kemitraan" variant="sheet">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama asuransi…"
          className="focus:border-deep-blue-500 focus:ring-deep-blue-200 h-11 w-full rounded-lg border border-neutral-300 bg-neutral-200 pr-4 pl-9 text-sm text-neutral-900 shadow-sm transition placeholder:font-light placeholder:text-neutral-600 focus:ring-2 focus:outline-none"
        />
      </div>

      <div className="max-h-[45vh] space-y-2 overflow-y-auto">
        {loading ? (
          <LoadingState label="Memuat asuransi…" />
        ) : candidates.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-12 text-neutral-500">Tidak ada asuransi yang bisa diajukan.</p>
            <p className="text-11 mt-1 text-neutral-400">
              Asuransi yang sudah terhubung atau sedang menunggu jawaban tidak ditampilkan.
            </p>
          </div>
        ) : (
          candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="flex items-center gap-3 rounded-xl border border-neutral-300 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-14 truncate font-medium text-neutral-900">{candidate.name}</p>
                {candidate.address && (
                  <p className="text-11 truncate text-neutral-500">{candidate.address}</p>
                )}
              </div>
              <button
                type="button"
                disabled={sendingId !== null}
                onClick={() => handleInvite(candidate)}
                className="bg-deep-blue-500 text-12 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-[#10200a] transition active:scale-95 disabled:opacity-50"
              >
                <Send className="size-3.5" />
                {sendingId === candidate.id ? 'Mengirim…' : 'Ajukan'}
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

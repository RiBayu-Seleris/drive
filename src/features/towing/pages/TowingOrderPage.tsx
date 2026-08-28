import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Clock, MapPin, Star, Wrench } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { DEFAULT_LOCATION, STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import { LocationPicker, type PickedLocation } from '@/components/map/LocationPicker';
import { buildPath, ROUTES } from '@/app/routes';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import type { RecommendationPlace } from '@/features/workshop/api';
import { createTowingOrder } from '../api/towingApi';

const DROPOFF_OPTIONS = [
  { value: 'WORKSHOP', label: 'Bengkel' },
  { value: 'HOME', label: 'Rumah' },
  { value: 'OTHER', label: 'Lokasi lain' },
];

export function TowingOrderPage() {
  const navigate = useNavigate();
  const routeState = useLocation().state as {
    workshop?: RecommendationPlace;
    claimNumber?: string;
  } | null;
  const selectedWorkshop = routeState?.workshop ?? null;
  const claimNumber = routeState?.claimNumber ?? '';
  const plateNumber = useScanStore((s) => s.plate.number);
  const [pickupAddress, setPickupAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(DEFAULT_LOCATION);
  const [dropoffType, setDropoffType] = useState('WORKSHOP');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Titik dari peta menjadi sumber koordinat; alamat hasil reverse-geocode
  // mengisi field yang masih bisa disunting user (mis. menambah patokan).
  const handlePick = useCallback((location: PickedLocation) => {
    setCoords({ latitude: location.lat, longitude: location.lng });
    setPickupAddress(location.address);
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      createTowingOrder({
        inferenceTicket: storage.getString(STORAGE_KEYS.guestInferenceTicket) ?? '',
        claimNumber,
        pickupAddress,
        pickupLatitude: coords.latitude,
        pickupLongitude: coords.longitude,
        dropoffType,
        dropoffAddress: dropoffType === 'WORKSHOP' ? selectedWorkshop?.address : dropoffAddress,
        dropoffLatitude: dropoffType === 'WORKSHOP' ? selectedWorkshop?.latitude : 0,
        dropoffLongitude: dropoffType === 'WORKSHOP' ? selectedWorkshop?.longitude : 0,
        targetWorkshopId: dropoffType === 'WORKSHOP' ? selectedWorkshop?.id : undefined,
        notes: [plateNumber ? `Plat: ${plateNumber}` : '', notes].filter(Boolean).join('\n'),
      }),
    onSuccess: (order) => {
      toast.success('Permintaan towing dibuat.');
      navigate(buildPath.towingStatus(order.orderCode), { replace: true });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Order towing gagal dibuat.')),
  });

  const requiresWorkshop = dropoffType === 'WORKSHOP';
  const canSubmit = pickupAddress.trim().length > 3 && (!requiresWorkshop || Boolean(selectedWorkshop));

  return (
    <PageContainer>
      <AppHeader title="Pesan Towing" />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div>
          <p className="text-14 mb-1.5 font-medium text-neutral-900">Lokasi penjemputan</p>
          <LocationPicker onPick={handlePick} />
        </div>

        <Input
          label="Detail / patokan lokasi"
          placeholder="Alamat / patokan lokasi Anda"
          leftIcon={<MapPin className="size-5" />}
          value={pickupAddress}
          onChange={(e) => setPickupAddress(e.target.value)}
        />

        <div>
          <p className="text-14 mb-1.5 font-medium text-neutral-900">Tujuan</p>
          <div className="grid grid-cols-3 gap-2">
            {DROPOFF_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDropoffType(opt.value)}
                className={`text-12 rounded-lg border py-2.5 font-medium ${
                  dropoffType === opt.value
                    ? 'border-deep-blue-500 bg-deep-blue-50 text-deep-blue-600'
                    : 'border-neutral-400 text-neutral-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {dropoffType !== 'WORKSHOP' && (
          <Input
            label="Alamat tujuan"
            placeholder="Alamat tujuan"
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
          />
        )}

        {dropoffType === 'WORKSHOP' &&
          (selectedWorkshop ? (
            <div className="drive-card rounded-xl border border-neutral-200 p-4">
              <div className="flex items-start gap-3">
                <span className="bg-deep-blue-50 text-deep-blue-500 grid size-10 shrink-0 place-items-center rounded-lg">
                  <Wrench className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-14 font-semibold text-neutral-900">{selectedWorkshop.name}</p>
                  <p className="text-12 mt-1 text-neutral-600">{selectedWorkshop.address}</p>
                  <div className="text-12 mt-2 flex flex-wrap gap-3 text-neutral-700">
                    <span className="inline-flex items-center gap-1">
                      <Star className="text-warning size-4" /> {selectedWorkshop.rating.toFixed(1)}
                    </span>
                    {selectedWorkshop.distanceKm > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4" /> {selectedWorkshop.distanceKm.toFixed(1)} km
                      </span>
                    )}
                    {selectedWorkshop.estimatedMinutes > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-4" /> {Math.round(selectedWorkshop.estimatedMinutes)} menit
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="drive-card rounded-xl border border-dashed border-neutral-300 p-4 text-center">
              <p className="text-13 font-semibold text-neutral-900">Pilih bengkel tujuan dulu</p>
              <p className="text-12 mt-1 text-neutral-600">
                Detail bengkel akan dipakai sebagai tujuan towing.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => navigate(ROUTES.workshopList)}
              >
                Pilih Bengkel
              </Button>
            </div>
          ))}

        <TextArea
          label="Catatan (opsional)"
          placeholder="Mis. mobil tidak bisa jalan, posisi di basement"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-auto pt-4">
          <Button
            size="lg"
            disabled={!canSubmit}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Cari Derek Sekarang
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

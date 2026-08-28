import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { EmptyState } from '@/components/feedback/StateViews';
import { MapView, type MapMarker } from '@/components/map/MapView';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';
import { submitWorkshopReview, type RecommendationPlace } from '../api';

export function WorkshopReviewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const place = useLocation().state as RecommendationPlace | null;
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      if (!place) throw new Error('Bengkel tidak ditemukan.');
      return submitWorkshopReview(place.id, score, comment);
    },
    onSuccess: async () => {
      if (place) {
        await queryClient.invalidateQueries({ queryKey: ['workshop-reviews', place.id] });
      }
      toast.success('Terima kasih atas ulasan Anda.');
      navigate(-1);
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Ulasan gagal dikirim.')),
  });

  if (!place) {
    return (
      <PageContainer>
        <AppHeader title="Tulis Ulasan" />
        <EmptyState
          title="Bengkel tidak ditemukan"
          description="Buka ulasan dari halaman detail bengkel."
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.workshopList)}>
              Lihat Daftar Bengkel
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const hasCoord =
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    (place.latitude !== 0 || place.longitude !== 0);
  const markers: MapMarker[] = hasCoord
    ? [{ lat: place.latitude, lng: place.longitude, label: place.name, variant: 'destination' }]
    : [];

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />
      {hasCoord && (
        <div className="h-44 w-full shrink-0">
          <MapView center={{ lat: place.latitude, lng: place.longitude }} markers={markers} />
        </div>
      )}

      <div className="flex flex-1 flex-col px-6 pt-6">
        <h1 className="text-deep-blue-600 text-center text-16 font-semibold">{place.name}</h1>
        <p className="mt-1 text-center text-12 text-neutral-700">Tulis Ulasan Anda</p>

        <div className="mt-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} bintang`}
              onClick={() => setScore(value)}
            >
              <Star
                className={cn(
                  'size-9 transition',
                  value <= score ? 'text-warning fill-current' : 'text-neutral-400',
                )}
              />
            </button>
          ))}
        </div>

        <div className="mt-5">
          <TextArea
            rows={5}
            placeholder="Ceritakan pengalaman Anda di bengkel ini…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="mt-auto flex gap-3 py-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Kembali
          </Button>
          <Button
            disabled={score === 0}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Kirim Ulasan
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

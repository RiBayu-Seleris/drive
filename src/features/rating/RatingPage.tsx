import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { userApi, extractErrorMessage } from '@/lib/api/client';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { toast } from '@/components/feedback/toast';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';

interface RatingNavState {
  target_type?: string;
  target_ref?: string;
  title?: string;
}

interface MoodConfig {
  label: string;
  color: string;
}

// Skor 1..5 → label + warna (merah → hijau), sesuai mockup 7.x.
const MOODS: Record<number, MoodConfig> = {
  1: { label: 'Very bad', color: '#e76a6a' },
  2: { label: 'Bad', color: '#e7946a' },
  3: { label: 'Okay', color: '#e7b86a' },
  4: { label: 'Very good', color: '#6ae7c0' },
  5: { label: 'Excellent', color: '#6ae7c0' },
};

/** Wajah yang berubah dari murung (skor rendah) ke senyum (skor tinggi). */
function MoodFace({ score, color }: { score: number; color: string }) {
  // Kontrol mulut: skor 1 melengkung ke atas (murung), skor 5 ke bawah (senyum).
  const mouthControlY = 50 + (score - 1) * 7;
  const mouthPath = `M30 64 Q50 ${mouthControlY} 70 64`;
  return (
    <svg viewBox="0 0 100 100" className="size-28" aria-hidden role="img">
      <circle cx="36" cy="40" r="7" fill={color} />
      <circle cx="64" cy="40" r="7" fill={color} />
      <path d={mouthPath} stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function RatingPage() {
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as RatingNavState;
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

  const mood = score > 0 ? MOODS[score] : null;
  const faceColor = mood?.color ?? '#223039';

  const mutation = useMutation({
    mutationFn: () =>
      userApi.post('/v1/member/ratings', {
        target_type: state.target_type ?? 'app',
        target_ref: state.target_ref ?? 'autoclaim-webapp',
        score,
        comment: comment.trim(),
      }),
    onSuccess: () => {
      toast.success('Terima kasih atas penilaian Anda.');
      navigate(ROUTES.home, { replace: true });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Penilaian gagal dikirim.')),
  });

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />
      <div className="flex flex-1 flex-col px-6 pt-6">
        <h1 className="text-center text-20 font-semibold text-neutral-900">
          {state.title ?? 'Bagaimana Pengalaman anda?'}
        </h1>

        <div className="mt-8 flex flex-col items-center gap-3">
          <MoodFace score={score || 3} color={faceColor} />
          <p className="text-18 font-semibold" style={{ color: faceColor }}>
            {mood?.label ?? 'Pilih penilaian'}
          </p>
        </div>

        {/* Slider 5 posisi */}
        <div className="relative mt-8 px-1">
          <div className="absolute inset-x-1 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-300" />
          <div className="relative flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((value) => {
              const active = value === score;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={MOODS[value]?.label}
                  onClick={() => setScore(value)}
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 border-white transition',
                    active ? 'size-9 shadow-md' : 'size-4',
                  )}
                  style={{ backgroundColor: active ? faceColor : '#223039' }}
                >
                  {active && (
                    <svg viewBox="0 0 100 100" className="size-5" aria-hidden>
                      <path
                        d={`M28 60 Q50 ${50 + (value - 1) * 7} 72 60`}
                        stroke="#fff"
                        strokeWidth="9"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10">
          <TextArea
            rows={4}
            placeholder="Deskripsikan pengalaman anda"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="mt-auto py-6">
          <Button
            size="lg"
            disabled={score === 0}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Kirim
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

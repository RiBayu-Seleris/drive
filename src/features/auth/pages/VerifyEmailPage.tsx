import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { requestEmailOtp, verifyEmailOtp } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import { OtpCodeInput } from '../components/OtpCodeInput';
import {
  CODE_LIFETIME_SECONDS,
  DEFAULT_RESEND_COOLDOWN,
  OTP_CODE_LENGTH,
  focusFirstOtpInput,
  formatClock,
  maskEmail,
} from '../otp';

/** Data yang dibawa dari halaman register / login saat mengarah ke sini. */
export interface VerifyEmailState {
  email: string;
  /** Tujuan setelah verifikasi berhasil (mis. kembali ke hasil analisis). */
  redirect?: string;
  /** false = kode gagal terkirim saat register, user perlu menekan kirim ulang. */
  otpSent?: boolean;
}

function readState(state: unknown): VerifyEmailState | null {
  if (!state || typeof state !== 'object') return null;
  const email = (state as Record<string, unknown>).email;
  if (typeof email !== 'string' || !email.trim()) return null;
  const redirect = (state as Record<string, unknown>).redirect;
  const otpSent = (state as Record<string, unknown>).otpSent;
  return {
    email: email.trim(),
    redirect: typeof redirect === 'string' ? redirect : undefined,
    otpSent: typeof otpSent === 'boolean' ? otpSent : true,
  };
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const state = useMemo(() => readState(location.state), [location.state]);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendIn, setResendIn] = useState(state?.otpSent === false ? 0 : DEFAULT_RESEND_COOLDOWN);
  const [expiresIn, setExpiresIn] = useState(state?.otpSent === false ? 0 : CODE_LIFETIME_SECONDS);

  // Mencegah verifikasi ganda saat auto-submit dan klik tombol beriringan.
  const submittingRef = useRef(false);

  // Tanpa email (mis. halaman dibuka langsung) alur ini tak bisa jalan.
  useEffect(() => {
    if (!state) {
      toast.error('Sesi verifikasi tidak ditemukan. Silakan masuk kembali.');
      navigate(ROUTES.loginUser, { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    focusFirstOtpInput();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (expiresIn <= 0) return;
    const timer = window.setInterval(() => setExpiresIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresIn]);

  const resetCode = useCallback(() => {
    setCode('');
    focusFirstOtpInput();
  }, []);

  const submitCode = useCallback(
    async (value: string) => {
      if (!state || submittingRef.current) return;
      submittingRef.current = true;
      setIsVerifying(true);
      setErrorMessage('');
      try {
        const result = await verifyEmailOtp(state.email, value);
        setSession({
          token: result.token,
          refreshToken: result.refreshToken,
          user: result.user,
        });
        // Tidak pakai toast: konfirmasinya sekarang berupa halaman sukses
        // yang menahan sejenak, supaya user tahu pendaftarannya selesai.
        // Tujuan asal tetap dibawa agar alur yang terpotong bisa dilanjutkan.
        navigate(ROUTES.registerSuccess, {
          replace: true,
          state: { redirect: state.redirect },
        });
      } catch (error) {
        setErrorMessage(extractErrorMessage(error, 'Kode verifikasi salah.'));
        resetCode();
      } finally {
        submittingRef.current = false;
        setIsVerifying(false);
      }
    },
    [state, setSession, navigate, resetCode],
  );

  const handleResend = async () => {
    if (!state || resendIn > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage('');
    try {
      const { cooldownSeconds } = await requestEmailOtp(state.email);
      setResendIn(cooldownSeconds || DEFAULT_RESEND_COOLDOWN);
      setExpiresIn(CODE_LIFETIME_SECONDS);
      resetCode();
      toast.success('Kode verifikasi baru sudah dikirim.');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Gagal mengirim ulang kode.'));
    } finally {
      setIsResending(false);
    }
  };

  if (!state) return null;

  const isExpired = expiresIn <= 0;

  return (
    <AuthLayout
      title="Verifikasi Email"
      subtitle={`Kami mengirim kode 6 digit ke ${maskEmail(state.email)}. Masukkan kodenya untuk menyelesaikan pendaftaran.`}
      footer={
        <button
          type="button"
          className="text-deep-blue-500 font-semibold"
          onClick={() => navigate(ROUTES.loginUser, { replace: true })}
        >
          Kembali ke halaman masuk
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <OtpCodeInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setErrorMessage('');
          }}
          onComplete={(value) => void submitCode(value)}
          disabled={isVerifying}
          hasError={Boolean(errorMessage)}
        />

        {errorMessage && <p className="text-danger text-12 text-center">{errorMessage}</p>}

        <p className="text-12 text-center text-neutral-600">
          {isExpired ? (
            <span className="text-danger">Kode sudah kadaluarsa. Silakan kirim ulang.</span>
          ) : (
            <>
              Kode berlaku <span className="font-semibold">{formatClock(expiresIn)}</span>
            </>
          )}
        </p>

        <Button
          type="button"
          size="lg"
          isLoading={isVerifying}
          disabled={code.length !== OTP_CODE_LENGTH}
          onClick={() => void submitCode(code)}
        >
          Verifikasi
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="md"
          isLoading={isResending}
          disabled={resendIn > 0}
          onClick={() => void handleResend()}
        >
          {resendIn > 0 ? `Kirim ulang kode dalam ${resendIn} detik` : 'Kirim ulang kode'}
        </Button>

        <p className="text-12 text-center leading-5 text-neutral-500">
          Tidak menerima email? Periksa folder spam. Jangan berikan kode ini kepada siapa pun.
        </p>
      </div>
    </AuthLayout>
  );
}

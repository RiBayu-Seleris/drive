import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { toast } from '@/components/feedback/toast';
import { probeAdminLogin, requestEmailOtp } from '../api/authApi';
import type { VerifyEmailState } from '../pages/VerifyEmailPage';
import { useAuthStore } from '../store/authStore';
import { useDriverStore } from '../store/driverStore';
import { isPartnerRejected, PARTNER_REJECTED_MESSAGE, useMitraStore } from '../store/mitraStore';
import type { LoginValues } from '../schemas';

export type LoginMode = 'user' | 'mitra' | 'sopir';

interface LoginOutcome {
  ok: boolean;
  message?: string;
}

function targetForMode(mode: LoginMode, redirectTo?: string): string {
  if (mode === 'mitra') {
    return redirectTo?.startsWith(ROUTES.mitra) ? redirectTo : ROUTES.mitra;
  }
  if (mode === 'sopir') {
    return redirectTo?.startsWith(ROUTES.driver) ? redirectTo : ROUTES.driver;
  }
  return redirectTo && redirectTo !== ROUTES.home ? redirectTo : ROUTES.home;
}

/** Login eksplisit per target akun: user, mitra, atau sopir. */
export function useLogin(mode: LoginMode) {
  const navigate = useNavigate();
  const loginUser = useAuthStore((s) => s.loginUser);
  const setDriverSession = useDriverStore((s) => s.setSession);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values: LoginValues, redirectTo?: string): Promise<LoginOutcome> {
    setIsSubmitting(true);
    try {
      if (mode === 'user') {
        const ok = await loginUser(values.email, values.password);
        if (ok) {
          navigate(targetForMode(mode, redirectTo), { replace: true });
          return { ok: true };
        }

        // Kredensial benar tapi email belum diverifikasi: kirim kode baru lalu
        // arahkan ke layar verifikasi, bukan ditampilkan sebagai login gagal.
        const pendingEmail = useAuthStore.getState().pendingVerificationEmail;
        if (pendingEmail) {
          // Gagal kirim (mis. masih dalam cooldown) tidak menghalangi: kode
          // sebelumnya kemungkinan masih berlaku dan bisa dikirim ulang di sana.
          let otpSent = true;
          try {
            await requestEmailOtp(pendingEmail);
          } catch {
            otpSent = false;
          }
          toast.info('Email Anda belum diverifikasi. Masukkan kode yang kami kirim.');
          const state: VerifyEmailState = {
            email: pendingEmail,
            redirect: redirectTo,
            otpSent,
          };
          navigate(ROUTES.verifyEmail, { replace: true, state });
          return { ok: false };
        }

        return {
          ok: false,
          message: useAuthStore.getState().error ?? 'Email atau kata sandi salah.',
        };
      }

      if (mode === 'mitra') {
        const { outcome, errorMessage } = await probeAdminLogin(values.email, values.password);
        if (!outcome) {
          return { ok: false, message: errorMessage };
        }
        if (isPartnerRejected(outcome.accountStatus)) {
          return { ok: false, message: PARTNER_REJECTED_MESSAGE };
        }
        const accepted = useMitraStore.getState().setSession({
          token: outcome.token,
          name: outcome.name,
          role: outcome.role,
          email: values.email,
        });
        if (!accepted) {
          return { ok: false, message: 'Akun ini bukan akun mitra bengkel atau towing.' };
        }
        navigate(targetForMode(mode, redirectTo), { replace: true });
        return { ok: true };
      }

      const { outcome, errorMessage } = await probeAdminLogin(values.email, values.password);
      if (!outcome) {
        return { ok: false, message: errorMessage };
      }
      if (outcome.role !== 'towing_driver') {
        return { ok: false, message: 'Akun ini bukan akun sopir towing.' };
      }
      setDriverSession(outcome.token, outcome.name);
      navigate(targetForMode(mode, redirectTo), { replace: true });
      return { ok: true };
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}

import { z } from 'zod';

const booleanEnv = z.enum(['true', 'false']).transform((value) => value === 'true');

function envString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

/**
 * Validasi environment variable saat startup. Kalau ada yang salah, app gagal
 * cepat dengan pesan jelas alih-alih error misterius di runtime ("Very Safety").
 */
const envSchema = z.object({
  VITE_API_AUTOCLAIM_BASE_URL: z.preprocess(
    envString,
    z.string().url('VITE_API_AUTOCLAIM_BASE_URL harus URL valid'),
  ),
  VITE_API_CHANNEL: z.preprocess(envString, z.string().min(1).default('cust_mobile_app')),
  VITE_USE_MOCK_SERVICES: booleanEnv.default('true'),
  VITE_USE_MOCK_SCAN_SERVICES: booleanEnv.optional(),
  VITE_USE_MOCK_DAMAGE_ANALYSIS: booleanEnv.optional(),
  VITE_USE_MOCK_INSURANCE_CHECK: booleanEnv.optional(),
  VITE_SELERIS_UPLOAD_URL: z
    .string()
    .url('VITE_SELERIS_UPLOAD_URL harus URL valid')
    .default('https://api-gateway.seleris.id/v1/seleris-credit-cover/web/upload-file'),
  /** Server routing untuk garis rute yang mengikuti jalan. Default = server demo OSRM. */
  VITE_OSRM_BASE_URL: z.preprocess(
    envString,
    z.string().url('VITE_OSRM_BASE_URL harus URL valid').default('https://router.project-osrm.org'),
  ),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Konfigurasi environment tidak valid:\n${issues}`);
}

const data = parsed.data;

/** Buang trailing slash agar penggabungan dengan path bersih dan konsisten. */
const normalizedBaseUrl = data.VITE_API_AUTOCLAIM_BASE_URL.replace(/\/+$/, '');

export const env = {
  apiBaseUrl: normalizedBaseUrl,
  apiChannel: data.VITE_API_CHANNEL,
  /** Saat true, fitur yang backend-nya belum siap memakai implementasi mock. */
  useMockServices: data.VITE_USE_MOCK_SERVICES,
  /** Toggle khusus OCR/upload supaya bisa real tanpa memaksa payment ikut real. */
  useMockScanServices: data.VITE_USE_MOCK_SCAN_SERVICES ?? data.VITE_USE_MOCK_SERVICES,
  /** Toggle khusus hasil analisis kerusakan. false = pakai gateway -> AI assess. */
  useMockDamageAnalysis: data.VITE_USE_MOCK_DAMAGE_ANALYSIS ?? data.VITE_USE_MOCK_SERVICES,
  /** Toggle khusus status asuransi plat. true = dummy untuk kebutuhan testing. */
  useMockInsuranceCheck: data.VITE_USE_MOCK_INSURANCE_CHECK ?? data.VITE_USE_MOCK_SERVICES,
  /** Endpoint upload file publik Seleris (tanpa login) untuk foto saat analisis pra-login. */
  selerisUploadUrl: data.VITE_SELERIS_UPLOAD_URL,
  /** Server OSRM untuk rute mengikuti jalan (lihat lib/geo/osrm.ts). */
  osrmBaseUrl: data.VITE_OSRM_BASE_URL.replace(/\/+$/, ''),
  isDev: import.meta.env.DEV,
} as const;

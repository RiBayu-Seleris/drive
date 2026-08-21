import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { ROUTES } from '@/app/routes';

const OPTIONS = [
  {
    image: '/assets/checkup_vehicle/call.png',
    title: 'Hubungi Darurat',
    desc: 'Terhubung dengan polisi/ medis (112)',
    border: 'border-orange-200',
    titleClass: 'text-orange-600',
    href: 'tel:112',
  },
  {
    image: '/assets/checkup_vehicle/hospital.png',
    title: 'Rumah Sakit Terdekat',
    desc: 'Temukan rumah sakit & buka navigasi',
    border: 'border-[#8695C0]',
    titleClass: 'text-[#4B61A1]',
    to: ROUTES.emergencyHospitals,
  },
  {
    image: '/assets/checkup_vehicle/derek.png',
    title: 'Layanan Derek',
    desc: 'Panggil derek resmi mitra asuransi',
    border: 'border-[#059669]',
    titleClass: 'text-[#059669]',
    to: ROUTES.emergencyTowing,
  },
] as const;

export function EmergencyPage() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col justify-center p-6 text-start">
          <button type="button" onClick={() => navigate(ROUTES.home)}>
            <Logo className="mx-auto [&_img]:h-[30px]" />
          </button>

          <img src="/assets/checkup_vehicle/emergency_bg.png" alt="Background Ambulance" />

          <h1 className="mt-10 text-2xl font-bold text-neutral-900">Butuh Bantuan Darurat?</h1>
          <p className="mb-12 leading-relaxed text-neutral-800">
            Kami siap membantu Anda dengan cepat. Pilih layanan yang Anda butuhkan:
          </p>

          <div className="grid grid-cols-2 gap-4">
            {OPTIONS.map((item) => {
              const content = (
                <div
                  className={`rounded-2xl border bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md ${item.border}`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl">
                      <img src={item.image} alt="" className="size-8 object-contain" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`mb-1 text-xs font-semibold ${item.titleClass}`}>
                        {item.title}
                      </h3>
                      <p className="text-[10px] text-gray-600">{item.desc}</p>
                    </div>
                  </div>
                </div>
              );

              if ('href' in item) {
                return (
                  <a key={item.title} href={item.href}>
                    {content}
                  </a>
                );
              }
              return (
                <button key={item.title} type="button" onClick={() => navigate(item.to)}>
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

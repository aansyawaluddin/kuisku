import { redirect } from "next/navigation";
import { BarChart3, Lock, QrCode, ScanLine, ShieldCheck, Timer, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui";
import { getProfile, homeFor } from "@/lib/auth";
import { STAGE, STAGE_ORDER } from "@/lib/utils";

export default async function Home() {
  const profile = await getProfile();
  if (profile?.is_active) redirect(homeFor(profile.role));

  const features = [
    { icon: ScanLine, title: "Scan QR untuk siswa", desc: "Login pakai kartu QR, gabung kelas, dan buka kuis cukup dengan memindai." },
    { icon: Timer, title: "Timer & auto-submit", desc: "Waktu dihitung di server. Jawaban tersimpan otomatis tiap kali dipilih." },
    { icon: Lock, title: "Kunci jawaban aman", desc: "Penilaian dilakukan di database, kunci tidak pernah dikirim ke perangkat siswa." },
    { icon: BarChart3, title: "Analisis N-Gain", desc: "Bandingkan pre-test dan post-test per siswa, lengkap dengan kategori Hake." },
    { icon: Users, title: "Tiga peran", desc: "Superadmin mengelola sistem, mentor mengelola kelas, siswa fokus belajar." },
    { icon: ShieldCheck, title: "KKM & remedial", desc: "Atur nilai ketuntasan, jumlah percobaan, acak soal, dan jadwal buka-tutup." },
  ];

  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <LinkButton href="/login">Masuk</LinkButton>
      </header>

      <section className="relative">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-12 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
            <QrCode className="size-3.5" /> Digitalisasi Quiz Pembelajaran
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            Ukur belajar dari <span className="text-sky-600">awal</span>, <span className="text-amber-500">tengah</span>, hingga <span className="text-emerald-600">akhir</span> materi.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            KuisKu menyatukan pre-test, kuis formatif, dan post-test dalam satu alur materi — siswa tahu langkah berikutnya, mentor melihat perkembangan nyata.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <LinkButton href="/login" size="lg">
              Mulai Sekarang
            </LinkButton>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
            {STAGE_ORDER.map((t, i) => (
              <div key={t} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className={`grid size-9 place-items-center rounded-xl text-sm font-bold text-white ${STAGE[t].dot}`}>{i + 1}</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{STAGE[t].phase}</p>
                    <p className={`font-bold ${STAGE[t].color}`}>{STAGE[t].label}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{STAGE[t].desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200/80 bg-white p-6">
              <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">© {new Date().getFullYear()} KuisKu · Next.js + Supabase</footer>
    </main>
  );
}

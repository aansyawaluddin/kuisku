import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { STAGE, STAGE_ORDER } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-[0.12] invert" />
        <Link href="/" className="relative">
          <Logo light />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Satu materi,
            <br />
            tiga titik ukur.
          </h2>
          <p className="mt-4 text-white/70">Pantau perkembangan belajar dari modal awal hingga ketuntasan dalam satu alur yang rapi.</p>
          <ol className="mt-8 space-y-3">
            {STAGE_ORDER.map((t, i) => (
              <li key={t} className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <span className={`grid size-9 place-items-center rounded-xl text-sm font-bold text-white ${STAGE[t].dot}`}>{i + 1}</span>
                <div>
                  <p className="font-semibold">
                    {STAGE[t].label} <span className="font-normal text-white/50">· {STAGE[t].phase}</span>
                  </p>
                  <p className="text-sm text-white/60">{STAGE[t].desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="relative text-sm text-white/40">© {new Date().getFullYear()} MBG · Media Belajar Gemilang</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Masuk ke akun</h1>
          <p className="mb-8 mt-1 text-slate-500">Superadmin, mentor, dan siswa masuk dari halaman yang sama.</p>
          <LoginForm next={next} initialError={error === "nonaktif" ? "Akun Anda dinonaktifkan." : undefined} />
          <p className="mt-8 text-center text-sm text-slate-500">Belum punya akun? Minta mentor atau admin untuk membuatkannya.</p>
        </div>
      </section>
    </main>
  );
}

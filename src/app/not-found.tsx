import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div>
        <p className="text-7xl font-extrabold tracking-tight text-brand-600">404</p>
        <h1 className="mt-3 text-xl font-bold">Halaman tidak ditemukan</h1>
        <p className="mt-1 text-slate-500">Data mungkin sudah dihapus atau Anda tidak memiliki akses.</p>
        <LinkButton href="/dashboard" className="mt-6">
          Kembali ke Beranda
        </LinkButton>
      </div>
    </main>
  );
}

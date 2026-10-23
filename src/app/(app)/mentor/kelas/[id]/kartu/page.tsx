import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrintButton } from "@/components/print-button";
import { QrInline } from "@/components/qr-display";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kartu Login Siswa" };

export default async function CardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("id, name").eq("id", id).maybeSingle();
  if (!cls) notFound();
  const { data: members } = await supabase.from("class_members").select("profiles!inner(id, full_name, username, nis, login_token)").eq("class_id", id);
  const students = (members ?? [])
    .map((m) => m.profiles as unknown as { id: string; full_name: string; username: string | null; nis: string | null; login_token: string })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div>
      <div className="no-print">
        <PageHeader
          back={{ href: `/mentor/kelas/${id}`, label: cls.name }}
          title="Kartu Login Siswa"
          desc="Siswa dapat login dengan memindai QR pada kartu di halaman masuk. Simpan kartu dengan aman — siapa pun yang memegang kartu bisa masuk ke akun tersebut."
          action={<PrintButton />}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
        {students.map((s) => (
          <div key={s.id} className="flex break-inside-avoid items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4">
            <div className="rounded-xl border border-slate-200 p-2">
              <QrInline value={`KUISKU:LOGIN:${s.login_token}`} size={104} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Kartu Login KuisKu</p>
              <p className="mt-1 text-lg font-extrabold leading-tight">{s.full_name}</p>
              <p className="mt-1 text-sm text-slate-600">Username: <span className="font-mono font-semibold">{s.username}</span></p>
              {s.nis && <p className="text-sm text-slate-600">NIS: {s.nis}</p>}
              <p className="mt-1 text-xs text-slate-500">{cls.name}</p>
            </div>
          </div>
        ))}
      </div>
      {!students.length && <p className="text-slate-500">Belum ada siswa di kelas ini.</p>}
    </div>
  );
}

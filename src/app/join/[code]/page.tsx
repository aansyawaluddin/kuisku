import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { Card, LinkButton } from "@/components/ui";
import { homeFor, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gabung Kelas" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await requireProfile();
  let ok = false;
  let message = "";
  let className = "";

  if (me.role !== "siswa") {
    message = "Tautan gabung kelas hanya untuk akun siswa.";
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("join_class", { p_code: code });
    if (error) message = error.message;
    else {
      ok = true;
      const { data: cls } = await supabase.from("classes").select("name").eq("id", data).single();
      className = cls?.name ?? "";
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm text-center">
        <Logo className="mb-6" />
        <Card className="p-8">
          {ok ? (
            <>
              <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
              <h1 className="mt-4 text-xl font-extrabold">Berhasil bergabung!</h1>
              <p className="mt-1 text-slate-600">Kamu sekarang anggota kelas <b>{className}</b>.</p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto size-14 text-rose-500" />
              <h1 className="mt-4 text-xl font-extrabold">Tidak dapat bergabung</h1>
              <p className="mt-1 text-slate-600">{message}</p>
            </>
          )}
          <LinkButton href={homeFor(me.role)} className="mt-6 w-full">
            Ke Beranda
          </LinkButton>
        </Card>
      </div>
    </main>
  );
}

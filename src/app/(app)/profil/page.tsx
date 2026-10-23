import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { QrDisplay } from "@/components/qr-display";
import { Avatar, Badge, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatDate, ROLE_LABEL } from "@/lib/utils";
import { changeMyPassword, updateMyName } from "./actions";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const me = await requireProfile();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Profil" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="flex items-center gap-4 p-5">
            <Avatar name={me.full_name} className="size-14 text-lg" />
            <div>
              <p className="text-lg font-bold">{me.full_name}</p>
              <p className="text-sm text-slate-500">
                {me.username && <span className="font-mono">@{me.username} · </span>}
                {me.email}
              </p>
              <div className="mt-1 flex gap-2">
                <Badge className="bg-brand-100 text-brand-700">{ROLE_LABEL[me.role]}</Badge>
                <Badge>Bergabung {formatDate(me.created_at, false)}</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Data diri" />
            <ActionForm action={updateMyName} className="space-y-4 p-5">
              <Field label="Nama lengkap">
                <Input name="full_name" defaultValue={me.full_name} required />
              </Field>
              <div className="flex justify-end">
                <SubmitButton>Simpan</SubmitButton>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Ganti password" />
            <ActionForm action={changeMyPassword} resetOnSuccess className="space-y-4 p-5">
              <Field label="Password lama">
                <Input name="current" type="password" required autoComplete="current-password" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password baru">
                  <Input name="next" type="password" minLength={6} required autoComplete="new-password" />
                </Field>
                <Field label="Ulangi password baru">
                  <Input name="confirm" type="password" minLength={6} required autoComplete="new-password" />
                </Field>
              </div>
              <div className="flex justify-end">
                <SubmitButton>Ganti Password</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </div>

        {me.role === "siswa" && me.login_token && (
          <Card className="h-fit">
            <CardHeader title="Kartu login QR" desc="Scan di halaman Masuk untuk login tanpa mengetik password" />
            <div className="space-y-4 p-5">
              <QrDisplay value={`KUISKU:LOGIN:${me.login_token}`} size={200} filename={`kartu-login-${me.username ?? "siswa"}`} showLink={false} caption={me.full_name} />
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Jangan bagikan QR ini. Jika hilang atau tersebar, minta mentor untuk mereset kartu.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

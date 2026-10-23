import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Card, Input, PageHeader } from "@/components/ui";
import { joinClass } from "@/lib/actions/academic";
import { requireProfile } from "@/lib/auth";
import { ScanClient } from "./scan-client";

export const metadata: Metadata = { title: "Scan QR" };

export default async function ScanPage() {
  await requireProfile(["siswa"]);
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Scan QR" desc="Gabung kelas atau buka asesmen langsung dari QR yang ditampilkan mentor." />
      <Card className="p-5">
        <ScanClient />
      </Card>
      <Card className="mt-4 p-5">
        <p className="mb-3 text-sm font-semibold">Kamera bermasalah? Masukkan kode kelas</p>
        <ActionForm action={joinClass} resetOnSuccess className="flex gap-2">
          <Input name="code" required maxLength={8} placeholder="ABC123" className="font-mono uppercase tracking-widest" />
          <SubmitButton pendingText="...">Gabung</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

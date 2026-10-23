"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QrScanner } from "@/components/qr-scanner";
import { joinClassByCode } from "./actions";

/** Menerima: URL KuisKu (/join/KODE, /siswa/kuis/ID, dll), kode kelas 6 karakter. */
export function ScanClient() {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [pending, start] = useTransition();

  function resume() {
    setTimeout(() => setPaused(false), 1500);
  }

  function handle(text: string) {
    setPaused(true);
    const raw = text.trim();
    if (/^KUISKU:LOGIN:/i.test(raw)) {
      toast.info("Ini kartu login. Gunakan di halaman Masuk.");
      return resume();
    }
    try {
      const url = new URL(raw);
      if (url.origin === window.location.origin) {
        router.push(url.pathname + url.search);
        return;
      }
      toast.error("QR ini bukan milik KuisKu");
      return resume();
    } catch {
      // bukan URL
    }
    if (/^[A-Z0-9]{6}$/i.test(raw)) {
      start(async () => {
        const res = await joinClassByCode(raw);
        if (res?.error) {
          toast.error(res.error);
          resume();
        } else {
          toast.success(res?.message ?? "Berhasil bergabung");
          router.push("/siswa");
        }
      });
      return;
    }
    toast.error("QR tidak dikenali");
    resume();
  }

  return (
    <div className="space-y-4">
      <QrScanner onScan={handle} paused={paused} hint="Scan QR kelas atau QR asesmen dari mentor" />
      {pending && (
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-brand-600">
          <Loader2 className="size-4 animate-spin" /> Memproses...
        </p>
      )}
    </div>
  );
}

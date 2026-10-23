"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./ui";

type Props = {
  onScan: (text: string) => void | Promise<void>;
  paused?: boolean;
  hint?: string;
};

/** Pemindai QR / barcode memakai kamera belakang (fallback: pilih gambar). */
export function QrScanner({ onScan, paused, hint }: Props) {
  const regionId = "qr-reader";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!paused) handledRef.current = false;
  }, [paused]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setStatus("starting");
      setError(null);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
          (text: string) => {
            if (handledRef.current) return;
            handledRef.current = true;
            if (navigator.vibrate) navigator.vibrate(80);
            void onScanRef.current(text);
          },
          () => {},
        );
        if (!cancelled) setStatus("running");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        const msg = String((e as Error)?.message ?? e);
        setError(
          /permission|NotAllowed/i.test(msg)
            ? "Izin kamera ditolak. Aktifkan izin kamera di browser, atau pilih gambar QR."
            : /secure|https/i.test(msg)
              ? "Kamera hanya bisa diakses lewat HTTPS atau localhost."
              : "Kamera tidak tersedia. Coba pilih gambar QR dari galeri.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        Promise.resolve()
          .then(() => (s.isScanning ? s.stop() : undefined))
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, [nonce]);

  async function scanFile(file: File) {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const tmp = new Html5Qrcode("qr-file-tmp", { verbose: false });
      const text = await tmp.scanFile(file, false);
      tmp.clear();
      handledRef.current = true;
      await onScanRef.current(text);
    } catch {
      setError("QR tidak terbaca dari gambar. Pastikan gambar jelas dan tidak terpotong.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-ink">
        <div id={regionId} className="size-full [&_video]:size-full" />
        {status !== "running" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
            {status === "error" ? (
              <div className="space-y-3">
                <Camera className="mx-auto size-8 opacity-70" />
                <p>{error}</p>
                <Button size="sm" variant="outline" onClick={() => setNonce((n) => n + 1)}>
                  <RefreshCw className="size-4" /> Coba lagi
                </Button>
              </div>
            ) : (
              <Loader2 className="size-7 animate-spin" />
            )}
          </div>
        )}
        {status === "running" && (
          <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-emerald-400/90" />
          </div>
        )}
      </div>
      <div id="qr-file-tmp" className="hidden" />
      {hint && <p className="text-center text-sm text-slate-500">{hint}</p>}
      {status === "running" && error && <p className="text-center text-sm text-rose-600">{error}</p>}
      <label className="mx-auto flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
        <ImageUp className="size-4" /> Pilih gambar QR
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void scanFile(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

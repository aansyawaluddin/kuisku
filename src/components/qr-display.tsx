"use client";

import { useId, useSyncExternalStore } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui";

/** QR dari path relatif (otomatis memakai origin situs) atau teks mentah. */
export function QrDisplay({
  path,
  value,
  size = 200,
  filename = "qr-kuisku",
  showLink = true,
  caption,
}: {
  path?: string;
  value?: string;
  size?: number;
  filename?: string;
  showLink?: boolean;
  caption?: string;
}) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const id = useId().replace(/:/g, "");
  const text = value ?? (origin ? `${origin}${path}` : "");

  function download() {
    const canvas = document.getElementById(`qr-dl-${id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${filename}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        {text ? <QRCodeSVG value={text} size={size} level="M" marginSize={1} /> : <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-slate-100" />}
      </div>
      {text && <QRCodeCanvas id={`qr-dl-${id}`} value={text} size={720} level="M" marginSize={2} className="hidden" />}
      {caption && <p className="text-center text-sm font-semibold text-ink">{caption}</p>}
      {showLink && path && text && <p className="max-w-[260px] break-all text-center text-xs text-slate-500">{text}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={download} type="button">
          <Download className="size-4" /> Unduh
        </Button>
        {showLink && path && (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(text).then(() => toast.success("Tautan disalin"));
            }}
          >
            <Copy className="size-4" /> Salin
          </Button>
        )}
      </div>
    </div>
  );
}

export function QrInline({ value, size = 96 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} level="M" marginSize={0} />;
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { QrScanner } from "@/components/qr-scanner";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { loginWithPassword, loginWithQr } from "./actions";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [tab, setTab] = useState<"password" | "qr">("password");
  const [state, action, pending] = useActionState(loginWithPassword, initialError ? { error: initialError } : null);
  const [show, setShow] = useState(false);
  const [qrPending, startQr] = useTransition();
  const [paused, setPaused] = useState(false);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {[
          { k: "password", label: "Username & Password", icon: KeyRound },
          { k: "qr", label: "Scan Kartu Siswa", icon: QrCode },
        ].map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k as "password" | "qr")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition",
              tab === t.k ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink",
            )}
          >
            <t.icon className="size-4" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "password" ? (
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div>
            <Label htmlFor="identifier">Username / NIS / Email</Label>
            <Input id="identifier" name="identifier" autoComplete="username" placeholder="contoh: 22101 atau guru@sekolah.id" required autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-10" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 hover:text-ink" aria-label="Tampilkan password">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{state.error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Masuk
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <QrScanner
            paused={paused}
            hint="Arahkan kamera ke QR pada kartu login siswa"
            onScan={(text) => {
              setPaused(true);
              startQr(async () => {
                const res = await loginWithQr(text, next);
                if (res?.error) {
                  toast.error(res.error);
                  setTimeout(() => setPaused(false), 1500);
                }
              });
            }}
          />
          {qrPending && (
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-brand-600">
              <Loader2 className="size-4 animate-spin" /> Memverifikasi kartu...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center text-center">
      <div>
        <h1 className="text-xl font-bold">Terjadi kesalahan</h1>
        <p className="mt-1 max-w-md text-sm text-slate-500">{error.message || "Silakan coba lagi."}</p>
        <Button onClick={reset} className="mt-5">
          Coba lagi
        </Button>
      </div>
    </div>
  );
}

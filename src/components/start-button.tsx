"use client";

import { useActionState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "./ui";
import { startAttempt } from "@/lib/actions/student";

export function StartButton({ assessmentId, label, timed }: { assessmentId: string; label: string; timed: boolean }) {
  const [state, action, pending] = useActionState(startAttempt, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (timed && !confirm("Waktu mulai berjalan setelah kamu menekan Mulai dan tidak bisa dijeda. Siap?")) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="assessment_id" value={assessmentId} />
      {state?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <PlayCircle className="size-5" />} {label}
      </Button>
    </form>
  );
}

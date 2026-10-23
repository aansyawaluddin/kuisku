"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, CloudCheck, CloudOff, Flag, Grid3X3, Loader2, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./modal";
import { Button } from "./ui";
import { createClient } from "@/lib/supabase/client";
import type { AssessmentType, Option } from "@/lib/types";
import { cn, STAGE } from "@/lib/utils";

export type RunnerData = {
  attempt: { id: string; status: string; attempt_no: number; started_at: string; expires_at: string | null; server_now: string };
  assessment: { id: string; type: AssessmentType; title: string; instructions: string | null; material_id: string; material_title: string };
  questions: { id: string; question: string; image_url: string | null; points: number; selected: string | null; options: Option[] }[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

function fmt(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function QuizRunner({ data }: { data: RunnerData }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { attempt, assessment, questions } = data;
  const st = STAGE[assessment.type];
  const doubtKey = `kuisku-ragu-${attempt.id}`;

  const [answers, setAnswers] = useState<Record<string, string | null>>(() => Object.fromEntries(questions.map((q) => [q.id, q.selected])));
  const [doubt, setDoubt] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(doubtKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const [idx, setIdx] = useState(0);
  const [save, setSave] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const submittedRef = useRef(false);
  const pendingSaves = useRef(0);

  // Sinkronisasi jam dengan server
  useEffect(() => {
    const offset = new Date(attempt.server_now).getTime() - Date.now();
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [attempt.server_now]);

  const persistDoubt = (s: Set<string>) => {
    setDoubt(s);
    try {
      localStorage.setItem(doubtKey, JSON.stringify([...s]));
    } catch {}
  };

  const remaining = attempt.expires_at && now !== null ? new Date(attempt.expires_at).getTime() - now : null;

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      // tunggu penyimpanan yang masih berjalan
      for (let i = 0; i < 20 && pendingSaves.current > 0; i++) await new Promise((r) => setTimeout(r, 150));
      submittedRef.current = true;
      setSubmitting(true);
      const { error } = await supabase.rpc("submit_attempt", { p_attempt_id: attempt.id });
      if (error) {
        submittedRef.current = false;
        setSubmitting(false);
        toast.error("Gagal mengumpulkan: " + error.message);
        return;
      }
      try {
        localStorage.removeItem(doubtKey);
      } catch {}
      if (auto) toast.info("Waktu habis — jawaban otomatis dikumpulkan.");
      router.replace(`/siswa/hasil/${attempt.id}`);
      router.refresh();
    },
    [supabase, attempt.id, router, doubtKey],
  );

  // Auto-submit saat waktu habis
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !submittedRef.current) void submit(true);
  }, [remaining, submit]);

  // Peringatan meninggalkan halaman
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) e.preventDefault();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden" && !submittedRef.current) {
        setTimeout(() => toast.warning("Kamu sempat meninggalkan halaman asesmen. Tetap fokus ya!"), 300);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const choose = useCallback(
    async (qid: string, optionId: string | null): Promise<void> => {
      setAnswers((a) => ({ ...a, [qid]: optionId }));
      setSave("saving");
      pendingSaves.current++;
      try {
        for (let attemptNo = 0; attemptNo < 3; attemptNo++) {
          const { error } = await supabase.rpc("save_answer", { p_attempt_id: attempt.id, p_question_id: qid, p_option: optionId });
          if (!error) {
            if (pendingSaves.current === 1) setSave("saved");
            return;
          }
          if (/habis/i.test(error.message)) {
            void submit(true);
            return;
          }
          if (/dikumpulkan/i.test(error.message)) {
            router.replace(`/siswa/hasil/${attempt.id}`);
            return;
          }
          await new Promise((r) => setTimeout(r, 1200));
        }
        setSave("error");
        toast.error("Jawaban gagal tersimpan. Periksa koneksi internet lalu pilih ulang.");
      } finally {
        pendingSaves.current--;
      }
    },
    [supabase, attempt.id, submit, router],
  );

  const q = questions[idx];

  // Pintasan keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmOpen || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(questions.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else {
        const k = e.key.toUpperCase();
        const opt = q?.options.find((o, i) => o.id === k || String(i + 1) === k);
        if (opt && q) void choose(q.id, opt.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, questions.length, choose, confirmOpen]);

  const answeredCount = questions.filter((x) => answers[x.id]).length;
  const unanswered = questions.length - answeredCount;
  const lowTime = remaining !== null && remaining < 60_000;
  const optionLetters = ["A", "B", "C", "D", "E", "F"];

  if (!q) return null;

  const navigator = (
    <div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-5">
        {questions.map((x, i) => {
          const answered = !!answers[x.id];
          const isDoubt = doubt.has(x.id);
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setIdx(i);
                setNavOpen(false);
              }}
              className={cn(
                "relative grid aspect-square place-items-center rounded-lg border text-sm font-bold transition",
                isDoubt ? "border-amber-400 bg-amber-400 text-white" : answered ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-brand-400",
                i === idx && "ring-2 ring-ink ring-offset-2",
              )}
            >
              {i + 1}
              {isDoubt && answered && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-brand-600 ring-2 ring-white" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand-600" /> Dijawab
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-amber-400" /> Ragu-ragu
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-slate-300 bg-white" /> Kosong
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className={cn("hidden rounded-lg px-2 py-1 text-xs font-bold text-white sm:inline", st.dot)}>{st.short}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{assessment.material_title}</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {save === "saving" ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Menyimpan...
                </>
              ) : save === "error" ? (
                <span className="flex items-center gap-1 text-rose-600">
                  <CloudOff className="size-3" /> Gagal menyimpan
                </span>
              ) : save === "saved" ? (
                <>
                  <CloudCheck className="size-3 text-emerald-600" /> Tersimpan
                </>
              ) : (
                <>
                  {answeredCount}/{questions.length} dijawab
                </>
              )}
            </p>
          </div>
          {remaining !== null && (
            <div className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-base font-bold tabular-nums", lowTime ? "animate-pulse bg-rose-600 text-white" : "bg-slate-100 text-ink")}>
              <Timer className="size-4" /> {fmt(remaining)}
            </div>
          )}
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={submitting}>
            <Send className="size-4" /> <span className="hidden sm:inline">Kumpulkan</span>
          </Button>
        </div>
        <div className="h-1 bg-slate-100">
          <div className={cn("h-full transition-all", st.dot)} style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_300px]">
        <main>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">
                Soal {idx + 1} <span className="font-normal">dari {questions.length}</span>
              </span>
              {q.points > 1 && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{q.points} poin</span>}
            </div>
            <p className="whitespace-pre-wrap text-lg font-semibold leading-relaxed text-ink sm:text-xl">{q.question}</p>
            {q.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image_url} alt="Gambar soal" className="mt-4 max-h-80 rounded-2xl border border-slate-200" />
            )}
            <div className="mt-6 space-y-3">
              {q.options.map((o, i) => {
                const selected = answers[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => choose(q.id, selected ? null : o.id)}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99]",
                      selected ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50",
                    )}
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold", selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")}>{optionLetters[i]}</span>
                    <span className={cn("pt-1.5 text-[15px]", selected ? "font-semibold text-ink" : "text-slate-700")}>{o.text}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 hidden text-xs text-slate-400 sm:block">Tips: tekan A–F atau 1–6 untuk memilih, ← → untuk berpindah soal. Klik pilihan yang sama untuk membatalkan.</p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
            <Button
              variant="outline"
              className={cn(doubt.has(q.id) && "border-amber-400! bg-amber-50! text-amber-800! hover:bg-amber-100!")}
              onClick={() => {
                const n = new Set(doubt);
                if (n.has(q.id)) n.delete(q.id);
                else n.add(q.id);
                persistDoubt(n);
              }}
            >
              <Flag className="size-4" /> Ragu-ragu
            </Button>
            <Button variant="outline" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Daftar soal">
              <Grid3X3 className="size-4" />
            </Button>
            {idx < questions.length - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)}>
                <span className="hidden sm:inline">Berikutnya</span> <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
                <Send className="size-4" /> Selesai
              </Button>
            )}
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-5">
            <p className="mb-4 font-bold">Navigasi soal</p>
            {navigator}
          </div>
        </aside>
      </div>

      <Modal title="Daftar soal" open={navOpen} onOpenChange={setNavOpen}>
        {navigator}
      </Modal>

      <Modal title="Kumpulkan jawaban?" open={confirmOpen} onOpenChange={setConfirmOpen}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-brand-50 p-3">
              <p className="text-2xl font-extrabold text-brand-700">{answeredCount}</p>
              <p className="text-xs text-slate-600">Dijawab</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <p className="text-2xl font-extrabold text-amber-700">{doubt.size}</p>
              <p className="text-xs text-slate-600">Ragu-ragu</p>
            </div>
            <div className={cn("rounded-2xl p-3", unanswered ? "bg-rose-50" : "bg-slate-50")}>
              <p className={cn("text-2xl font-extrabold", unanswered ? "text-rose-600" : "text-slate-500")}>{unanswered}</p>
              <p className="text-xs text-slate-600">Kosong</p>
            </div>
          </div>
          {(unanswered > 0 || doubt.size > 0) && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {unanswered > 0 ? `Masih ada ${unanswered} soal yang belum dijawab. ` : ""}
              {doubt.size > 0 ? "Ada soal yang ditandai ragu-ragu." : ""}
            </p>
          )}
          <p className="text-sm text-slate-600">Setelah dikumpulkan, jawaban tidak dapat diubah lagi.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Periksa lagi
            </Button>
            <Button onClick={() => submit(false)} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />} Ya, kumpulkan
            </Button>
          </div>
        </div>
      </Modal>

      {submitting && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="mx-auto size-10 animate-spin text-brand-600" />
            <p className="mt-3 font-semibold">Mengumpulkan & menilai jawaban...</p>
          </div>
        </div>
      )}
    </div>
  );
}

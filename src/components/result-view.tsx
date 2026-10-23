import { Check, CircleSlash, Clock, X } from "lucide-react";
import { Badge, Card } from "./ui";
import type { AssessmentType, Option } from "@/lib/types";
import { cn, formatDate, formatScore, STAGE } from "@/lib/utils";

export type AttemptResult = {
  attempt: {
    id: string;
    status: "in_progress" | "submitted";
    attempt_no: number;
    started_at: string;
    submitted_at: string | null;
    score: number | null;
    passed: boolean | null;
    correct_count: number | null;
    total_questions: number | null;
  };
  assessment: {
    id: string;
    type: AssessmentType;
    title: string;
    passing_score: number;
    max_attempts: number;
    show_score: boolean;
    show_review: boolean;
    material_id: string;
    material_title: string;
  };
  student: { id: string; full_name: string; nis: string | null } | null;
  attempts_used: number;
  is_manager: boolean;
  review:
    | {
        id: string;
        question: string;
        image_url: string | null;
        points: number;
        options: Option[];
        selected: string | null;
        correct: string | null;
        is_correct: boolean;
        explanation: string | null;
      }[]
    | null;
};

function duration(a: string, b: string | null) {
  if (!b) return "-";
  const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m} mnt ${s % 60} dtk` : `${s} dtk`;
}

export function ScoreHero({ r }: { r: AttemptResult }) {
  const s = STAGE[r.assessment.type];
  const score = r.attempt.score;
  const hasScore = score !== null && score !== undefined;
  const isPre = r.assessment.type === "pretest";
  const pct = hasScore ? Number(score) : 0;
  const circ = 2 * Math.PI * 52;

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1.5", s.dot)} />
      <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#eef0f4" strokeWidth="10" />
            {hasScore && (
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                className={r.attempt.passed || isPre ? "stroke-emerald-500" : "stroke-rose-500"}
                strokeDasharray={circ}
                strokeDashoffset={circ - (pct / 100) * circ}
              />
            )}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-4xl font-extrabold tracking-tight">{hasScore ? formatScore(score) : "✓"}</p>
              <p className="text-xs font-semibold text-slate-500">{hasScore ? "Nilai" : "Terkumpul"}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <Badge className={cn("border", s.soft)}>{s.label}</Badge>
          <h2 className="mt-2 text-xl font-extrabold">{r.assessment.material_title}</h2>
          {r.student && r.is_manager && <p className="text-sm text-slate-500">{r.student.full_name}</p>}
          {hasScore ? (
            isPre ? (
              <p className="mt-2 text-slate-600">Ini gambaran kemampuan awalmu. Nilai pre-test tidak menentukan kelulusan — pelajari materinya, lalu buktikan peningkatanmu di post-test!</p>
            ) : r.attempt.passed ? (
              <p className="mt-2 font-semibold text-emerald-700">🎉 Tuntas! Nilai mencapai KKM {r.assessment.passing_score}.</p>
            ) : (
              <p className="mt-2 font-semibold text-rose-700">Belum mencapai KKM {r.assessment.passing_score}. Pelajari lagi bagian yang keliru.</p>
            )
          ) : (
            <p className="mt-2 text-slate-600">Jawabanmu sudah terkumpul. Nilai akan disampaikan oleh mentor.</p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-slate-600 sm:justify-start">
            {r.attempt.correct_count !== null && (
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> {r.attempt.correct_count}/{r.attempt.total_questions} benar
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-slate-400" /> {duration(r.attempt.started_at, r.attempt.submitted_at)}
            </span>
            <span>Percobaan ke-{r.attempt.attempt_no}</span>
            <span>{formatDate(r.attempt.submitted_at)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ReviewList({ review }: { review: NonNullable<AttemptResult["review"]> }) {
  return (
    <div className="space-y-3">
      {review.map((q, i) => (
        <Card key={q.id} className={cn("border-l-4 p-4 sm:p-5", q.is_correct ? "border-l-emerald-500" : q.selected ? "border-l-rose-500" : "border-l-slate-300")}>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
                q.is_correct ? "bg-emerald-100 text-emerald-700" : q.selected ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500",
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap font-medium">{q.question}</p>
              {q.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.image_url} alt="" className="mt-2 max-h-56 rounded-xl border border-slate-200" />
              )}
              <ul className="mt-3 space-y-1.5">
                {q.options.map((o) => {
                  const isCorrect = o.id === q.correct;
                  const isSelected = o.id === q.selected;
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                        isCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-900" : isSelected ? "border-rose-300 bg-rose-50 text-rose-900" : "border-slate-200 text-slate-600",
                      )}
                    >
                      <span className="font-bold">{o.id}.</span>
                      <span className="flex-1">{o.text}</span>
                      {isCorrect && <Check className="size-4 shrink-0 text-emerald-600" />}
                      {isSelected && !isCorrect && <X className="size-4 shrink-0 text-rose-600" />}
                    </li>
                  );
                })}
              </ul>
              {!q.selected && (
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <CircleSlash className="size-3.5" /> Tidak dijawab
                </p>
              )}
              {q.explanation && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">💡 {q.explanation}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

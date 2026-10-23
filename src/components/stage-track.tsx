import { Check, Lock } from "lucide-react";
import type { MaterialProgress } from "@/lib/progress";
import { cn, STAGE, STAGE_ORDER } from "@/lib/utils";

/** Indikator 3 tahap: Pre → Formatif → Post */
export function StageTrack({ progress, compact }: { progress: MaterialProgress; compact?: boolean }) {
  return (
    <div className="flex items-center">
      {STAGE_ORDER.map((t, i) => {
        const s = progress.stages[t];
        const st = STAGE[t];
        const done = s?.submitted;
        const empty = !s || s.status === "empty";
        const locked = s?.status === "locked";
        return (
          <div key={t} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "grid place-items-center rounded-full border-2 font-bold",
                  compact ? "size-7 text-[11px]" : "size-9 text-xs",
                  done ? cn(st.dot, "border-transparent text-white") : empty ? "border-dashed border-slate-200 text-slate-300" : locked ? "border-slate-200 bg-slate-50 text-slate-400" : cn("bg-white", st.color, "border-current"),
                )}
                title={st.label}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : locked ? <Lock className="size-3" /> : i + 1}
              </span>
              {!compact && <span className={cn("text-[11px] font-semibold", done ? st.color : "text-slate-400")}>{st.short}</span>}
            </div>
            {i < 2 && <div className={cn("mx-1 h-0.5 flex-1 rounded", progress.stages[STAGE_ORDER[i]]?.submitted ? "bg-slate-300" : "bg-slate-100", !compact && "mb-5")} />}
          </div>
        );
      })}
    </div>
  );
}

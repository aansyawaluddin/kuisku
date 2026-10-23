import { cn } from "@/lib/utils";

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4 4L19 7" />
        </svg>
        <span className="absolute -right-1 -top-1 flex gap-0.5">
          <span className="size-2 rounded-full bg-sky-400 ring-2 ring-white" />
        </span>
      </span>
      <span className={cn("text-xl font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>
        Kuis<span className="text-brand-500">Ku</span>
      </span>
    </span>
  );
}

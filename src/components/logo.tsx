import { cn } from "@/lib/utils";

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mbg-icon.svg" alt="" className="size-9 rounded-xl shadow-lg shadow-brand-600/30" />
      <span className="flex flex-col leading-none">
        <span className={cn("text-xl font-extrabold tracking-wide", light ? "text-white" : "text-brand-700")}>MBG</span>
        <span className={cn("mt-0.5 text-[10px] font-semibold", light ? "text-white/60" : "text-slate-500")}>Media Belajar Gemilang</span>
      </span>
    </span>
  );
}

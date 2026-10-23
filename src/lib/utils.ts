import { clsx, type ClassValue } from "clsx";
import type { AssessmentType, Role } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadmin",
  mentor: "Mentor",
  siswa: "Siswa",
};

export const STAGE: Record<
  AssessmentType,
  { label: string; short: string; phase: string; desc: string; color: string; soft: string; ring: string; dot: string }
> = {
  pretest: {
    label: "Pre-test",
    short: "Pre",
    phase: "Awal Materi",
    desc: "Mengetahui modal awal / kemampuan dasar",
    color: "text-sky-700",
    soft: "bg-sky-50 text-sky-700 border-sky-200",
    ring: "ring-sky-500",
    dot: "bg-sky-500",
  },
  formatif: {
    label: "Kuis Formatif",
    short: "Formatif",
    phase: "Tengah Materi",
    desc: "Memantau proses dan perbaikan",
    color: "text-amber-700",
    soft: "bg-amber-50 text-amber-800 border-amber-200",
    ring: "ring-amber-500",
    dot: "bg-amber-500",
  },
  posttest: {
    label: "Post-test",
    short: "Post",
    phase: "Akhir Materi",
    desc: "Mengukur hasil akhir / kelulusan",
    color: "text-emerald-700",
    soft: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-500",
    dot: "bg-emerald-500",
  },
};

export const STAGE_ORDER: AssessmentType[] = ["pretest", "formatif", "posttest"];

const TZ = "Asia/Makassar";

export function formatDate(d?: string | null, withTime = true) {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(d));
}

export function formatScore(n?: number | null) {
  if (n === null || n === undefined) return "-";
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** N-Gain (Hake): (post - pre) / (100 - pre) */
export function nGain(pre?: number | null, post?: number | null) {
  if (pre === null || pre === undefined || post === null || post === undefined) return null;
  if (Number(pre) >= 100) return Number(post) >= 100 ? 1 : 0;
  return (Number(post) - Number(pre)) / (100 - Number(pre));
}

export function nGainCategory(g: number | null) {
  if (g === null) return { label: "-", cls: "bg-slate-100 text-slate-500" };
  if (g >= 0.7) return { label: "Tinggi", cls: "bg-emerald-100 text-emerald-700" };
  if (g >= 0.3) return { label: "Sedang", cls: "bg-amber-100 text-amber-800" };
  return { label: "Rendah", cls: "bg-rose-100 text-rose-700" };
}

/** Tafsiran efektivitas N-Gain persen (Hake, 1999) */
export function nGainEffectiveness(pct: number | null) {
  if (pct === null) return "-";
  if (pct > 75) return "Efektif";
  if (pct >= 56) return "Cukup Efektif";
  if (pct >= 40) return "Kurang Efektif";
  return "Tidak Efektif";
}

/** Tingkat kesukaran butir soal (proporsi menjawab benar) */
export function difficulty(p: number | null) {
  if (p === null) return { label: "-", cls: "bg-slate-100 text-slate-500" };
  if (p > 0.7) return { label: "Mudah", cls: "bg-emerald-100 text-emerald-700" };
  if (p >= 0.3) return { label: "Sedang", cls: "bg-amber-100 text-amber-800" };
  return { label: "Sukar", cls: "bg-rose-100 text-rose-700" };
}

/** ISO timestamp n hari ke belakang (awal hari bila startOfDay). */
export function daysAgo(n: number, startOfDay = false) {
  const d = new Date(Date.now() - n * 864e5);
  if (startOfDay) d.setHours(0, 0, 0, 0);
  return d;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function errMsg(e: unknown) {
  if (!e) return "Terjadi kesalahan";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: string }).message);
  return "Terjadi kesalahan";
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return (
    "﻿" +
    rows
      .map((r) =>
        r
          .map((c) => {
            const s = c === null || c === undefined ? "" : String(c);
            return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n")
  );
}

/** Ubah datetime-local (WITA) <-> ISO */
export function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(v?: string | null) {
  if (!v) return null;
  return new Date(`${v}:00+08:00`).toISOString();
}

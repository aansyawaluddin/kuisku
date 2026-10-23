import Link from "next/link";
import type { Metadata } from "next";
import { History } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { getMyAttempts } from "@/lib/student";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentType } from "@/lib/types";
import { cn, formatDate, formatScore, STAGE } from "@/lib/utils";

export const metadata: Metadata = { title: "Riwayat" };

export default async function HistoryPage() {
  const me = await requireProfile(["siswa"]);
  const supabase = await createClient();
  const attempts = (await getMyAttempts(me.id)).filter((a) => a.status === "submitted");
  const ids = [...new Set(attempts.map((a) => a.assessment_id))];
  const { data: asms } = ids.length
    ? await supabase.from("assessments").select("id, type, show_score, passing_score, materials(title, classes(name))").in("id", ids)
    : { data: [] };
  const map = new Map((asms ?? []).map((a) => [a.id, a]));
  const sorted = [...attempts].sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Riwayat Asesmen" desc={`${sorted.length} pengerjaan`} />
      {!sorted.length ? (
        <EmptyState icon={<History className="size-6" />} title="Belum ada riwayat" desc="Hasil pre-test, kuis formatif, dan post-test akan muncul di sini." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {sorted.map((t) => {
            const a = map.get(t.assessment_id);
            if (!a) return null;
            const type = a.type as AssessmentType;
            const mat = a.materials as unknown as { title: string; classes: { name: string } };
            return (
              <Link key={t.id} href={`/siswa/hasil/${t.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-xs font-bold text-white", STAGE[type].dot)}>{STAGE[type].short}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{mat.title}</p>
                  <p className="text-xs text-slate-500">
                    {mat.classes.name} · {STAGE[type].label} · percobaan ke-{t.attempt_no} · {formatDate(t.submitted_at)}
                  </p>
                </div>
                {a.show_score ? (
                  <div className="text-right">
                    <p className={cn("text-xl font-extrabold", type === "pretest" ? "text-ink" : t.passed ? "text-emerald-600" : "text-rose-600")}>{formatScore(t.score)}</p>
                    {type !== "pretest" && <p className="text-[11px] text-slate-500">{t.passed ? "Tuntas" : "Belum tuntas"}</p>}
                  </div>
                ) : (
                  <Badge>Terkumpul</Badge>
                )}
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}

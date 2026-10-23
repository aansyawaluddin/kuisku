import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, EyeOff, RotateCcw } from "lucide-react";
import { ReviewList, ScoreHero, type AttemptResult } from "@/components/result-view";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { computeProgress } from "@/lib/progress";
import { getMyAttempts } from "@/lib/student";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Material } from "@/lib/types";
import { STAGE } from "@/lib/utils";

export const metadata: Metadata = { title: "Hasil" };

export default async function StudentResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireProfile(["siswa"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_result", { p_attempt_id: id });
  if (error || !data) notFound();
  const r = data as AttemptResult;

  const { data: mat } = await supabase.from("materials").select("*, assessments(*)").eq("id", r.assessment.material_id).maybeSingle();
  const m = mat as (Material & { assessments: Assessment[] }) | null;
  const attempts = m ? await getMyAttempts(me.id, m.assessments.map((a) => a.id)) : [];
  const p = m ? computeProgress(m, m.assessments, attempts) : null;
  const self = p?.stages[r.assessment.type];
  const next = p?.next;

  let nextHint: { href: string; label: string; desc: string } | null = null;
  if (r.assessment.type === "pretest" && m) nextHint = { href: `/siswa/materi/${m.id}`, label: "Pelajari Materi Bagian 1", desc: "Materi pengantar sekarang terbuka untukmu." };
  else if (r.assessment.type === "formatif" && m) nextHint = { href: `/siswa/materi/${m.id}`, label: "Lanjut ke Materi Bagian 2", desc: "Perkuat pemahaman sebelum post-test." };
  if (next && next.state.type !== r.assessment.type && next.state.canStart && !nextHint) {
    nextHint = { href: `/siswa/kuis/${next.state.assessment.id}`, label: `Mulai ${STAGE[next.state.type].label}`, desc: "Tahap berikutnya sudah terbuka." };
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: `/siswa/materi/${r.assessment.material_id}`, label: r.assessment.material_title }} title="Hasil Asesmen" desc={r.assessment.title} />
      <ScoreHero r={r} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {nextHint && (
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{nextHint.label}</p>
              <p className="text-sm text-slate-500">{nextHint.desc}</p>
            </div>
            <LinkButton href={nextHint.href} size="sm">
              {r.assessment.type === "posttest" ? <BookOpen className="size-4" /> : <ArrowRight className="size-4" />}
            </LinkButton>
          </Card>
        )}
        {self?.canStart && (
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{r.assessment.type === "posttest" ? "Ikuti remedial" : "Coba lagi"}</p>
              <p className="text-sm text-slate-500">
                {r.assessment.max_attempts === 0 ? "Kesempatan tak terbatas" : `Sisa ${r.assessment.max_attempts - r.attempts_used} kesempatan`}
              </p>
            </div>
            <LinkButton href={`/siswa/kuis/${r.assessment.id}`} size="sm" variant="outline">
              <RotateCcw className="size-4" />
            </LinkButton>
          </Card>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Pembahasan</h2>
        {r.review ? (
          <ReviewList review={r.review} />
        ) : (
          <Card className="flex items-center gap-3 p-5 text-sm text-slate-600">
            <EyeOff className="size-5 text-slate-400" /> Pembahasan untuk asesmen ini tidak ditampilkan oleh mentor.
          </Card>
        )}
      </div>
    </div>
  );
}

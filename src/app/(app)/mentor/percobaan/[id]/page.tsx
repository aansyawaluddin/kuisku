import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ReviewList, ScoreHero, type AttemptResult } from "@/components/result-view";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detail Jawaban" };

export default async function AttemptDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_result", { p_attempt_id: id });
  if (error || !data) notFound();
  const r = data as AttemptResult;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: `/mentor/asesmen/${r.assessment.id}/hasil`, label: "Hasil asesmen" }} title={r.student?.full_name ?? "Detail jawaban"} desc={r.assessment.title} />
      <ScoreHero r={r} />
      {r.review && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Jawaban siswa</h2>
          <ReviewList review={r.review} />
        </div>
      )}
    </div>
  );
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, AssessmentType, Attempt } from "@/lib/types";
import { nGain, nGainCategory } from "@/lib/utils";

export type NGainRow = {
  id: string;
  full_name: string;
  nis: string | null;
  username: string | null;
  pre: number | null;
  formatifBest: number | null;
  formatifCount: number;
  post: number | null;
  postPassed: boolean | null;
  gain: number | null;
  category: string;
};

/** Pre = nilai percobaan pertama pre-test; Post = nilai terbaik post-test. */
export async function getNGainReport(materialId: string) {
  const supabase = await createClient();
  const { data: material } = await supabase.from("materials").select("id, title, class_id, classes(name), assessments(*)").eq("id", materialId).maybeSingle();
  if (!material) return null;
  const assessments = material.assessments as unknown as Assessment[];
  const byType = (t: AssessmentType) => assessments.find((a) => a.type === t);
  for (const a of assessments) await supabase.rpc("finalize_expired", { p_assessment_id: a.id });

  const [{ data: members }, { data: attempts }] = await Promise.all([
    supabase.from("class_members").select("profiles!inner(id, full_name, nis, username)").eq("class_id", material.class_id),
    supabase.from("attempts").select("*").in("assessment_id", assessments.map((a) => a.id)).eq("status", "submitted").order("attempt_no"),
  ]);
  const list = (attempts ?? []) as Attempt[];

  const rows: NGainRow[] = (members ?? [])
    .map((m) => m.profiles as unknown as { id: string; full_name: string; nis: string | null; username: string | null })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((s) => {
      const of = (t: AssessmentType) => list.filter((x) => x.student_id === s.id && x.assessment_id === byType(t)?.id);
      const preA = of("pretest")[0];
      const fA = of("formatif");
      const postA = of("posttest").reduce<Attempt | null>((b, t) => (b === null || Number(t.score) > Number(b.score) ? t : b), null);
      const pre = preA ? Number(preA.score) : null;
      const post = postA ? Number(postA.score) : null;
      const gain = nGain(pre, post);
      return {
        ...s,
        pre,
        formatifBest: fA.length ? Math.max(...fA.map((x) => Number(x.score))) : null,
        formatifCount: fA.length,
        post,
        postPassed: postA?.passed ?? null,
        gain,
        category: nGainCategory(gain).label,
      };
    });

  const complete = rows.filter((r) => r.gain !== null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const summary = {
    avgPre: avg(rows.filter((r) => r.pre !== null).map((r) => r.pre!)),
    avgPost: avg(rows.filter((r) => r.post !== null).map((r) => r.post!)),
    avgGain: avg(complete.map((r) => r.gain!)),
    tinggi: complete.filter((r) => r.category === "Tinggi").length,
    sedang: complete.filter((r) => r.category === "Sedang").length,
    rendah: complete.filter((r) => r.category === "Rendah").length,
    complete: complete.length,
    total: rows.length,
    passed: rows.filter((r) => r.postPassed).length,
    kkm: byType("posttest")?.passing_score ?? 75,
  };
  return { material: material as unknown as { id: string; title: string; class_id: string; classes: { name: string } }, rows, summary };
}

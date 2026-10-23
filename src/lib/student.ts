import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Attempt, ClassRow, Material } from "@/lib/types";

/** Selesaikan percobaan yang waktunya habis (get_attempt otomatis menilai). */
export async function settleExpired(attempts: Attempt[]) {
  const expired = attempts.filter((a) => a.status === "in_progress" && a.expires_at && new Date(a.expires_at).getTime() <= Date.now());
  if (!expired.length) return false;
  const supabase = await createClient();
  await Promise.all(expired.map((a) => supabase.rpc("get_attempt", { p_attempt_id: a.id })));
  return true;
}

export async function getMyAttempts(studentId: string, assessmentIds?: string[]) {
  const supabase = await createClient();
  const load = async () => {
    let q = supabase.from("attempts").select("*").eq("student_id", studentId).order("attempt_no");
    if (assessmentIds) q = q.in("assessment_id", assessmentIds.length ? assessmentIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data } = await q;
    return (data ?? []) as Attempt[];
  };
  let attempts = await load();
  if (await settleExpired(attempts)) attempts = await load();
  return attempts;
}

export type ClassWithMaterials = ClassRow & { mentor: string | null; materials: (Material & { assessments: Assessment[] })[] };

export async function getStudentOverview(studentId: string) {
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("class_members").select("class_id").eq("student_id", studentId);
  const classIds = (memberships ?? []).map((m) => m.class_id);
  if (!classIds.length) return { classes: [] as ClassWithMaterials[], attempts: [] as Attempt[] };

  const { data: classes } = await supabase
    .from("classes")
    .select("*, profiles:mentor_id(full_name), materials(*, assessments(*))")
    .in("id", classIds)
    .eq("is_active", true)
    .order("created_at");

  const list: ClassWithMaterials[] = (classes ?? []).map((c) => ({
    ...(c as ClassRow),
    mentor: (c.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
    materials: ((c.materials ?? []) as (Material & { assessments: Assessment[] })[])
      .filter((m) => m.is_published)
      .sort((a, b) => a.order_index - b.order_index || a.created_at.localeCompare(b.created_at)),
  }));
  const asmIds = list.flatMap((c) => c.materials.flatMap((m) => m.assessments.map((a) => a.id)));
  const attempts = await getMyAttempts(studentId, asmIds);
  return { classes: list, attempts };
}

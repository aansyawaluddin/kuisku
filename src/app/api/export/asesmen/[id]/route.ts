import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Attempt } from "@/lib/types";
import { STAGE, toCsv } from "@/lib/utils";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getProfile();
  if (!me || !["mentor", "superadmin"].includes(me.role)) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from("assessments").select("id, type, title, passing_score, materials(class_id, title)").eq("id", id).maybeSingle();
  if (!a) return new NextResponse("Not found", { status: 404 });
  await supabase.rpc("finalize_expired", { p_assessment_id: id });
  const mat = a.materials as unknown as { class_id: string; title: string };

  const [{ data: members }, { data: attempts }] = await Promise.all([
    supabase.from("class_members").select("profiles!inner(id, full_name, nis, username)").eq("class_id", mat.class_id),
    supabase.from("attempts").select("*").eq("assessment_id", id).order("attempt_no"),
  ]);
  const list = (attempts ?? []) as Attempt[];
  const students = (members ?? [])
    .map((m) => m.profiles as unknown as { id: string; full_name: string; nis: string | null; username: string | null })
    .sort((x, y) => x.full_name.localeCompare(y.full_name));

  const rows: (string | number | null)[][] = [
    ["Asesmen", `${STAGE[a.type as keyof typeof STAGE].label} - ${mat.title}`],
    ["KKM", a.passing_score],
    [],
    ["No", "Nama", "NIS", "Username", "Percobaan ke", "Status", "Benar", "Jumlah Soal", "Nilai", "Tuntas", "Mulai", "Selesai"],
  ];
  let no = 0;
  for (const s of students) {
    const mine = list.filter((t) => t.student_id === s.id);
    no++;
    if (!mine.length) {
      rows.push([no, s.full_name, s.nis, s.username, "", "Belum mengerjakan", "", "", "", "", "", ""]);
      continue;
    }
    for (const t of mine) {
      rows.push([
        no,
        s.full_name,
        s.nis,
        s.username,
        t.attempt_no,
        t.status === "submitted" ? "Selesai" : "Sedang mengerjakan",
        t.correct_count,
        t.total_questions,
        t.score === null ? "" : Number(t.score),
        t.passed === null ? "" : t.passed ? "Ya" : "Tidak",
        t.started_at,
        t.submitted_at,
      ]);
    }
  }
  const name = `hasil-${a.type}-${mat.title.replace(/[^\w-]+/g, "_").slice(0, 40)}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}

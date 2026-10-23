import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ClipboardCheck, GraduationCap, School } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatCard, Table } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentType } from "@/lib/types";
import { daysAgo, formatDate, formatScore, STAGE } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard Mentor" };

export default async function MentorDashboard() {
  const me = await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, code, is_active, class_members(count), materials(count)")
    .eq("mentor_id", me.id)
    .order("created_at", { ascending: false });

  const classIds = (classes ?? []).map((c) => c.id);
  const studentTotal = (classes ?? []).reduce((a, c) => a + ((c.class_members as unknown as { count: number }[])[0]?.count ?? 0), 0);
  const materialTotal = (classes ?? []).reduce((a, c) => a + ((c.materials as unknown as { count: number }[])[0]?.count ?? 0), 0);

  const { data: recent } = classIds.length
    ? await supabase
        .from("attempts")
        .select("id, score, passed, submitted_at, profiles(full_name), assessments!inner(type, title, materials!inner(class_id))")
        .eq("status", "submitted")
        .in("assessments.materials.class_id", classIds)
        .order("submitted_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const { count: weekCount } = classIds.length
    ? await supabase
        .from("attempts")
        .select("id, assessments!inner(materials!inner(class_id))", { count: "exact", head: true })
        .eq("status", "submitted")
        .in("assessments.materials.class_id", classIds)
        .gte("submitted_at", daysAgo(7).toISOString())
    : { count: 0 };

  return (
    <div>
      <PageHeader title={`Halo, ${me.full_name.split(" ")[0]} 👋`} desc="Pantau kelas dan perkembangan siswa Anda." action={<LinkButton href="/mentor/kelas">Kelola Kelas</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kelas saya" value={classes?.length ?? 0} icon={<School className="size-5" />} />
        <StatCard label="Siswa" value={studentTotal} icon={<GraduationCap className="size-5" />} tone="sky" />
        <StatCard label="Materi" value={materialTotal} icon={<BookOpen className="size-5" />} tone="amber" />
        <StatCard label="Pengerjaan 7 hari" value={weekCount ?? 0} icon={<ClipboardCheck className="size-5" />} tone="emerald" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Kelas saya" />
          <div className="divide-y divide-slate-100">
            {(classes ?? []).map((c) => (
              <Link key={c.id} href={`/mentor/kelas/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {(c.class_members as unknown as { count: number }[])[0]?.count ?? 0} siswa · {(c.materials as unknown as { count: number }[])[0]?.count ?? 0} materi
                  </p>
                </div>
                <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold tracking-widest">{c.code}</span>
              </Link>
            ))}
            {!classes?.length && (
              <div className="p-5">
                <EmptyState title="Belum ada kelas" desc="Buat kelas pertama Anda untuk mulai menambahkan siswa dan materi." action={<LinkButton href="/mentor/kelas">Buat Kelas</LinkButton>} />
              </div>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Pengerjaan terbaru" />
          <Table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Asesmen</th>
                <th>Nilai</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((r) => {
                const asm = r.assessments as unknown as { type: AssessmentType; title: string };
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{(r.profiles as unknown as { full_name: string } | null)?.full_name}</td>
                    <td>
                      <Badge className={`border ${STAGE[asm.type].soft}`}>{STAGE[asm.type].short}</Badge>
                      <span className="ml-2 text-slate-600">{asm.title.replace(/^[^:]+:\s*/, "")}</span>
                    </td>
                    <td className={r.passed ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{formatScore(r.score)}</td>
                    <td className="text-slate-500">{formatDate(r.submitted_at)}</td>
                  </tr>
                );
              })}
              {!recent?.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Belum ada pengerjaan
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

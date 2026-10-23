import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ClipboardCheck, GraduationCap, School, UserCog, Users } from "lucide-react";
import { ActivityChart } from "@/components/charts";
import { Badge, Card, CardHeader, PageHeader, StatCard, Table } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysAgo, formatDate, formatScore, STAGE } from "@/lib/utils";
import type { AssessmentType } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard Superadmin" };

export default async function AdminDashboard() {
  const me = await requireProfile(["superadmin"]);
  const supabase = await createClient();
  const since = daysAgo(13, true);

  const [mentors, siswa, classes, materials, attemptsCount, recentAttempts, recent] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "mentor"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "siswa"),
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase.from("materials").select("id", { count: "exact", head: true }),
    supabase.from("attempts").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("attempts").select("submitted_at, score, passed, assessments(type)").eq("status", "submitted").gte("submitted_at", since.toISOString()),
    supabase
      .from("attempts")
      .select("id, score, passed, submitted_at, profiles(full_name), assessments(type, title)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(8),
  ]);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 864e5);
    return { key: d.toISOString().slice(0, 10), label: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(d), total: 0 };
  });
  const post: number[] = [];
  for (const a of recentAttempts.data ?? []) {
    const key = a.submitted_at?.slice(0, 10);
    const day = days.find((d) => d.key === key);
    if (day) day.total++;
    const t = (a.assessments as unknown as { type: AssessmentType } | null)?.type;
    if (t === "posttest" && a.score !== null) post.push(Number(a.score));
  }
  const avgPost = post.length ? post.reduce((a, b) => a + b, 0) / post.length : null;

  return (
    <div>
      <PageHeader title={`Halo, ${me.full_name.split(" ")[0]} 👋`} desc="Ringkasan seluruh aktivitas platform." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Mentor" value={mentors.count ?? 0} icon={<UserCog className="size-5" />} />
        <StatCard label="Siswa" value={siswa.count ?? 0} icon={<GraduationCap className="size-5" />} tone="sky" />
        <StatCard label="Kelas" value={classes.count ?? 0} icon={<School className="size-5" />} tone="amber" />
        <StatCard label="Materi" value={materials.count ?? 0} icon={<BookOpen className="size-5" />} tone="emerald" />
        <StatCard label="Total Pengerjaan" value={attemptsCount.count ?? 0} icon={<ClipboardCheck className="size-5" />} tone="rose" />
        <StatCard label="Rata-rata Post-test (14 hari)" value={formatScore(avgPost)} hint={`${post.length} pengerjaan post-test`} icon={<Users className="size-5" />} tone="emerald" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Aktivitas pengerjaan" desc="14 hari terakhir" />
          <div className="p-4">
            <ActivityChart data={days} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Pintasan" />
          <div className="grid gap-2 p-4">
            <Link href="/admin/pengguna?role=mentor" className="rounded-xl border border-slate-200 p-3 hover:border-brand-200 hover:bg-brand-50">
              <p className="font-semibold">Kelola mentor</p>
              <p className="text-sm text-slate-500">Buat akun mentor dan atur aksesnya</p>
            </Link>
            <Link href="/admin/pengguna?role=siswa" className="rounded-xl border border-slate-200 p-3 hover:border-brand-200 hover:bg-brand-50">
              <p className="font-semibold">Kelola siswa</p>
              <p className="text-sm text-slate-500">Data siswa, reset password, nonaktifkan</p>
            </Link>
            <Link href="/mentor/kelas" className="rounded-xl border border-slate-200 p-3 hover:border-brand-200 hover:bg-brand-50">
              <p className="font-semibold">Semua kelas</p>
              <p className="text-sm text-slate-500">Pantau kelas, materi, dan hasil asesmen</p>
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
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
            {(recent.data ?? []).map((r) => {
              const asm = r.assessments as unknown as { type: AssessmentType; title: string } | null;
              const p = r.profiles as unknown as { full_name: string } | null;
              return (
                <tr key={r.id}>
                  <td className="font-medium">{p?.full_name}</td>
                  <td>
                    {asm && <Badge className={`border ${STAGE[asm.type].soft}`}>{STAGE[asm.type].label}</Badge>} <span className="text-slate-600">{asm?.title}</span>
                  </td>
                  <td>
                    <span className={r.passed ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{formatScore(r.score)}</span>
                  </td>
                  <td className="text-slate-500">{formatDate(r.submitted_at)}</td>
                </tr>
              );
            })}
            {!recent.data?.length && (
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
  );
}

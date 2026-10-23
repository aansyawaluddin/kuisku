import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, Eye, RotateCcw, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { DistributionChart, ItemChart } from "@/components/charts";
import { ConfirmAction } from "@/components/form-bits";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Table, buttonClass } from "@/components/ui";
import { resetAttempt } from "@/lib/actions/academic";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Attempt, Option } from "@/lib/types";
import { cn, difficulty, formatDate, formatScore, STAGE } from "@/lib/utils";

export const metadata: Metadata = { title: "Hasil Asesmen" };

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("assessments").select("*, materials(id, title, class_id)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Assessment & { materials: { id: string; title: string; class_id: string } };
  await supabase.rpc("finalize_expired", { p_assessment_id: id });

  const [{ data: members }, { data: attemptsRaw }, { data: questions }] = await Promise.all([
    supabase.from("class_members").select("profiles!inner(id, full_name, username, nis)").eq("class_id", a.materials.class_id),
    supabase.from("attempts").select("*").eq("assessment_id", id).order("attempt_no"),
    supabase.from("questions").select("id, question, options, order_index, question_keys(correct_option)").eq("assessment_id", id).order("order_index"),
  ]);
  const attempts = (attemptsRaw ?? []) as Attempt[];
  const students = (members ?? [])
    .map((m) => m.profiles as unknown as { id: string; full_name: string; username: string | null; nis: string | null })
    .sort((x, y) => x.full_name.localeCompare(y.full_name));

  const rows = students.map((s) => {
    const mine = attempts.filter((t) => t.student_id === s.id);
    const done = mine.filter((t) => t.status === "submitted");
    const best = done.reduce<Attempt | null>((b, t) => (b === null || Number(t.score) > Number(b.score) ? t : b), null);
    const latest = done[done.length - 1] ?? null;
    const inProgress = mine.find((t) => t.status === "in_progress");
    return { s, count: mine.length, best, latest, inProgress, first: done[0] ?? null };
  });

  const scored = rows.filter((r) => r.best).map((r) => Number(r.best!.score));
  const avg = scored.length ? scored.reduce((x, y) => x + y, 0) / scored.length : null;
  const passCount = rows.filter((r) => r.best?.passed).length;
  const buckets = ["0-20", "21-40", "41-60", "61-80", "81-100"].map((range) => ({ range, total: 0 }));
  scored.forEach((v) => {
    const i = v <= 20 ? 0 : v <= 40 ? 1 : v <= 60 ? 2 : v <= 80 ? 3 : 4;
    buckets[i].total++;
  });

  // Analisis butir: jawaban dari percobaan terakhir tiap siswa
  const latestIds = rows.map((r) => r.latest?.id).filter(Boolean) as string[];
  const { data: answers } = latestIds.length
    ? await supabase.from("attempt_answers").select("attempt_id, question_id, selected_option, is_correct").in("attempt_id", latestIds)
    : { data: [] };
  const items = (questions ?? []).map((q, i) => {
    const ans = (answers ?? []).filter((x) => x.question_id === q.id);
    const correct = ans.filter((x) => x.is_correct).length;
    const p = latestIds.length ? correct / latestIds.length : null;
    const dist: Record<string, number> = {};
    ans.forEach((x) => x.selected_option && (dist[x.selected_option] = (dist[x.selected_option] ?? 0) + 1));
    const key = (Array.isArray(q.question_keys) ? q.question_keys[0] : q.question_keys) as { correct_option: string } | null;
    return { no: i + 1, q, p, dist, key: key?.correct_option, blank: latestIds.length - ans.filter((x) => x.selected_option).length };
  });

  const s = STAGE[a.type];

  return (
    <div>
      <PageHeader
        back={{ href: `/mentor/asesmen/${a.id}`, label: "Kelola asesmen" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Badge className={cn("border text-sm", s.soft)}>{s.label}</Badge> Hasil
          </span>
        }
        desc={a.materials.title}
        action={
          <a href={`/api/export/asesmen/${a.id}`} className={buttonClass("outline")}>
            <Download className="size-4" /> Export CSV
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sudah mengerjakan" value={`${scored.length}/${students.length}`} icon={<Users className="size-5" />} />
        <StatCard label="Rata-rata (nilai terbaik)" value={formatScore(avg)} icon={<TrendingUp className="size-5" />} tone="sky" />
        <StatCard label="Tertinggi / Terendah" value={scored.length ? `${formatScore(Math.max(...scored))} / ${formatScore(Math.min(...scored))}` : "-"} icon={<Trophy className="size-5" />} tone="amber" />
        <StatCard
          label={`Tuntas (KKM ${a.passing_score})`}
          value={scored.length ? `${Math.round((passCount / scored.length) * 100)}%` : "-"}
          hint={`${passCount} siswa tuntas`}
          icon={<Target className="size-5" />}
          tone="emerald"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Distribusi nilai" />
          <div className="p-4">
            <DistributionChart data={buckets} color={a.type === "pretest" ? "#0ea5e9" : a.type === "formatif" ? "#f59e0b" : "#10b981"} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Persentase menjawab benar per soal" desc="Berdasarkan percobaan terakhir tiap siswa" />
          <div className="p-4">
            {items.length && latestIds.length ? <ItemChart data={items.map((x) => ({ no: `${x.no}`, pct: Math.round((x.p ?? 0) * 100) }))} /> : <p className="py-16 text-center text-sm text-slate-500">Belum ada data</p>}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Nilai siswa" />
        {students.length ? (
          <Table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Percobaan</th>
                <th>Nilai terbaik</th>
                <th>Nilai pertama</th>
                <th>Status</th>
                <th>Terakhir</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={r.s.full_name} />
                      <div>
                        <p className="font-semibold">{r.s.full_name}</p>
                        <p className="text-xs text-slate-500">{r.s.nis ?? r.s.username}</p>
                      </div>
                    </div>
                  </td>
                  <td>{r.count}</td>
                  <td className="text-base font-bold">{formatScore(r.best?.score)}</td>
                  <td className="text-slate-600">{formatScore(r.first?.score)}</td>
                  <td>
                    {r.inProgress ? (
                      <Badge className="bg-sky-50 text-sky-700">Sedang mengerjakan</Badge>
                    ) : !r.best ? (
                      <Badge>Belum</Badge>
                    ) : r.best.passed ? (
                      <Badge className="bg-emerald-50 text-emerald-700">Tuntas</Badge>
                    ) : (
                      <Badge className="bg-rose-50 text-rose-700">Belum tuntas</Badge>
                    )}
                  </td>
                  <td className="text-slate-500">{formatDate(r.latest?.submitted_at)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {r.latest && (
                        <Link href={`/mentor/percobaan/${(r.best ?? r.latest).id}`} className={buttonClass("ghost", "sm")} aria-label="Detail jawaban">
                          <Eye className="size-4" />
                        </Link>
                      )}
                      {r.count > 0 && (
                        <ConfirmAction action={resetAttempt} hidden={{ assessment_id: a.id, student_id: r.s.id }} confirm={`Reset semua percobaan ${r.s.full_name}? Nilainya akan dihapus dan siswa bisa mengerjakan ulang.`}>
                          <RotateCcw className="size-4 text-amber-600" />
                        </ConfirmAction>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState title="Belum ada siswa di kelas" />
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Analisis butir soal" desc="Tingkat kesukaran: Mudah (>70% benar), Sedang (30–70%), Sukar (<30%). Sebaran jawaban membantu menemukan pengecoh yang efektif." />
        <Table>
          <thead>
            <tr>
              <th>No</th>
              <th>Soal</th>
              <th>Benar</th>
              <th>Kesukaran</th>
              <th>Sebaran jawaban</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const d = difficulty(it.p);
              return (
                <tr key={it.q.id}>
                  <td className="font-bold">{it.no}</td>
                  <td className="max-w-md whitespace-normal">
                    <p className="line-clamp-2">{it.q.question}</p>
                  </td>
                  <td className="font-semibold">{it.p === null ? "-" : `${Math.round(it.p * 100)}%`}</td>
                  <td>
                    <Badge className={d.cls}>{d.label}</Badge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(it.q.options as Option[]).map((o) => (
                        <span key={o.id} className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", o.id === it.key ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                          {o.id}: {it.dist[o.id] ?? 0}
                        </span>
                      ))}
                      {it.blank > 0 && <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">Kosong: {it.blank}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Belum ada soal
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Clock, ListChecks, Lock, RefreshCw, ShieldAlert, Trophy } from "lucide-react";
import { StartButton } from "@/components/start-button";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { computeProgress } from "@/lib/progress";
import { getMyAttempts } from "@/lib/student";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Material } from "@/lib/types";
import { cn, formatDate, formatScore, STAGE } from "@/lib/utils";

export const metadata: Metadata = { title: "Mulai Asesmen" };

export default async function StartQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireProfile(["siswa"]);
  const supabase = await createClient();
  const { data } = await supabase.from("assessments").select("*, materials(*, classes(name), assessments(*))").eq("id", id).maybeSingle();

  if (!data) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={<ShieldAlert className="size-6" />}
          title="Asesmen tidak dapat dibuka"
          desc="Asesmen tidak ditemukan, belum dipublikasikan, atau kamu belum tergabung di kelasnya. Gabung kelas dulu memakai kode atau QR kelas dari mentor."
          action={<LinkButton href="/siswa/scan">Scan QR Kelas</LinkButton>}
        />
      </div>
    );
  }

  const a = data as Assessment & { materials: Material & { classes: { name: string }; assessments: Assessment[] } };
  const m = a.materials;
  const attempts = await getMyAttempts(me.id, m.assessments.map((x) => x.id));
  const p = computeProgress(m, m.assessments, attempts);
  const s = p.stages[a.type]!;
  const st = STAGE[a.type];
  const mine = attempts.filter((x) => x.assessment_id === a.id);
  const left = a.max_attempts === 0 ? "Tak terbatas" : `${Math.max(0, a.max_attempts - mine.length)} dari ${a.max_attempts}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: `/siswa/materi/${m.id}`, label: m.title }} title={a.title} desc={m.classes.name} />
      <Card className="overflow-hidden">
        <div className={cn("px-6 py-5 text-white", st.dot)}>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{st.phase}</p>
          <p className="text-2xl font-extrabold">{st.label}</p>
          <p className="text-sm text-white/85">{st.desc}</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
          {[
            { icon: ListChecks, label: "Soal", v: a.question_count },
            { icon: Clock, label: "Durasi", v: a.duration_minutes ? `${a.duration_minutes} mnt` : "Bebas" },
            { icon: Trophy, label: "KKM", v: a.type === "pretest" ? "—" : a.passing_score },
            { icon: RefreshCw, label: "Sisa kesempatan", v: left },
          ].map((x) => (
            <div key={x.label} className="bg-white p-4 text-center">
              <x.icon className="mx-auto size-5 text-slate-400" />
              <p className="mt-1 text-lg font-extrabold">{x.v}</p>
              <p className="text-xs text-slate-500">{x.label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-5 p-6">
          {a.instructions && (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              <p className="mb-1 font-semibold text-ink">Petunjuk</p>
              <p className="whitespace-pre-wrap">{a.instructions}</p>
            </div>
          )}
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>• Jawaban tersimpan otomatis setiap kali kamu memilih.</li>
            <li>• Gunakan tombol &quot;Ragu-ragu&quot; untuk menandai soal yang ingin dicek lagi.</li>
            {a.duration_minutes && <li>• Saat waktu habis, jawaban otomatis dikumpulkan.</li>}
            {(a.open_at || a.close_at) && (
              <li className="flex items-center gap-1.5">
                <CalendarClock className="size-4" /> Jadwal: {formatDate(a.open_at)} – {formatDate(a.close_at)}
              </li>
            )}
          </ul>

          {s.status === "in_progress" ? (
            <LinkButton href={`/kerjakan/${s.inProgress!.id}`} size="lg" className="w-full">
              Lanjutkan mengerjakan
            </LinkButton>
          ) : s.canStart ? (
            <StartButton assessmentId={a.id} timed={!!a.duration_minutes} label={s.submitted ? (a.type === "posttest" ? "Mulai Remedial" : "Kerjakan Lagi") : `Mulai ${st.label}`} />
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
              <Lock className="size-4" />
              {s.status === "done" ? (a.type === "posttest" && s.best?.passed ? "Kamu sudah tuntas pada post-test ini 🎉" : "Kesempatan mengerjakan sudah habis") : (s.reason ?? "Belum dapat dikerjakan")}
            </div>
          )}
        </div>
      </Card>

      {mine.filter((x) => x.status === "submitted").length > 0 && (
        <Card className="mt-6">
          <div className="border-b border-slate-100 px-5 py-4 font-bold">Riwayat percobaan</div>
          <div className="divide-y divide-slate-100">
            {mine
              .filter((x) => x.status === "submitted")
              .reverse()
              .map((t) => (
                <Link key={t.id} href={`/siswa/hasil/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold">Percobaan ke-{t.attempt_no}</p>
                    <p className="text-xs text-slate-500">{formatDate(t.submitted_at)}</p>
                  </div>
                  {a.show_score ? (
                    <div className="flex items-center gap-2">
                      {a.type !== "pretest" && <Badge className={t.passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>{t.passed ? "Tuntas" : "Belum tuntas"}</Badge>}
                      <span className="text-lg font-extrabold">{formatScore(t.score)}</span>
                    </div>
                  ) : (
                    <Badge>Terkumpul</Badge>
                  )}
                </Link>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

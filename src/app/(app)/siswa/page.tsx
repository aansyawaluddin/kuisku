import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, PartyPopper, ScanLine, School } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { StageTrack } from "@/components/stage-track";
import { Badge, Card, EmptyState, Input, LinkButton, ProgressBar } from "@/components/ui";
import { joinClass } from "@/lib/actions/academic";
import { requireProfile } from "@/lib/auth";
import { computeProgress } from "@/lib/progress";
import { getStudentOverview } from "@/lib/student";
import { cn, formatDate, formatScore, STAGE } from "@/lib/utils";

export const metadata: Metadata = { title: "Beranda" };

export default async function StudentHome() {
  const me = await requireProfile(["siswa"]);
  const { classes, attempts } = await getStudentOverview(me.id);

  const allMaterials = classes.flatMap((c) => c.materials.map((m) => ({ m, c, p: computeProgress(m, m.assessments, attempts) })));
  const totalStages = allMaterials.reduce((a, x) => a + x.p.total, 0);
  const doneStages = allMaterials.reduce((a, x) => a + x.p.completed, 0);
  const upNext = allMaterials.find((x) => x.p.next && (x.p.next.state.canStart || x.p.next.state.status === "in_progress"));
  const recent = [...attempts].filter((a) => a.status === "submitted").sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "")).slice(0, 5);
  const asmMap = new Map(allMaterials.flatMap(({ m }) => m.assessments.map((a) => [a.id, { a, m }] as const)));

  const joinForm = (
    <ActionForm action={joinClass} resetOnSuccess className="flex gap-2">
      <Input name="code" required maxLength={8} placeholder="Kode kelas" className="h-11 font-mono uppercase tracking-widest" />
      <SubmitButton size="lg" pendingText="...">
        Gabung
      </SubmitButton>
    </ActionForm>
  );

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div className="bg-grid absolute inset-0 opacity-[0.1] invert" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/60">Selamat belajar,</p>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{me.full_name}</h1>
            {totalStages > 0 && (
              <div className="mt-4 max-w-xs">
                <div className="mb-1.5 flex justify-between text-xs text-white/70">
                  <span>Progres asesmen</span>
                  <span>
                    {doneStages}/{totalStages}
                  </span>
                </div>
                <ProgressBar value={(doneStages / totalStages) * 100} className="bg-white/15" barClass="bg-emerald-400" />
              </div>
            )}
          </div>
          {upNext?.p.next && (
            <Link href={`/siswa/kuis/${upNext.p.next.state.assessment.id}`} className="group rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15 sm:max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{upNext.p.next.state.status === "in_progress" ? "Lanjutkan" : "Berikutnya"}</p>
              <p className="mt-1 font-bold">
                {STAGE[upNext.p.next.state.type].label} · {upNext.m.title}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300">
                Mulai <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {classes.length === 0 ? (
            <EmptyState
              icon={<School className="size-6" />}
              title="Kamu belum tergabung di kelas"
              desc="Masukkan kode kelas dari mentor atau scan QR kelas untuk mulai."
              action={
                <div className="flex flex-col items-center gap-3">
                  <div className="w-72">{joinForm}</div>
                  <LinkButton href="/siswa/scan" variant="outline">
                    <ScanLine className="size-4" /> Scan QR Kelas
                  </LinkButton>
                </div>
              }
            />
          ) : (
            classes.map((c) => (
              <section key={c.id}>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{c.name}</h2>
                    {c.mentor && <p className="text-sm text-slate-500">Mentor: {c.mentor}</p>}
                  </div>
                </div>
                {c.materials.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Mentor belum mempublikasikan materi.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {c.materials.map((m) => {
                      const p = computeProgress(m, m.assessments, attempts);
                      const finished = p.total > 0 && p.completed === p.total;
                      return (
                        <Link key={m.id} href={`/siswa/materi/${m.id}`} className="group">
                          <Card className="h-full p-4 transition group-hover:border-brand-200 group-hover:shadow-lg group-hover:shadow-brand-600/5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                                <BookOpen className="size-5" />
                              </div>
                              {finished ? (
                                <Badge className="bg-emerald-50 text-emerald-700">
                                  <PartyPopper className="size-3" /> Selesai
                                </Badge>
                              ) : p.next ? (
                                <Badge className={cn("border", STAGE[p.next.state.type].soft)}>{STAGE[p.next.state.type].short}</Badge>
                              ) : null}
                            </div>
                            <h3 className="mt-3 font-bold group-hover:text-brand-700">{m.title}</h3>
                            {m.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{m.description}</p>}
                            <div className="mt-4">
                              <StageTrack progress={p} />
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            ))
          )}
        </div>

        <div className="space-y-6">
          {classes.length > 0 && (
            <Card className="p-5">
              <h3 className="font-bold">Gabung kelas lain</h3>
              <p className="mb-3 text-sm text-slate-500">Masukkan kode atau scan QR kelas.</p>
              {joinForm}
              <LinkButton href="/siswa/scan" variant="outline" className="mt-2 w-full">
                <ScanLine className="size-4" /> Scan QR
              </LinkButton>
            </Card>
          )}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-bold">Hasil terbaru</h3>
              <Link href="/siswa/riwayat" className="text-sm font-semibold text-brand-600">
                Semua
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recent.map((r) => {
                const info = asmMap.get(r.assessment_id);
                if (!info) return null;
                return (
                  <Link key={r.id} href={`/siswa/hasil/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className={cn("size-2.5 shrink-0 rounded-full", STAGE[info.a.type].dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{info.m.title}</p>
                      <p className="text-xs text-slate-500">
                        {STAGE[info.a.type].label} · {formatDate(r.submitted_at)}
                      </p>
                    </div>
                    {info.a.show_score && <span className={cn("font-bold", r.passed ? "text-emerald-600" : "text-rose-600")}>{formatScore(r.score)}</span>}
                  </Link>
                );
              })}
              {!recent.length && <p className="px-5 py-8 text-center text-sm text-slate-500">Belum ada hasil</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

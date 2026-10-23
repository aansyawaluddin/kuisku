import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CheckCircle2, Clock, ListChecks, Lock, PlayCircle, RotateCcw, Trophy } from "lucide-react";
import { Markdown, VideoEmbed } from "@/components/markdown";
import { StageTrack } from "@/components/stage-track";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { computeProgress, type StageState } from "@/lib/progress";
import { getMyAttempts } from "@/lib/student";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Material } from "@/lib/types";
import { cn, formatScore, STAGE } from "@/lib/utils";

export const metadata: Metadata = { title: "Materi" };

export default async function StudentMaterial({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireProfile(["siswa"]);
  const supabase = await createClient();
  const { data } = await supabase.from("materials").select("*, classes(name), assessments(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Material & { classes: { name: string }; assessments: Assessment[] };
  const attempts = await getMyAttempts(me.id, m.assessments.map((a) => a.id));
  const p = computeProgress(m, m.assessments, attempts);

  const step = (n: number, children: React.ReactNode, active?: boolean, done?: boolean, last?: boolean) => (
    <li className="relative flex gap-4 pb-6">
      {!last && <span className="absolute left-[19px] top-11 h-[calc(100%-2.5rem)] w-0.5 bg-slate-200" />}
      <span
        className={cn(
          "relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
          done ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-brand-500 bg-white text-brand-600" : "border-slate-200 bg-white text-slate-400",
        )}
      >
        {done ? <CheckCircle2 className="size-5" /> : n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );

  const content = (part: 1 | 2) => {
    const unlocked = part === 1 ? p.introUnlocked : p.mainUnlocked;
    const text = part === 1 ? m.content_intro : m.content_main;
    const title = part === 1 ? "Materi Bagian 1 · Pengantar" : "Materi Bagian 2 · Lanjutan & Penguatan";
    if (!text && !(part === 1 && m.video_url)) return null;
    return (
      <Card className={cn("overflow-hidden", !unlocked && "bg-slate-50")}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <BookOpen className="size-5" />
            </div>
            <p className="font-bold">{title}</p>
          </div>
          {!unlocked && (
            <Badge>
              <Lock className="size-3" /> Terkunci
            </Badge>
          )}
        </div>
        {unlocked ? (
          <div className="space-y-4 border-t border-slate-100 px-5 py-5">
            {part === 1 && m.video_url && <VideoEmbed url={m.video_url} />}
            {text && <Markdown>{text}</Markdown>}
          </div>
        ) : (
          <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            {part === 1 ? "Selesaikan Pre-test untuk membuka materi ini." : "Selesaikan Kuis Formatif untuk membuka materi lanjutan."}
          </p>
        )}
      </Card>
    );
  };

  const items: { key: string; node: React.ReactNode; active?: boolean; done?: boolean }[] = [];
  const pushStage = (t: "pretest" | "formatif" | "posttest") => {
    const s = p.stages[t];
    if (s && s.status !== "empty") items.push({ key: t, node: <StageCard s={s} />, active: s.canStart && !s.submitted, done: s.submitted });
  };
  pushStage("pretest");
  const c1 = content(1);
  if (c1) items.push({ key: "c1", node: c1, active: p.introUnlocked && !p.stages.formatif?.submitted, done: p.introUnlocked && !!p.stages.formatif?.submitted });
  pushStage("formatif");
  const c2 = content(2);
  if (c2) items.push({ key: "c2", node: c2, active: p.mainUnlocked && !p.stages.posttest?.submitted, done: p.mainUnlocked && !!p.stages.posttest?.submitted });
  pushStage("posttest");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/siswa", label: "Beranda" }} title={m.title} desc={[m.classes.name, m.description].filter(Boolean).join(" · ")} />
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold">Progres materi</span>
          <span className="text-slate-500">
            {p.completed}/{p.total} asesmen selesai
          </span>
        </div>
        <StageTrack progress={p} />
      </Card>
      {items.length === 0 ? (
        <p className="text-center text-slate-500">Mentor belum menambahkan soal atau isi materi.</p>
      ) : (
        <ol>{items.map((it, i) => <Fragment key={it.key}>{step(i + 1, it.node, it.active, it.done, i === items.length - 1)}</Fragment>)}</ol>
      )}
    </div>
  );
}

function StageCard({ s }: { s: StageState }) {
  const st = STAGE[s.type];
  const a = s.assessment;
  const showScore = a.show_score && s.best;
  return (
    <Card className={cn("overflow-hidden", s.status === "locked" && "opacity-75")}>
      <div className={cn("h-1", st.dot)} />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{st.phase}</p>
            <p className={cn("text-lg font-extrabold", st.color)}>{st.label}</p>
            <p className="text-sm text-slate-500">{st.desc}</p>
          </div>
          {showScore ? (
            <div className="text-right">
              <p className={cn("text-2xl font-extrabold", s.type === "pretest" || s.best!.passed ? "text-emerald-600" : "text-rose-600")}>{formatScore(s.best!.score)}</p>
              <p className="text-xs text-slate-500">{s.attemptsUsed > 1 ? "nilai terbaik" : "nilai"}</p>
            </div>
          ) : s.submitted ? (
            <Badge className="bg-emerald-50 text-emerald-700">Terkumpul</Badge>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <ListChecks className="size-4 text-slate-400" /> {a.question_count} soal
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-slate-400" /> {a.duration_minutes ? `${a.duration_minutes} menit` : "Tanpa batas waktu"}
          </span>
          {s.type !== "pretest" && (
            <span className="flex items-center gap-1.5">
              <Trophy className="size-4 text-slate-400" /> KKM {a.passing_score}
            </span>
          )}
        </div>
        {s.reason && s.status !== "done" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
            <Lock className="size-4" /> {s.reason}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {s.status === "in_progress" ? (
            <LinkButton href={`/kerjakan/${s.inProgress!.id}`}>
              <PlayCircle className="size-4" /> Lanjutkan mengerjakan
            </LinkButton>
          ) : s.canStart ? (
            <LinkButton href={`/siswa/kuis/${a.id}`} variant={s.submitted ? "outline" : "primary"}>
              {s.submitted ? (
                <>
                  <RotateCcw className="size-4" /> {s.type === "posttest" ? "Remedial" : "Kerjakan lagi"}
                </>
              ) : (
                <>
                  Mulai {st.label} <ArrowRight className="size-4" />
                </>
              )}
            </LinkButton>
          ) : null}
          {s.latest && (
            <Link href={`/siswa/hasil/${(s.best ?? s.latest).id}`} className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-brand-600 hover:bg-brand-50">
              Lihat hasil
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

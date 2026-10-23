import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BarChart3, ClipboardList, Clock, Eye, EyeOff, Lock, ListChecks, Trash2, Trophy, Unlock } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/form-bits";
import { Badge, Card, CardHeader, Checkbox, Field, Input, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { deleteMaterial, togglePublish, updateMaterial } from "@/lib/actions/academic";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Material } from "@/lib/types";
import { cn, STAGE, STAGE_ORDER } from "@/lib/utils";

export const metadata: Metadata = { title: "Kelola Materi" };

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("materials").select("*, classes(id, name), assessments(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Material & { classes: { id: string; name: string }; assessments: Assessment[] };

  const asmIds = m.assessments.map((a) => a.id);
  const { data: att } = asmIds.length
    ? await supabase.from("attempts").select("assessment_id, student_id").in("assessment_id", asmIds).eq("status", "submitted")
    : { data: [] };
  const doneBy = (aid: string) => new Set((att ?? []).filter((x) => x.assessment_id === aid).map((x) => x.student_id)).size;
  const { count: memberCount } = await supabase.from("class_members").select("student_id", { count: "exact", head: true }).eq("class_id", m.class_id);

  return (
    <div>
      <PageHeader
        back={{ href: `/mentor/kelas/${m.classes.id}`, label: m.classes.name }}
        title={m.title}
        desc={m.description ?? undefined}
        action={
          <>
            <LinkButton href={`/mentor/materi/${m.id}/laporan`} variant="outline">
              <BarChart3 className="size-4" /> Laporan N-Gain
            </LinkButton>
            <ConfirmAction action={togglePublish} hidden={{ id: m.id }} variant={m.is_published ? "outline" : "primary"} size="md">
              {m.is_published ? (
                <>
                  <EyeOff className="size-4" /> Sembunyikan
                </>
              ) : (
                <>
                  <Eye className="size-4" /> Publikasikan
                </>
              )}
            </ConfirmAction>
            <ConfirmAction action={deleteMaterial} hidden={{ id: m.id }} variant="outline" size="md" confirm={`Hapus materi "${m.title}" beserta soal dan seluruh nilai siswa?`}>
              <Trash2 className="size-4 text-rose-600" />
            </ConfirmAction>
          </>
        }
      />

      {!m.is_published && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Materi masih <b>draf</b> — belum terlihat oleh siswa. Lengkapi soal lalu klik <b>Publikasikan</b>.
        </div>
      )}

      {/* Alur 3 asesmen */}
      <div className="grid gap-4 md:grid-cols-3">
        {STAGE_ORDER.map((t, i) => {
          const a = m.assessments.find((x) => x.type === t);
          if (!a) return null;
          const s = STAGE[t];
          return (
            <Card key={t} className="relative overflow-hidden">
              <div className={cn("h-1.5", s.dot)} />
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {i + 1}. {s.phase}
                    </p>
                    <p className={cn("text-lg font-extrabold", s.color)}>{s.label}</p>
                  </div>
                  {a.is_open ? (
                    <Badge className="bg-emerald-50 text-emerald-700">
                      <Unlock className="size-3" /> Dibuka
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600">
                      <Lock className="size-3" /> Ditutup
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <ListChecks className="size-4 text-slate-400" />
                    <span>
                      <b>{a.question_count}</b> soal
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-slate-400" />
                    <span>{a.duration_minutes ? `${a.duration_minutes} menit` : "Tanpa batas"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-slate-400" />
                    <span>KKM {a.passing_score}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="size-4 text-slate-400" />
                    <span>
                      {doneBy(a.id)}/{memberCount ?? 0} selesai
                    </span>
                  </div>
                </dl>
                {a.question_count === 0 && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">Belum ada soal</p>}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <LinkButton href={`/mentor/asesmen/${a.id}`} size="sm" variant="secondary">
                    Soal & Atur
                  </LinkButton>
                  <LinkButton href={`/mentor/asesmen/${a.id}/hasil`} size="sm" variant="outline">
                    Hasil
                  </LinkButton>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Konten materi */}
      <Card className="mt-6">
        <CardHeader title="Konten materi" desc="Mendukung format Markdown (judul #, **tebal**, daftar -, tautan, tabel, gambar)." />
        <ActionForm action={updateMaterial} className="space-y-5 p-5">
          <input type="hidden" name="id" value={m.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Judul materi">
              <Input name="title" defaultValue={m.title} required />
            </Field>
            <Field label="Video pembelajaran (opsional)" hint="Tautan YouTube akan disematkan otomatis">
              <Input name="video_url" defaultValue={m.video_url ?? ""} placeholder="https://youtu.be/..." />
            </Field>
          </div>
          <Field label="Deskripsi singkat">
            <Textarea name="description" defaultValue={m.description ?? ""} rows={2} />
          </Field>
          <Field
            label="Bagian 1 — Pengantar materi"
            hint={
              <>
                Terbuka setelah siswa menyelesaikan <b className="text-sky-700">Pre-test</b>, dipelajari sebelum <b className="text-amber-700">Kuis Formatif</b>.
              </>
            }
          >
            <Textarea name="content_intro" defaultValue={m.content_intro ?? ""} rows={10} className="font-mono text-[13px]" placeholder={"# Pengertian Ekosistem\n\nEkosistem adalah ..."} />
          </Field>
          <Field
            label="Bagian 2 — Materi lanjutan & penguatan"
            hint={
              <>
                Terbuka setelah <b className="text-amber-700">Kuis Formatif</b>, dipelajari sebelum <b className="text-emerald-700">Post-test</b>.
              </>
            }
          >
            <Textarea name="content_main" defaultValue={m.content_main ?? ""} rows={10} className="font-mono text-[13px]" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox name="enforce_sequence" defaultChecked={m.enforce_sequence} label="Wajib berurutan" desc="Pre-test → Formatif → Post-test harus diselesaikan sesuai urutan" />
            <Checkbox name="is_published" defaultChecked={m.is_published} label="Publikasikan ke siswa" desc="Siswa di kelas dapat melihat materi ini" />
          </div>
          <div className="flex justify-end gap-2">
            <SubmitButton>Simpan Materi</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BarChart3, Lock, Unlock } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/form-bits";
import { QrDisplay } from "@/components/qr-display";
import { QuestionEditor } from "@/components/question-editor";
import { Badge, Card, CardHeader, Checkbox, Field, Input, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { toggleAssessmentOpen, updateAssessment } from "@/lib/actions/academic";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, AssessmentType, Question } from "@/lib/types";
import { cn, STAGE, toLocalInput } from "@/lib/utils";

export const metadata: Metadata = { title: "Kelola Asesmen" };

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("assessments").select("*, materials(id, title, classes(name))").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Assessment & { materials: { id: string; title: string; classes: { name: string } } };
  const s = STAGE[a.type];

  const [{ data: questions }, { data: siblings }] = await Promise.all([
    supabase.from("questions").select("*, question_keys(correct_option, explanation)").eq("assessment_id", id).order("order_index").order("created_at"),
    supabase.from("assessments").select("id, type, question_count").eq("material_id", a.material_id),
  ]);

  return (
    <div>
      <PageHeader
        back={{ href: `/mentor/materi/${a.materials.id}`, label: a.materials.title }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Badge className={cn("border text-sm", s.soft)}>{s.label}</Badge>
            <span>{a.title}</span>
          </span>
        }
        desc={`${s.phase} · ${s.desc}`}
        action={
          <>
            <ConfirmAction action={toggleAssessmentOpen} hidden={{ id: a.id }} variant={a.is_open ? "outline" : "primary"} size="md">
              {a.is_open ? (
                <>
                  <Lock className="size-4" /> Tutup
                </>
              ) : (
                <>
                  <Unlock className="size-4" /> Buka
                </>
              )}
            </ConfirmAction>
            <LinkButton href={`/mentor/asesmen/${a.id}/hasil`} variant="secondary">
              <BarChart3 className="size-4" /> Lihat Hasil
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <QuestionEditor assessmentId={a.id} questions={(questions ?? []) as Question[]} siblings={(siblings ?? []) as { id: string; type: AssessmentType; question_count: number }[]} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pengaturan" />
            <ActionForm action={updateAssessment} className="space-y-4 p-5">
              <input type="hidden" name="id" value={a.id} />
              <Field label="Judul">
                <Input name="title" defaultValue={a.title} required />
              </Field>
              <Field label="Petunjuk pengerjaan">
                <Textarea name="instructions" defaultValue={a.instructions ?? ""} rows={3} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Durasi" hint="menit, kosong = bebas">
                  <Input name="duration_minutes" type="number" min={1} defaultValue={a.duration_minutes ?? ""} />
                </Field>
                <Field label="KKM" hint="0–100">
                  <Input name="passing_score" type="number" min={0} max={100} defaultValue={a.passing_score} required />
                </Field>
                <Field label="Percobaan" hint="0 = tak terbatas">
                  <Input name="max_attempts" type="number" min={0} defaultValue={a.max_attempts} required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dibuka (WITA)">
                  <Input name="open_at" type="datetime-local" defaultValue={toLocalInput(a.open_at)} />
                </Field>
                <Field label="Ditutup (WITA)">
                  <Input name="close_at" type="datetime-local" defaultValue={toLocalInput(a.close_at)} />
                </Field>
              </div>
              <div className="space-y-2">
                <Checkbox name="is_open" defaultChecked={a.is_open} label="Asesmen dibuka" desc="Siswa dapat mulai mengerjakan" />
                <Checkbox name="shuffle_questions" defaultChecked={a.shuffle_questions} label="Acak urutan soal" />
                <Checkbox name="shuffle_options" defaultChecked={a.shuffle_options} label="Acak urutan pilihan" />
                <Checkbox name="show_score" defaultChecked={a.show_score} label="Tampilkan nilai ke siswa" />
                <Checkbox name="show_review" defaultChecked={a.show_review} label="Tampilkan pembahasan" desc="Siswa melihat kunci & pembahasan setelah mengumpulkan" />
              </div>
              <SubmitButton className="w-full">Simpan Pengaturan</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="QR asesmen" desc="Tampilkan di kelas — siswa scan untuk langsung membuka asesmen ini" />
            <div className="p-5">
              <QrDisplay path={`/siswa/kuis/${a.id}`} size={190} filename={`qr-${a.type}-${a.id.slice(0, 6)}`} caption={a.title} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

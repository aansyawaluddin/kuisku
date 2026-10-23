"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Copy, FileText, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, SubmitButton } from "./form-bits";
import { Modal } from "./modal";
import { Badge, Button, Card, EmptyState, Field, Input, Label, Select, Textarea } from "./ui";
import { copyQuestions, deleteQuestion, importQuestions, reorderQuestions, saveQuestion } from "@/lib/actions/academic";
import { createClient } from "@/lib/supabase/client";
import type { AssessmentType, Option, Question } from "@/lib/types";
import { cn, STAGE } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Draft = {
  id?: string;
  question: string;
  image_url: string | null;
  options: Option[];
  correct_option: string;
  explanation: string;
  points: number;
};

const emptyDraft = (): Draft => ({
  question: "",
  image_url: null,
  options: LETTERS.slice(0, 4).map((id) => ({ id, text: "" })),
  correct_option: "A",
  explanation: "",
  points: 1,
});

function keyOf(q: Question) {
  const k = q.question_keys;
  return Array.isArray(k) ? k[0] : k;
}

export function QuestionEditor({
  assessmentId,
  questions: initial,
  siblings,
}: {
  assessmentId: string;
  questions: Question[];
  siblings: { id: string; type: AssessmentType; question_count: number }[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setQuestions(initial);
  }
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  function edit(q: Question) {
    const k = keyOf(q);
    setDraft({
      id: q.id,
      question: q.question,
      image_url: q.image_url,
      options: q.options,
      correct_option: k?.correct_option ?? q.options[0]?.id ?? "A",
      explanation: k?.explanation ?? "",
      points: q.points,
    });
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...questions];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setQuestions(next);
    start(async () => {
      const res = await reorderQuestions(assessmentId, next.map((q) => q.id));
      if (res?.error) toast.error(res.error);
    });
  }

  function remove(q: Question) {
    if (!confirm("Hapus soal ini? Jawaban siswa untuk soal ini juga terhapus.")) return;
    start(async () => {
      const res = await deleteQuestion(q.id, assessmentId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Soal dihapus");
        setQuestions((qs) => qs.filter((x) => x.id !== q.id));
        router.refresh();
      }
    });
  }

  const totalPoints = questions.reduce((a, q) => a + q.points, 0);
  const copySources = siblings.filter((s) => s.id !== assessmentId && s.question_count > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Bank soal</h2>
          <p className="text-sm text-slate-500">
            {questions.length} soal · total bobot {totalPoints}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {copySources.length > 0 && (
            <Modal
              title="Salin soal dari asesmen lain"
              desc="Tips: gunakan soal yang sama pada Pre-test dan Post-test agar perhitungan N-Gain valid."
              trigger={(open) => (
                <Button variant="outline" size="sm" onClick={open}>
                  <Copy className="size-4" /> Salin
                </Button>
              )}
            >
              <ActionForm action={copyQuestions} closeOnSuccess onSuccess={() => router.refresh()} className="space-y-4">
                <input type="hidden" name="to_id" value={assessmentId} />
                <Field label="Sumber soal">
                  <Select name="from_id" required>
                    {copySources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {STAGE[s.type].label} ({s.question_count} soal)
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-sm text-slate-500">Soal akan ditambahkan di akhir daftar (soal yang sudah ada tidak dihapus).</p>
                <div className="flex justify-end">
                  <SubmitButton>Salin Soal</SubmitButton>
                </div>
              </ActionForm>
            </Modal>
          )}
          <Modal
            title="Import soal (format Aiken)"
            desc="Tempel banyak soal sekaligus. Pisahkan antar soal dengan satu baris kosong."
            wide
            trigger={(open) => (
              <Button variant="outline" size="sm" onClick={open}>
                <FileText className="size-4" /> Import
              </Button>
            )}
          >
            <ActionForm action={importQuestions} closeOnSuccess onSuccess={() => router.refresh()} className="space-y-4">
              <input type="hidden" name="assessment_id" value={assessmentId} />
              <Textarea
                name="text"
                rows={14}
                required
                className="font-mono text-xs"
                placeholder={
                  "Organisme yang dapat membuat makanannya sendiri disebut...\nA. Konsumen\nB. Produsen\nC. Dekomposer\nD. Predator\nANSWER: B\nPEMBAHASAN: Produsen (tumbuhan hijau) berfotosintesis.\n\nHewan pemakan tumbuhan disebut...\nA. Karnivora\nB. Omnivora\nC. Herbivora\nANSWER: C"
                }
              />
              <p className="text-xs text-slate-500">Kata kunci jawaban yang dikenali: ANSWER / JAWABAN / KUNCI. Pembahasan (opsional): PEMBAHASAN.</p>
              <div className="flex justify-end">
                <SubmitButton pendingText="Mengimpor...">Import</SubmitButton>
              </div>
            </ActionForm>
          </Modal>
          <Button size="sm" onClick={() => setDraft(emptyDraft())}>
            <Plus className="size-4" /> Tambah Soal
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <EmptyState icon={<FileText className="size-6" />} title="Belum ada soal" desc="Tambahkan soal satu per satu, import format Aiken, atau salin dari asesmen lain." />
      ) : (
        <div className={cn("space-y-3", pending && "opacity-70")}>
          {questions.map((q, i) => {
            const k = keyOf(q);
            return (
              <Card key={q.id} className="p-4 sm:p-5">
                <div className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap font-medium">{q.question}</p>
                    {q.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.image_url} alt="" className="mt-2 max-h-40 rounded-xl border border-slate-200" />
                    )}
                    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {q.options.map((o) => (
                        <li
                          key={o.id}
                          className={cn(
                            "flex items-start gap-2 rounded-lg border px-3 py-1.5 text-sm",
                            k?.correct_option === o.id ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800" : "border-slate-200 text-slate-600",
                          )}
                        >
                          <span className="font-bold">{o.id}.</span>
                          <span className="flex-1">{o.text}</span>
                          {k?.correct_option === o.id && <Check className="mt-0.5 size-4 shrink-0" />}
                        </li>
                      ))}
                    </ul>
                    {k?.explanation && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">💡 {k.explanation}</p>}
                    {!k && <p className="mt-2 text-xs font-semibold text-rose-600">⚠ Kunci jawaban belum diatur</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge>{q.points} poin</Badge>
                    <div className="flex flex-col gap-0.5 sm:flex-row">
                      <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naik">
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Turun">
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => edit(q)} aria-label="Ubah">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(q)} aria-label="Hapus">
                        <Trash2 className="size-4 text-rose-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal title={draft?.id ? "Ubah Soal" : "Soal Baru"} wide open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        {draft && (
          <DraftForm
            draft={draft}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={async (andNew) => {
              const res = await saveQuestion({ ...draft, assessment_id: assessmentId });
              if (res.error) return toast.error(res.error);
              toast.success("Soal disimpan");
              router.refresh();
              setDraft(andNew ? emptyDraft() : null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function DraftForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: (andNew: boolean) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 2 MB");
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `soal/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      set({ image_url: data.publicUrl });
    } catch (e) {
      toast.error("Upload gagal: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(andNew: boolean) {
    setSaving(true);
    try {
      await onSave(andNew);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Field label="Pertanyaan">
        <Textarea value={draft.question} onChange={(e) => set({ question: e.target.value })} rows={4} placeholder="Tulis pertanyaan..." autoFocus />
      </Field>

      <div>
        <Label>Gambar (opsional)</Label>
        {draft.image_url ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.image_url} alt="" className="max-h-48 rounded-xl border border-slate-200" />
            <button type="button" onClick={() => set({ image_url: null })} className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-rose-600 text-white shadow" aria-label="Hapus gambar">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-300 hover:bg-brand-50">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Upload gambar
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            <span className="text-xs text-slate-400">atau</span>
            <Input placeholder="Tempel URL gambar" className="max-w-xs" onBlur={(e) => e.target.value && set({ image_url: e.target.value })} />
          </div>
        )}
      </div>

      <div>
        <Label>Pilihan jawaban — klik lingkaran untuk menandai kunci</Label>
        <div className="space-y-2">
          {draft.options.map((o, idx) => (
            <div key={o.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => set({ correct_option: o.id })}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition",
                  draft.correct_option === o.id ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-500 hover:border-emerald-400",
                )}
                aria-label={`Tandai ${o.id} benar`}
              >
                {draft.correct_option === o.id ? <Check className="size-4" /> : o.id}
              </button>
              <Input
                value={o.text}
                onChange={(e) => set({ options: draft.options.map((x, j) => (j === idx ? { ...x, text: e.target.value } : x)) })}
                placeholder={`Pilihan ${o.id}`}
              />
              {draft.options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Hapus pilihan"
                  onClick={() => {
                    const opts = draft.options.filter((_, j) => j !== idx).map((x, j) => ({ ...x, id: LETTERS[j] }));
                    const oldIdx = draft.options.findIndex((x) => x.id === draft.correct_option);
                    const newCorrect = oldIdx === idx ? "A" : LETTERS[oldIdx > idx ? oldIdx - 1 : oldIdx];
                    set({ options: opts, correct_option: newCorrect });
                  }}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {draft.options.length < LETTERS.length && (
            <Button type="button" variant="ghost" size="sm" onClick={() => set({ options: [...draft.options, { id: LETTERS[draft.options.length], text: "" }] })}>
              <Plus className="size-4" /> Tambah pilihan
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => set({ options: [{ id: "A", text: "Benar" }, { id: "B", text: "Salah" }], correct_option: "A" })}
          >
            Jadikan Benar/Salah
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <Field label="Bobot">
          <Input type="number" min={1} max={100} value={draft.points} onChange={(e) => set({ points: Number(e.target.value) || 1 })} />
        </Field>
        <Field label="Pembahasan (opsional)" hint="Ditampilkan ke siswa bila 'Tampilkan pembahasan' aktif">
          <Textarea value={draft.explanation} onChange={(e) => set({ explanation: e.target.value })} rows={2} />
        </Field>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        {!draft.id && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => submit(true)}>
            Simpan & Tambah Lagi
          </Button>
        )}
        <Button type="button" disabled={saving || uploading} onClick={() => submit(false)}>
          {saving && <Loader2 className="size-4 animate-spin" />} Simpan Soal
        </Button>
      </div>
    </div>
  );
}

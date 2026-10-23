"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, Option } from "@/lib/types";
import { errMsg, fromLocalInput } from "@/lib/utils";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

// ======================= KELAS =======================
export async function createClass(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | undefined;
  try {
    const me = await assertRole(["superadmin", "mentor"]);
    const name = str(fd, "name");
    if (!name) throw new Error("Nama kelas wajib diisi");
    const mentor_id = me.role === "superadmin" ? str(fd, "mentor_id") || null : me.id;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("classes")
      .insert({ name, description: str(fd, "description") || null, mentor_id })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  } catch (e) {
    return { error: errMsg(e) };
  }
  redirect(`/mentor/kelas/${id}`);
}

export async function updateClass(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await assertRole(["superadmin", "mentor"]);
    const id = str(fd, "id");
    const patch: Record<string, unknown> = {
      name: str(fd, "name"),
      description: str(fd, "description") || null,
      is_active: bool(fd, "is_active"),
    };
    if (me.role === "superadmin") patch.mentor_id = str(fd, "mentor_id") || null;
    if (!patch.name) throw new Error("Nama kelas wajib diisi");
    const supabase = await createClient();
    const { error } = await supabase.from("classes").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath(`/mentor/kelas/${id}`);
    return { ok: true, message: "Kelas diperbarui" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function regenerateClassCode(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const id = str(fd, "id");
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const supabase = await createClient();
    const { error } = await supabase.from("classes").update({ code }).eq("id", id);
    if (error) throw error;
    revalidatePath(`/mentor/kelas/${id}`);
    return { ok: true, message: `Kode kelas baru: ${code}` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteClass(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const supabase = await createClient();
    const { error } = await supabase.from("classes").delete().eq("id", str(fd, "id"));
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  redirect("/mentor/kelas");
}

export async function addMembers(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const classId = str(fd, "class_id");
    const ids = fd.getAll("student_id").map(String).filter(Boolean);
    if (!ids.length) throw new Error("Pilih minimal satu siswa");
    const supabase = await createClient();
    const { error } = await supabase
      .from("class_members")
      .upsert(ids.map((student_id) => ({ class_id: classId, student_id })), { onConflict: "class_id,student_id", ignoreDuplicates: true });
    if (error) throw error;
    revalidatePath(`/mentor/kelas/${classId}`);
    return { ok: true, message: `${ids.length} siswa ditambahkan` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function removeMember(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const classId = str(fd, "class_id");
    const supabase = await createClient();
    const { error } = await supabase.from("class_members").delete().eq("class_id", classId).eq("student_id", str(fd, "student_id"));
    if (error) throw error;
    revalidatePath(`/mentor/kelas/${classId}`);
    return { ok: true, message: "Siswa dikeluarkan dari kelas" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function joinClass(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["siswa"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("join_class", { p_code: str(fd, "code") });
    if (error) throw error;
    revalidatePath("/siswa");
    return { ok: true, message: "Berhasil bergabung ke kelas!" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ======================= MATERI =======================
export async function createMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | undefined;
  try {
    const me = await assertRole(["superadmin", "mentor"]);
    const title = str(fd, "title");
    if (!title) throw new Error("Judul materi wajib diisi");
    const supabase = await createClient();
    const classId = str(fd, "class_id");
    const { count } = await supabase.from("materials").select("id", { count: "exact", head: true }).eq("class_id", classId);
    const { data, error } = await supabase
      .from("materials")
      .insert({ class_id: classId, title, description: str(fd, "description") || null, created_by: me.id, order_index: count ?? 0 })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  } catch (e) {
    return { error: errMsg(e) };
  }
  redirect(`/mentor/materi/${id}`);
}

export async function updateMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const id = str(fd, "id");
    const title = str(fd, "title");
    if (!title) throw new Error("Judul wajib diisi");
    const supabase = await createClient();
    const { error } = await supabase
      .from("materials")
      .update({
        title,
        description: str(fd, "description") || null,
        content_intro: str(fd, "content_intro") || null,
        content_main: str(fd, "content_main") || null,
        video_url: str(fd, "video_url") || null,
        enforce_sequence: bool(fd, "enforce_sequence"),
        is_published: bool(fd, "is_published"),
      })
      .eq("id", id);
    if (error) throw error;
    revalidatePath(`/mentor/materi/${id}`);
    return { ok: true, message: "Materi disimpan" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function togglePublish(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const id = str(fd, "id");
    const supabase = await createClient();
    const { data } = await supabase.from("materials").select("is_published, class_id").eq("id", id).single();
    const { error } = await supabase.from("materials").update({ is_published: !data?.is_published }).eq("id", id);
    if (error) throw error;
    revalidatePath(`/mentor/materi/${id}`);
    revalidatePath(`/mentor/kelas/${data?.class_id}`);
    return { ok: true, message: data?.is_published ? "Materi disembunyikan dari siswa" : "Materi dipublikasikan ke siswa" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  let classId: string | undefined;
  try {
    await assertRole(["superadmin", "mentor"]);
    const id = str(fd, "id");
    const supabase = await createClient();
    const { data } = await supabase.from("materials").select("class_id").eq("id", id).single();
    classId = data?.class_id;
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  redirect(`/mentor/kelas/${classId}`);
}

// ======================= ASESMEN =======================
export async function updateAssessment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const id = str(fd, "id");
    const duration = str(fd, "duration_minutes");
    const passing = Number(str(fd, "passing_score") || 0);
    const maxAttempts = Number(str(fd, "max_attempts") || 0);
    if (passing < 0 || passing > 100) throw new Error("KKM harus 0–100");
    const open_at = fromLocalInput(str(fd, "open_at"));
    const close_at = fromLocalInput(str(fd, "close_at"));
    if (open_at && close_at && open_at >= close_at) throw new Error("Jadwal tutup harus setelah jadwal buka");
    const supabase = await createClient();
    const { error } = await supabase
      .from("assessments")
      .update({
        title: str(fd, "title"),
        instructions: str(fd, "instructions") || null,
        duration_minutes: duration ? Math.max(1, Number(duration)) : null,
        passing_score: passing,
        max_attempts: Math.max(0, maxAttempts),
        shuffle_questions: bool(fd, "shuffle_questions"),
        shuffle_options: bool(fd, "shuffle_options"),
        show_score: bool(fd, "show_score"),
        show_review: bool(fd, "show_review"),
        is_open: bool(fd, "is_open"),
        open_at,
        close_at,
      })
      .eq("id", id);
    if (error) throw error;
    revalidatePath(`/mentor/asesmen/${id}`);
    return { ok: true, message: "Pengaturan asesmen disimpan" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function toggleAssessmentOpen(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const id = str(fd, "id");
    const supabase = await createClient();
    const { data } = await supabase.from("assessments").select("is_open, material_id").eq("id", id).single();
    const { error } = await supabase.from("assessments").update({ is_open: !data?.is_open }).eq("id", id);
    if (error) throw error;
    revalidatePath(`/mentor/asesmen/${id}`);
    revalidatePath(`/mentor/materi/${data?.material_id}`);
    return { ok: true, message: data?.is_open ? "Asesmen ditutup" : "Asesmen dibuka" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ======================= SOAL =======================
export type QuestionInput = {
  id?: string;
  assessment_id: string;
  question: string;
  image_url?: string | null;
  options: Option[];
  correct_option: string;
  explanation?: string | null;
  points: number;
};

function validateQuestion(q: QuestionInput) {
  if (!q.question.trim()) throw new Error("Teks soal wajib diisi");
  const opts = q.options.filter((o) => o.text.trim());
  if (opts.length < 2) throw new Error("Minimal 2 pilihan jawaban");
  if (!opts.some((o) => o.id === q.correct_option)) throw new Error("Pilih kunci jawaban yang benar");
  if (!Number.isFinite(q.points) || q.points < 1) throw new Error("Bobot minimal 1");
  return opts;
}

export async function saveQuestion(q: QuestionInput): Promise<ActionState & { id?: string }> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const opts = validateQuestion(q);
    const supabase = await createClient();
    let id = q.id;
    const row = { question: q.question.trim(), image_url: q.image_url || null, options: opts, points: Math.round(q.points) };
    if (id) {
      const { error } = await supabase.from("questions").update(row).eq("id", id);
      if (error) throw error;
    } else {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("assessment_id", q.assessment_id);
      const { data, error } = await supabase
        .from("questions")
        .insert({ ...row, assessment_id: q.assessment_id, order_index: count ?? 0 })
        .select("id")
        .single();
      if (error) throw error;
      id = data.id;
    }
    const { error: kErr } = await supabase
      .from("question_keys")
      .upsert({ question_id: id, correct_option: q.correct_option, explanation: q.explanation?.trim() || null });
    if (kErr) throw kErr;
    revalidatePath(`/mentor/asesmen/${q.assessment_id}`);
    return { ok: true, id, message: "Soal disimpan" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteQuestion(id: string, assessmentId: string): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const supabase = await createClient();
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) throw error;
    revalidatePath(`/mentor/asesmen/${assessmentId}`);
    return { ok: true, message: "Soal dihapus" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function reorderQuestions(assessmentId: string, orderedIds: string[]): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const supabase = await createClient();
    await Promise.all(orderedIds.map((id, i) => supabase.from("questions").update({ order_index: i }).eq("id", id).eq("assessment_id", assessmentId)));
    revalidatePath(`/mentor/asesmen/${assessmentId}`);
    return { ok: true };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/**
 * Import format Aiken:
 *   Apa ibu kota Indonesia?
 *   A. Bandung
 *   B. Jakarta
 *   ANSWER: B
 * (baris kosong antar soal; opsional "PEMBAHASAN: ..." setelah ANSWER)
 */
export async function importQuestions(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const assessmentId = str(fd, "assessment_id");
    const raw = String(fd.get("text") ?? "").replace(/\r/g, "");
    const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) throw new Error("Teks soal kosong");
    const parsed: QuestionInput[] = [];
    const errors: string[] = [];
    blocks.forEach((block, bi) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const qLines: string[] = [];
      const options: Option[] = [];
      let answer = "";
      let explanation = "";
      for (const line of lines) {
        const opt = line.match(/^([A-Fa-f])[.)]\s+(.+)$/);
        const ans = line.match(/^(ANSWER|JAWABAN|KUNCI)\s*[:=]\s*([A-Fa-f])/i);
        const exp = line.match(/^(PEMBAHASAN|EXPLANATION)\s*[:=]\s*(.+)$/i);
        if (ans) answer = ans[2].toUpperCase();
        else if (exp) explanation = exp[2];
        else if (opt && !answer) options.push({ id: opt[1].toUpperCase(), text: opt[2] });
        else if (!options.length) qLines.push(line.replace(/^\d+[.)]\s*/, ""));
      }
      if (!qLines.length || options.length < 2 || !answer || !options.some((o) => o.id === answer)) {
        errors.push(`Soal #${bi + 1}`);
        return;
      }
      parsed.push({ assessment_id: assessmentId, question: qLines.join("\n"), options, correct_option: answer, explanation, points: 1 });
    });
    if (!parsed.length) throw new Error("Tidak ada soal valid. Periksa format (pilihan A./B./..., dan baris ANSWER: X).");

    const supabase = await createClient();
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("assessment_id", assessmentId);
    const { data: inserted, error } = await supabase
      .from("questions")
      .insert(parsed.map((p, i) => ({ assessment_id: assessmentId, question: p.question, options: p.options, points: 1, order_index: (count ?? 0) + i })))
      .select("id, order_index");
    if (error) throw error;
    const byOrder = new Map(inserted.map((r) => [r.order_index, r.id]));
    const { error: kErr } = await supabase.from("question_keys").insert(
      parsed.map((p, i) => ({ question_id: byOrder.get((count ?? 0) + i), correct_option: p.correct_option, explanation: p.explanation || null })),
    );
    if (kErr) throw kErr;
    revalidatePath(`/mentor/asesmen/${assessmentId}`);
    return { ok: true, message: `${parsed.length} soal diimpor${errors.length ? `, dilewati: ${errors.join(", ")}` : ""}` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** Salin semua soal dari asesmen lain (mis. Pre-test -> Post-test agar N-Gain valid). */
export async function copyQuestions(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const from = str(fd, "from_id");
    const to = str(fd, "to_id");
    const supabase = await createClient();
    const { data: src, error } = await supabase
      .from("questions")
      .select("question, image_url, options, points, order_index, question_keys(correct_option, explanation)")
      .eq("assessment_id", from)
      .order("order_index");
    if (error) throw error;
    if (!src?.length) throw new Error("Asesmen sumber belum memiliki soal");
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("assessment_id", to);
    const { data: ins, error: iErr } = await supabase
      .from("questions")
      .insert(src.map((s, i) => ({ assessment_id: to, question: s.question, image_url: s.image_url, options: s.options, points: s.points, order_index: (count ?? 0) + i })))
      .select("id, order_index");
    if (iErr) throw iErr;
    const byOrder = new Map(ins.map((r) => [r.order_index, r.id]));
    const keys = src
      .map((s, i) => {
        const k = Array.isArray(s.question_keys) ? s.question_keys[0] : s.question_keys;
        return k ? { question_id: byOrder.get((count ?? 0) + i), correct_option: k.correct_option, explanation: k.explanation } : null;
      })
      .filter((k): k is NonNullable<typeof k> => k !== null);
    if (keys.length) {
      const { error: kErr } = await supabase.from("question_keys").insert(keys);
      if (kErr) throw kErr;
    }
    revalidatePath(`/mentor/asesmen/${to}`);
    return { ok: true, message: `${src.length} soal disalin` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ======================= HASIL =======================
export async function resetAttempt(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const supabase = await createClient();
    const assessmentId = str(fd, "assessment_id");
    const { error } = await supabase.from("attempts").delete().eq("assessment_id", assessmentId).eq("student_id", str(fd, "student_id"));
    if (error) throw error;
    revalidatePath(`/mentor/asesmen/${assessmentId}/hasil`);
    return { ok: true, message: "Percobaan siswa direset, siswa dapat mengerjakan ulang" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

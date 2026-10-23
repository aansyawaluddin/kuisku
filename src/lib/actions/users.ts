"use server";

import { revalidatePath } from "next/cache";
import { assertRole, studentEmail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, Role } from "@/lib/types";
import { errMsg } from "@/lib/utils";

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

/** Password default import: sama dengan username; jika < 6 karakter ditambah "123". */
function defaultPassword(username: string) {
  return username.length >= 6 ? username : `${username}123`;
}

async function canManageStudent(studentId: string, role: Role) {
  if (role === "superadmin") return true;
  const supabase = await createClient();
  const { count } = await supabase.from("class_members").select("class_id", { count: "exact", head: true }).eq("student_id", studentId);
  return (count ?? 0) > 0;
}

async function createAccount(input: {
  full_name: string;
  username?: string | null;
  email?: string | null;
  password: string;
  role: Role;
  nis?: string | null;
}) {
  const admin = createAdminClient();
  const username = input.username?.trim().toLowerCase() || null;
  if (username && !USERNAME_RE.test(username)) throw new Error(`Username "${username}" tidak valid (3-40 karakter: huruf kecil, angka, . _ -)`);
  if (!username && !input.email) throw new Error("Isi username atau email");
  if (input.password.length < 6) throw new Error("Password minimal 6 karakter");
  if (username) {
    const { data: exists } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (exists) throw new Error(`Username "${username}" sudah dipakai`);
  }
  const email = (input.email?.trim().toLowerCase() || studentEmail(username!)) as string;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim(), username, nis: input.nis?.trim() || null },
    app_metadata: { role: input.role },
  });
  if (error) throw new Error(error.message.includes("already") ? `Email ${email} sudah terdaftar` : error.message);
  return data.user.id;
}

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await assertRole(["superadmin", "mentor"]);
    const role = (String(fd.get("role") || "siswa") as Role) ?? "siswa";
    if (me.role === "mentor" && role !== "siswa") throw new Error("Mentor hanya dapat membuat akun siswa");
    const full_name = String(fd.get("full_name") ?? "").trim();
    if (!full_name) throw new Error("Nama wajib diisi");
    const classId = String(fd.get("class_id") ?? "") || null;

    const id = await createAccount({
      full_name,
      username: String(fd.get("username") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      nis: String(fd.get("nis") ?? ""),
      role,
    });

    if (classId && role === "siswa") {
      const supabase = await createClient();
      const { error } = await supabase.from("class_members").insert({ class_id: classId, student_id: id });
      if (error) throw new Error("Akun dibuat, tapi gagal menambahkan ke kelas: " + error.message);
      revalidatePath(`/mentor/kelas/${classId}`);
    }
    revalidatePath("/admin/pengguna");
    return { ok: true, message: `Akun ${full_name} berhasil dibuat` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function updateUser(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await assertRole(["superadmin", "mentor"]);
    const id = String(fd.get("id"));
    const admin = createAdminClient();
    const { data: target } = await admin.from("profiles").select("*").eq("id", id).single();
    if (!target) throw new Error("Pengguna tidak ditemukan");
    if (me.role === "mentor" && (target.role !== "siswa" || !(await canManageStudent(id, me.role)))) throw new Error("Akses ditolak");

    const full_name = String(fd.get("full_name") ?? "").trim();
    const username = String(fd.get("username") ?? "").trim().toLowerCase() || null;
    const nis = String(fd.get("nis") ?? "").trim() || null;
    const password = String(fd.get("password") ?? "");
    const role = me.role === "superadmin" && fd.get("role") ? (String(fd.get("role")) as Role) : target.role;
    if (!full_name) throw new Error("Nama wajib diisi");
    if (username && !USERNAME_RE.test(username)) throw new Error("Username tidak valid");
    if (username && username !== target.username) {
      const { data: dup } = await admin.from("profiles").select("id").eq("username", username).neq("id", id).maybeSingle();
      if (dup) throw new Error("Username sudah dipakai");
    }
    if (id === me.id && role !== target.role) throw new Error("Tidak dapat mengubah role akun sendiri");

    const authUpdate: Record<string, unknown> = { app_metadata: { role } };
    if (password) {
      if (password.length < 6) throw new Error("Password minimal 6 karakter");
      authUpdate.password = password;
    }
    const { error: aErr } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (aErr) throw new Error(aErr.message);
    const { error } = await admin.from("profiles").update({ full_name, username, nis, role }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/pengguna");
    revalidatePath("/mentor", "layout");
    return { ok: true, message: "Data pengguna diperbarui" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function toggleActive(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await assertRole(["superadmin"]);
    const id = String(fd.get("id"));
    if (id === me.id) throw new Error("Tidak dapat menonaktifkan akun sendiri");
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("is_active").eq("id", id).single();
    const next = !data?.is_active;
    await admin.from("profiles").update({ is_active: next }).eq("id", id);
    await admin.auth.admin.updateUserById(id, { ban_duration: next ? "none" : "876000h" });
    revalidatePath("/admin/pengguna");
    return { ok: true, message: next ? "Akun diaktifkan" : "Akun dinonaktifkan" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await assertRole(["superadmin"]);
    const id = String(fd.get("id"));
    if (id === me.id) throw new Error("Tidak dapat menghapus akun sendiri");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/pengguna");
    return { ok: true, message: "Akun dihapus permanen" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function resetLoginToken(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await assertRole(["superadmin", "mentor"]);
    const id = String(fd.get("id"));
    if (!(await canManageStudent(id, me.role))) throw new Error("Akses ditolak");
    const admin = createAdminClient();
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
    const { error } = await admin.from("profiles").update({ login_token: token }).eq("id", id).eq("role", "siswa");
    if (error) throw new Error(error.message);
    revalidatePath("/mentor", "layout");
    return { ok: true, message: "QR kartu login direset. Kartu lama tidak berlaku lagi." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/**
 * Import siswa massal. Format per baris: nama, username/NIS, password(opsional)
 * Password default = username (ditambah "123" bila kurang dari 6 karakter).
 */
export async function importStudents(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertRole(["superadmin", "mentor"]);
    const classId = String(fd.get("class_id") ?? "");
    const raw = String(fd.get("rows") ?? "");
    const supabase = await createClient();
    const { data: cls } = await supabase.from("classes").select("id").eq("id", classId).single();
    if (!cls) throw new Error("Kelas tidak ditemukan");

    const admin = createAdminClient();
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) throw new Error("Tidak ada data");
    if (lines.length > 200) throw new Error("Maksimal 200 baris sekali import");

    let created = 0;
    let added = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      const [full_name, usernameRaw, pwd] = parts;
      if (i === 0 && /^nama$/i.test(full_name)) continue; // baris header
      const username = (usernameRaw || "").toLowerCase();
      if (!full_name || !username) {
        errors.push(`Baris ${i + 1}: nama & username wajib`);
        continue;
      }
      try {
        const { data: existing } = await admin.from("profiles").select("id, role").eq("username", username).maybeSingle();
        let id = existing?.id as string | undefined;
        if (existing && existing.role !== "siswa") throw new Error("username dipakai akun non-siswa");
        if (!id) {
          id = await createAccount({ full_name, username, password: pwd || defaultPassword(username), role: "siswa", nis: username });
          created++;
        }
        const { error } = await supabase.from("class_members").upsert({ class_id: classId, student_id: id }, { onConflict: "class_id,student_id", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        added++;
      } catch (e) {
        errors.push(`Baris ${i + 1} (${username}): ${errMsg(e)}`);
      }
    }
    revalidatePath(`/mentor/kelas/${classId}`);
    const msg = `${created} akun baru dibuat, ${added} siswa masuk kelas.`;
    if (errors.length) return { ok: true, message: msg + ` ${errors.length} gagal: ` + errors.slice(0, 3).join(" | ") };
    return { ok: true, message: msg };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

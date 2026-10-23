"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { errMsg } from "@/lib/utils";

export async function updateMyName(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await getProfile();
    if (!me) throw new Error("Sesi berakhir");
    const full_name = String(fd.get("full_name") ?? "").trim();
    if (full_name.length < 2) throw new Error("Nama terlalu pendek");
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ full_name }).eq("id", me.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Nama diperbarui" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function changeMyPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await getProfile();
    if (!me?.email) throw new Error("Sesi berakhir");
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (next.length < 6) throw new Error("Password baru minimal 6 karakter");
    if (next !== confirm) throw new Error("Konfirmasi password tidak cocok");
    const supabase = await createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: me.email, password: current });
    if (signErr) throw new Error("Password lama salah");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw error;
    return { ok: true, message: "Password berhasil diganti" };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

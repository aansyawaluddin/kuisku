"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";

function safeNext(next: unknown) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function loginWithPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const identifier = String(fd.get("identifier") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!identifier || !password) return { error: "Isi username/email dan password" };

  let email = identifier.toLowerCase();
  if (!identifier.includes("@")) {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("email").eq("username", identifier.toLowerCase()).maybeSingle();
    if (!data?.email) return { error: "Username atau password salah" };
    email = data.email;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Username atau password salah" };

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).single();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "Akun Anda dinonaktifkan. Hubungi mentor/admin." };
  }
  redirect(safeNext(fd.get("next")));
}

/** Login siswa memakai kartu QR berisi token rahasia. */
export async function loginWithQr(raw: string, next?: string): Promise<ActionState> {
  const token = raw.trim().replace(/^KUISKU:LOGIN:/i, "");
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    return { error: "QR ini bukan kartu login MBG" };
  }
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, role, is_active")
    .eq("login_token", token.toLowerCase())
    .maybeSingle();
  if (!profile || profile.role !== "siswa" || !profile.email) return { error: "Kartu tidak dikenali atau sudah direset" };
  if (!profile.is_active) return { error: "Akun dinonaktifkan. Hubungi mentor." };

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.email });
  if (linkErr || !link.properties?.hashed_token) return { error: "Gagal membuat sesi login" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error) return { error: "Gagal login: " + error.message };
  redirect(safeNext(next));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

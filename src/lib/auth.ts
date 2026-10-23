import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

/** Profil user yang sedang login (di-cache per request). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
  return (data as Profile) ?? null;
});

export async function requireProfile(roles?: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?error=nonaktif");
  if (roles && !roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

export function homeFor(role: Role) {
  return role === "superadmin" ? "/admin" : role === "mentor" ? "/mentor" : "/siswa";
}

/** Untuk server action: kembalikan profil atau lempar error. */
export async function assertRole(roles: Role[]) {
  const profile = await getProfile();
  if (!profile || !profile.is_active || !roles.includes(profile.role)) {
    throw new Error("Akses ditolak");
  }
  return profile;
}

export function studentEmail(username: string) {
  const domain = process.env.STUDENT_EMAIL_DOMAIN || "siswa.kuisku.id";
  return `${username.toLowerCase()}@${domain}`;
}

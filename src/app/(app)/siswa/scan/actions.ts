"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { errMsg } from "@/lib/utils";

export async function joinClassByCode(code: string): Promise<ActionState> {
  try {
    await assertRole(["siswa"]);
    const supabase = await createClient();
    const { data: classId, error } = await supabase.rpc("join_class", { p_code: code });
    if (error) throw error;
    const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();
    revalidatePath("/siswa");
    return { ok: true, message: `Berhasil bergabung ke ${cls?.name ?? "kelas"}` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

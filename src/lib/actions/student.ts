"use server";

import { redirect } from "next/navigation";
import { assertRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { errMsg } from "@/lib/utils";

export async function startAttempt(_: ActionState, fd: FormData): Promise<ActionState> {
  let attemptId: string | undefined;
  try {
    await assertRole(["siswa"]);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_attempt", { p_assessment_id: String(fd.get("assessment_id")) });
    if (error) throw error;
    attemptId = data as string;
  } catch (e) {
    return { error: errMsg(e) };
  }
  redirect(`/kerjakan/${attemptId}`);
}

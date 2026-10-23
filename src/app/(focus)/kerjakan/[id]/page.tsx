import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { RunnerData } from "@/components/quiz-runner";
import { QuizRunnerClient } from "@/components/quiz-runner-client";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mengerjakan Asesmen" };

export default async function TakeQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt", { p_attempt_id: id });
  if (error || !data) notFound();
  const d = data as RunnerData;
  if (d.attempt.status !== "in_progress") redirect(`/siswa/hasil/${id}`);
  return <QuizRunnerClient data={d} />;
}

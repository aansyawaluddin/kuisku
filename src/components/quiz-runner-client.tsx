"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { RunnerData } from "./quiz-runner";

// Render hanya di browser: timer & penanda ragu-ragu memakai jam dan localStorage perangkat.
const QuizRunner = dynamic(() => import("./quiz-runner").then((m) => m.QuizRunner), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="size-8 animate-spin text-brand-600" />
    </div>
  ),
});

export function QuizRunnerClient({ data }: { data: RunnerData }) {
  return <QuizRunner data={data} />;
}

import type { Assessment, AssessmentType, Attempt, Material } from "./types";
import { STAGE, STAGE_ORDER } from "./utils";

export type StageStatus = "empty" | "locked" | "scheduled" | "closed" | "available" | "in_progress" | "done";

export type StageState = {
  type: AssessmentType;
  assessment: Assessment;
  status: StageStatus;
  reason?: string;
  attemptsUsed: number;
  best: Attempt | null;
  latest: Attempt | null;
  inProgress: Attempt | null;
  canStart: boolean;
  submitted: boolean;
};

export type MaterialProgress = {
  stages: Record<AssessmentType, StageState | undefined>;
  introUnlocked: boolean;
  mainUnlocked: boolean;
  completed: number;
  total: number;
  next: { kind: "assessment"; state: StageState } | null;
};

export function computeProgress(material: Material, assessments: Assessment[], attempts: Attempt[], now = Date.now()): MaterialProgress {
  const stages = {} as Record<AssessmentType, StageState | undefined>;
  const submittedOf = (t: AssessmentType) => {
    const a = assessments.find((x) => x.type === t);
    return !!a && attempts.some((x) => x.assessment_id === a.id && x.status === "submitted");
  };
  const hasQuestions = (t: AssessmentType) => (assessments.find((x) => x.type === t)?.question_count ?? 0) > 0;

  for (const t of STAGE_ORDER) {
    const a = assessments.find((x) => x.type === t);
    if (!a) continue;
    const mine = attempts.filter((x) => x.assessment_id === a.id).sort((x, y) => x.attempt_no - y.attempt_no);
    const done = mine.filter((x) => x.status === "submitted");
    const best = done.reduce<Attempt | null>((b, x) => (b === null || Number(x.score) > Number(b.score) ? x : b), null);
    const inProgress = mine.find((x) => x.status === "in_progress" && (!x.expires_at || new Date(x.expires_at).getTime() > now)) ?? null;
    const submitted = done.length > 0;
    const attemptsLeft = a.max_attempts === 0 || mine.length < a.max_attempts;
    const passedPost = t === "posttest" && done.some((x) => x.passed);

    let status: StageStatus = "available";
    let reason: string | undefined;
    const prereq = t === "formatif" ? (["pretest"] as AssessmentType[]) : t === "posttest" ? (["pretest", "formatif"] as AssessmentType[]) : [];
    const missing = material.enforce_sequence ? prereq.find((p) => hasQuestions(p) && !submittedOf(p)) : undefined;

    if (a.question_count === 0) {
      status = "empty";
      reason = "Soal belum tersedia";
    } else if (inProgress) {
      status = "in_progress";
    } else if (submitted && (!attemptsLeft || passedPost || t === "pretest")) {
      status = "done";
    } else if (missing) {
      status = "locked";
      reason = `Selesaikan ${STAGE[missing].label} terlebih dahulu`;
    } else if (!a.is_open) {
      status = submitted ? "done" : "closed";
      reason = "Ditutup oleh mentor";
    } else if (a.open_at && new Date(a.open_at).getTime() > now) {
      status = submitted ? "done" : "scheduled";
      reason = "Belum dibuka";
    } else if (a.close_at && new Date(a.close_at).getTime() < now) {
      status = submitted ? "done" : "closed";
      reason = "Jadwal sudah berakhir";
    } else if (submitted) {
      status = "done"; // masih boleh mengulang (formatif / remedial)
    }

    const canStart =
      !!inProgress ||
      (a.question_count > 0 &&
        !missing &&
        a.is_open &&
        !(a.open_at && new Date(a.open_at).getTime() > now) &&
        !(a.close_at && new Date(a.close_at).getTime() < now) &&
        attemptsLeft &&
        !passedPost);

    stages[t] = { type: t, assessment: a, status, reason, attemptsUsed: mine.length, best, latest: done[done.length - 1] ?? null, inProgress, canStart, submitted };
  }

  const introUnlocked = !material.enforce_sequence || !hasQuestions("pretest") || submittedOf("pretest");
  const mainUnlocked = !material.enforce_sequence || (introUnlocked && (!hasQuestions("formatif") || submittedOf("formatif")));
  const relevant = STAGE_ORDER.filter((t) => hasQuestions(t));
  const completed = relevant.filter((t) => submittedOf(t)).length;

  let next: MaterialProgress["next"] = null;
  for (const t of STAGE_ORDER) {
    const s = stages[t];
    if (!s || s.status === "empty") continue;
    if (!s.submitted) {
      next = { kind: "assessment", state: s };
      break;
    }
  }
  return { stages, introUnlocked, mainUnlocked, completed, total: relevant.length, next };
}

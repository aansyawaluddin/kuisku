export type Role = "superadmin" | "mentor" | "siswa";
export type AssessmentType = "pretest" | "formatif" | "posttest";

export type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  role: Role;
  nis: string | null;
  login_token?: string | null;
  is_active: boolean;
  created_at: string;
};

export type ClassRow = {
  id: string;
  name: string;
  description: string | null;
  code: string;
  mentor_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type Material = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  content_intro: string | null;
  content_main: string | null;
  video_url: string | null;
  enforce_sequence: boolean;
  is_published: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type Assessment = {
  id: string;
  material_id: string;
  type: AssessmentType;
  title: string;
  instructions: string | null;
  duration_minutes: number | null;
  passing_score: number;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_score: boolean;
  show_review: boolean;
  is_open: boolean;
  open_at: string | null;
  close_at: string | null;
  question_count: number;
};

export type Option = { id: string; text: string };

export type Question = {
  id: string;
  assessment_id: string;
  order_index: number;
  question: string;
  image_url: string | null;
  options: Option[];
  points: number;
  question_keys?: { correct_option: string; explanation: string | null } | null;
};

export type Attempt = {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_no: number;
  status: "in_progress" | "submitted";
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  correct_count: number | null;
  total_questions: number | null;
  score: number | null;
  passed: boolean | null;
};

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

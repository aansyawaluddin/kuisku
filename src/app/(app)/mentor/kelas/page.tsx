import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Plus, School, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { DialogButton } from "@/components/modal";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createClass } from "@/lib/actions/academic";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kelas" };

export default async function ClassesPage() {
  const me = await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();
  const isAdmin = me.role === "superadmin";

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, description, code, is_active, mentor_id, created_at, profiles:mentor_id(full_name), class_members(count), materials(count)")
    .order("created_at", { ascending: false });

  const { data: mentors } = isAdmin ? await supabase.from("profiles").select("id, full_name").eq("role", "mentor").eq("is_active", true).order("full_name") : { data: [] };

  const createDialog = (
    <DialogButton
      title="Buat Kelas Baru"
      desc="Siswa bisa bergabung memakai kode atau QR kelas."
      label={
        <>
          <Plus className="size-4" /> Kelas Baru
        </>
      }
    >
      <ActionForm action={createClass} className="space-y-4">
        <Field label="Nama kelas">
          <Input name="name" required placeholder="contoh: X IPA 1 — Biologi" />
        </Field>
        <Field label="Deskripsi (opsional)">
          <Textarea name="description" rows={3} placeholder="Tahun ajaran, mata pelajaran, dll." />
        </Field>
        {isAdmin && (
          <Field label="Mentor pengampu">
            <Select name="mentor_id" required defaultValue="">
              <option value="" disabled>
                Pilih mentor
              </option>
              {(mentors ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex justify-end">
          <SubmitButton>Buat Kelas</SubmitButton>
        </div>
      </ActionForm>
    </DialogButton>
  );

  return (
    <div>
      <PageHeader title="Kelas & Materi" desc={isAdmin ? "Semua kelas di platform" : "Kelas yang Anda ampu"} action={createDialog} />
      {!classes?.length ? (
        <EmptyState icon={<School className="size-6" />} title="Belum ada kelas" desc="Buat kelas, tambahkan siswa, lalu susun materi beserta pre-test, formatif, dan post-test." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const members = (c.class_members as unknown as { count: number }[])[0]?.count ?? 0;
            const mats = (c.materials as unknown as { count: number }[])[0]?.count ?? 0;
            const mentor = c.profiles as unknown as { full_name: string } | null;
            return (
              <Link key={c.id} href={`/mentor/kelas/${c.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-lg group-hover:shadow-brand-600/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <School className="size-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {!c.is_active && <Badge className="bg-rose-50 text-rose-700">Nonaktif</Badge>}
                      <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold tracking-widest">{c.code}</span>
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-bold group-hover:text-brand-700">{c.name}</h3>
                  {c.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.description}</p>}
                  {isAdmin && <p className="mt-2 text-xs font-medium text-slate-500">Mentor: {mentor?.full_name ?? "—"}</p>}
                  <div className="mt-4 flex gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-4" /> {members} siswa
                    </span>
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="size-4" /> {mats} materi
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

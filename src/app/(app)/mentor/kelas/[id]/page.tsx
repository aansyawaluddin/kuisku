import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Eye, EyeOff, FileUp, Pencil, Plus, Printer, QrCode, RefreshCw, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/form-bits";
import { DialogButton } from "@/components/modal";
import { QrDisplay } from "@/components/qr-display";
import { StudentPicker } from "@/components/student-picker";
import { Avatar, Badge, Card, CardHeader, Checkbox, EmptyState, Field, Input, LinkButton, PageHeader, Select, Table, Textarea } from "@/components/ui";
import { UserFormDialog } from "@/components/user-form";
import { createMaterial, deleteClass, regenerateClassCode, removeMember, updateClass } from "@/lib/actions/academic";
import { importStudents, resetLoginToken } from "@/lib/actions/users";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Material, Profile } from "@/lib/types";
import { STAGE, STAGE_ORDER } from "@/lib/utils";

export const metadata: Metadata = { title: "Detail Kelas" };

// Import siswa massal membuat banyak akun berurutan; beri waktu lebih di Vercel.
export const maxDuration = 60;

export default async function ClassDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireProfile(["mentor", "superadmin"]);
  const supabase = await createClient();
  const isAdmin = me.role === "superadmin";

  const { data: cls } = await supabase.from("classes").select("*, profiles:mentor_id(full_name)").eq("id", id).maybeSingle();
  if (!cls) notFound();

  const [{ data: materials }, { data: members }, { data: allStudents }, { data: mentors }] = await Promise.all([
    supabase.from("materials").select("*, assessments(id, type, question_count, is_open)").eq("class_id", id).order("order_index").order("created_at"),
    supabase.from("class_members").select("joined_at, profiles!inner(id, full_name, username, nis, email, is_active, role, created_at)").eq("class_id", id),
    supabase.from("profiles").select("id, full_name, username").eq("role", "siswa").eq("is_active", true).order("full_name").limit(1000),
    isAdmin ? supabase.from("profiles").select("id, full_name").eq("role", "mentor").order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const students = (members ?? [])
    .map((m) => m.profiles as unknown as Profile)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const memberIds = new Set(students.map((s) => s.id));
  const candidates = (allStudents ?? []).filter((s) => !memberIds.has(s.id));
  const mentorName = (cls.profiles as unknown as { full_name: string } | null)?.full_name;

  return (
    <div>
      <PageHeader
        back={{ href: "/mentor/kelas", label: "Semua kelas" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {cls.name} {!cls.is_active && <Badge className="bg-rose-50 text-rose-700">Nonaktif</Badge>}
          </span>
        }
        desc={[cls.description, mentorName && `Mentor: ${mentorName}`].filter(Boolean).join(" · ") || undefined}
        action={
          <>
            <DialogButton
              variant="outline"
              title="Ubah Kelas"
              label={
                <>
                  <Pencil className="size-4" /> Ubah
                </>
              }
            >
              <ActionForm action={updateClass} closeOnSuccess className="space-y-4">
                <input type="hidden" name="id" value={cls.id} />
                <Field label="Nama kelas">
                  <Input name="name" defaultValue={cls.name} required />
                </Field>
                <Field label="Deskripsi">
                  <Textarea name="description" defaultValue={cls.description ?? ""} rows={3} />
                </Field>
                {isAdmin && (
                  <Field label="Mentor pengampu">
                    <Select name="mentor_id" defaultValue={cls.mentor_id ?? ""}>
                      <option value="">— Tanpa mentor —</option>
                      {(mentors ?? []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Checkbox name="is_active" defaultChecked={cls.is_active} label="Kelas aktif" desc="Kelas nonaktif tidak bisa diakses siswa" />
                <div className="flex justify-end">
                  <SubmitButton>Simpan</SubmitButton>
                </div>
              </ActionForm>
            </DialogButton>
            <ConfirmAction action={deleteClass} hidden={{ id: cls.id }} variant="outline" size="md" confirm={`Hapus kelas "${cls.name}" beserta SEMUA materi, soal, dan nilai di dalamnya? Tindakan ini tidak bisa dibatalkan.`}>
              <Trash2 className="size-4 text-rose-600" />
            </ConfirmAction>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Materi */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Materi pembelajaran"
            desc="Setiap materi otomatis memiliki Pre-test, Kuis Formatif, dan Post-test."
            action={
              <DialogButton
                size="sm"
                title="Materi Baru"
                label={
                  <>
                    <Plus className="size-4" /> Materi
                  </>
                }
              >
                <ActionForm action={createMaterial} className="space-y-4">
                  <input type="hidden" name="class_id" value={cls.id} />
                  <Field label="Judul materi">
                    <Input name="title" required placeholder="contoh: Ekosistem dan Rantai Makanan" />
                  </Field>
                  <Field label="Deskripsi singkat (opsional)">
                    <Textarea name="description" rows={3} />
                  </Field>
                  <div className="flex justify-end">
                    <SubmitButton>Buat Materi</SubmitButton>
                  </div>
                </ActionForm>
              </DialogButton>
            }
          />
          <div className="divide-y divide-slate-100">
            {((materials ?? []) as (Material & { assessments: Pick<Assessment, "id" | "type" | "question_count" | "is_open">[] })[]).map((m, i) => (
              <Link key={m.id} href={`/mentor/materi/${m.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-50">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 font-bold text-slate-600">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{m.title}</p>
                    {m.is_published ? (
                      <Badge className="bg-emerald-50 text-emerald-700">
                        <Eye className="size-3" /> Publik
                      </Badge>
                    ) : (
                      <Badge>
                        <EyeOff className="size-3" /> Draf
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {STAGE_ORDER.map((t) => {
                      const a = m.assessments.find((x) => x.type === t);
                      return (
                        <span key={t} className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${STAGE[t].soft}`}>
                          {STAGE[t].short}: {a?.question_count ?? 0} soal
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span className="text-sm font-semibold text-brand-600">Kelola →</span>
              </Link>
            ))}
            {!materials?.length && (
              <div className="p-5">
                <EmptyState icon={<BookOpen className="size-6" />} title="Belum ada materi" desc="Tambahkan materi pertama untuk kelas ini." />
              </div>
            )}
          </div>
        </Card>

        {/* QR gabung */}
        <Card>
          <CardHeader title="Gabung kelas" desc="Siswa scan QR ini atau masukkan kode" />
          <div className="flex flex-col items-center gap-4 p-5">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kode kelas</p>
              <p className="font-mono text-4xl font-extrabold tracking-[0.25em] text-brand-700">{cls.code}</p>
            </div>
            <QrDisplay path={`/join/${cls.code}`} size={180} filename={`qr-kelas-${cls.code}`} />
            <ConfirmAction action={regenerateClassCode} hidden={{ id: cls.id }} variant="ghost" confirm="Buat kode baru? Kode & QR lama tidak berlaku lagi.">
              <RefreshCw className="size-4" /> Ganti kode
            </ConfirmAction>
          </div>
        </Card>
      </div>

      {/* Siswa */}
      <Card className="mt-6">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Users className="size-5 text-slate-400" /> Siswa ({students.length})
            </span>
          }
          action={
            <div className="flex flex-wrap gap-2">
              <DialogButton
                variant="outline"
                size="sm"
                title="Tambah siswa terdaftar"
                desc="Pilih siswa yang sudah memiliki akun"
                label={
                  <>
                    <UserPlus className="size-4" /> Pilih siswa
                  </>
                }
              >
                <StudentPicker classId={cls.id} students={candidates} />
              </DialogButton>
              <DialogButton
                variant="outline"
                size="sm"
                wide
                title="Import siswa massal"
                desc="Akun baru dibuat otomatis lalu dimasukkan ke kelas ini"
                label={
                  <>
                    <FileUp className="size-4" /> Import
                  </>
                }
              >
                <ActionForm action={importStudents} closeOnSuccess className="space-y-4">
                  <input type="hidden" name="class_id" value={cls.id} />
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-ink">Format: satu siswa per baris</p>
                    <p className="mt-1">
                      <code>nama, username/NIS, password</code> — pemisah koma, titik koma, atau tab (bisa langsung tempel dari Excel). Password boleh dikosongkan: default sama dengan username (ditambah
                      &quot;123&quot; bila kurang dari 6 karakter).
                    </p>
                  </div>
                  <Textarea name="rows" rows={10} required className="font-mono text-xs" placeholder={"Andi Saputra, 22101\nBunga Lestari, 22102, rahasia123\nCitra Dewi, 22103"} />
                  <div className="flex justify-end">
                    <SubmitButton pendingText="Mengimpor...">Import Siswa</SubmitButton>
                  </div>
                </ActionForm>
              </DialogButton>
              <UserFormDialog mode="create" allowRoles={["siswa"]} classId={cls.id} triggerLabel="Siswa baru" />
              <LinkButton href={`/mentor/kelas/${cls.id}/kartu`} variant="secondary" size="sm">
                <Printer className="size-4" /> Cetak kartu QR
              </LinkButton>
            </div>
          }
        />
        {students.length ? (
          <Table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>NIS</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.full_name} />
                      <span className="font-semibold">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs">{s.username ?? "-"}</td>
                  <td className="text-slate-600">{s.nis ?? "-"}</td>
                  <td>{s.is_active ? <Badge className="bg-emerald-50 text-emerald-700">Aktif</Badge> : <Badge className="bg-rose-50 text-rose-700">Nonaktif</Badge>}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <UserFormDialog mode="edit" user={s} allowRoles={["siswa"]} />
                      <ConfirmAction action={resetLoginToken} hidden={{ id: s.id }} confirm={`Reset QR kartu login ${s.full_name}? Kartu lama tidak bisa dipakai lagi.`}>
                        <QrCode className="size-4 text-brand-600" />
                      </ConfirmAction>
                      <ConfirmAction action={removeMember} hidden={{ class_id: cls.id, student_id: s.id }} confirm={`Keluarkan ${s.full_name} dari kelas? (akun & nilai tidak terhapus)`}>
                        <UserMinus className="size-4 text-rose-600" />
                      </ConfirmAction>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState icon={<Users className="size-6" />} title="Belum ada siswa" desc="Bagikan kode/QR kelas, import dari Excel, atau tambahkan siswa satu per satu." />
          </div>
        )}
      </Card>
    </div>
  );
}

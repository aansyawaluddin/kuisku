import Link from "next/link";
import type { Metadata } from "next";
import { Ban, CheckCircle2, Search, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/form-bits";
import { Avatar, Badge, Card, Input, PageHeader, Table } from "@/components/ui";
import { UserFormDialog } from "@/components/user-form";
import { deleteUser, toggleActive } from "@/lib/actions/users";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";
import { cn, formatDate, ROLE_LABEL } from "@/lib/utils";

export const metadata: Metadata = { title: "Pengguna" };

const ROLE_BADGE: Record<Role, string> = {
  superadmin: "bg-ink text-white",
  mentor: "bg-brand-100 text-brand-700",
  siswa: "bg-sky-100 text-sky-700",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string; page?: string }> }) {
  const me = await requireProfile(["superadmin"]);
  const { role, q, page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const perPage = 25;
  const supabase = await createClient();

  let query = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (role && ["superadmin", "mentor", "siswa"].includes(role)) query = query.eq("role", role);
  if (q) {
    const s = q.replace(/[%,()]/g, "");
    query = query.or(`full_name.ilike.%${s}%,username.ilike.%${s}%,email.ilike.%${s}%,nis.ilike.%${s}%`);
  }
  const { data, count } = await query.range((page - 1) * perPage, page * perPage - 1);
  const users = (data ?? []) as Profile[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  const tabs = [
    { k: "", label: "Semua" },
    { k: "superadmin", label: "Superadmin" },
    { k: "mentor", label: "Mentor" },
    { k: "siswa", label: "Siswa" },
  ];
  const href = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { role, q, ...p };
    Object.entries(merged).forEach(([k, v]) => v && sp.set(k, v));
    return `/admin/pengguna?${sp.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Pengguna" desc={`${count ?? 0} akun terdaftar`} action={<UserFormDialog mode="create" allowRoles={["siswa", "mentor", "superadmin"]} defaultRole={(role as Role) || "mentor"} />} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {tabs.map((t) => (
            <Link
              key={t.k}
              href={href({ role: t.k || undefined, page: undefined })}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", (role ?? "") === t.k ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="relative w-full sm:w-72" action="/admin/pengguna">
          {role && <input type="hidden" name="role" value={role} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input name="q" defaultValue={q} placeholder="Cari nama, username, email..." className="pl-9" />
        </form>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={cn(!u.is_active && "opacity-60")}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.full_name} />
                    <div>
                      <p className="font-semibold">{u.full_name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="font-mono text-xs">{u.username ?? "-"}</td>
                <td>
                  <Badge className={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                </td>
                <td>{u.is_active ? <Badge className="bg-emerald-50 text-emerald-700">Aktif</Badge> : <Badge className="bg-rose-50 text-rose-700">Nonaktif</Badge>}</td>
                <td className="text-slate-500">{formatDate(u.created_at, false)}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <UserFormDialog mode="edit" user={u} allowRoles={["siswa", "mentor", "superadmin"]} />
                    {u.id !== me.id && (
                      <>
                        <ConfirmAction action={toggleActive} hidden={{ id: u.id }} confirm={u.is_active ? `Nonaktifkan ${u.full_name}?` : undefined}>
                          {u.is_active ? <Ban className="size-4 text-amber-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
                        </ConfirmAction>
                        <ConfirmAction action={deleteUser} hidden={{ id: u.id }} confirm={`Hapus PERMANEN akun ${u.full_name}? Semua nilai & riwayat pengerjaannya ikut terhapus dan tidak bisa dikembalikan.`}>
                          <Trash2 className="size-4 text-rose-600" />
                        </ConfirmAction>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  Tidak ada pengguna ditemukan
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link className="rounded-lg border px-3 py-1 font-semibold hover:bg-slate-50" href={href({ page: String(page - 1) })}>
                  Sebelumnya
                </Link>
              )}
              {page < totalPages && (
                <Link className="rounded-lg border px-3 py-1 font-semibold hover:bg-slate-50" href={href({ page: String(page + 1) })}>
                  Berikutnya
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

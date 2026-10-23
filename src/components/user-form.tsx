"use client";

import { useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { ActionForm, SubmitButton } from "./form-bits";
import { Modal } from "./modal";
import { Button, Field, Input, Select } from "./ui";
import { createUser, updateUser } from "@/lib/actions/users";
import type { Profile, Role } from "@/lib/types";

export function UserFormDialog({
  mode,
  user,
  allowRoles,
  defaultRole = "siswa",
  classId,
  triggerLabel,
}: {
  mode: "create" | "edit";
  user?: Profile;
  allowRoles: Role[];
  defaultRole?: Role;
  classId?: string;
  triggerLabel?: string;
}) {
  const [role, setRole] = useState<Role>(user?.role ?? defaultRole);
  const isStudent = role === "siswa";
  return (
    <Modal
      title={mode === "create" ? "Tambah Pengguna" : "Ubah Pengguna"}
      desc={mode === "create" ? (isStudent ? "Siswa login memakai username/NIS dan password, atau scan kartu QR." : "Mentor & admin login memakai email.") : user?.email ?? undefined}
      trigger={(open) =>
        mode === "create" ? (
          <Button onClick={open}>
            <UserPlus className="size-4" /> {triggerLabel ?? "Tambah Pengguna"}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={open} aria-label="Ubah">
            <Pencil className="size-4" />
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={mode === "create" ? createUser : updateUser} onSuccess={close} className="space-y-4">
          {user && <input type="hidden" name="id" value={user.id} />}
          {classId && <input type="hidden" name="class_id" value={classId} />}
          {allowRoles.length > 1 ? (
            <Field label="Role">
              <Select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {allowRoles.map((r) => (
                  <option key={r} value={r}>
                    {r === "superadmin" ? "Superadmin" : r === "mentor" ? "Mentor" : "Siswa"}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="role" value={role} />
          )}
          <Field label="Nama lengkap">
            <Input name="full_name" defaultValue={user?.full_name} required placeholder="Nama sesuai data sekolah" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isStudent ? "Username / NIS" : "Username (opsional)"} hint="Huruf kecil, angka, titik, garis bawah">
              <Input name="username" defaultValue={user?.username ?? ""} required={isStudent && mode === "create"} placeholder={isStudent ? "22101" : "budi.guru"} />
            </Field>
            <Field label="NIS / NIP (opsional)">
              <Input name="nis" defaultValue={user?.nis ?? ""} />
            </Field>
          </div>
          {mode === "create" && (
            <Field label={isStudent ? "Email (opsional)" : "Email"} hint={isStudent ? "Kosongkan jika siswa tidak punya email" : undefined}>
              <Input name="email" type="email" required={!isStudent} placeholder="nama@sekolah.id" />
            </Field>
          )}
          <Field label={mode === "create" ? "Password" : "Password baru"} hint={mode === "edit" ? "Kosongkan jika tidak ingin mengubah password" : "Minimal 6 karakter"}>
            <Input name="password" type="text" minLength={6} required={mode === "create"} autoComplete="new-password" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Batal
            </Button>
            <SubmitButton>{mode === "create" ? "Buat Akun" : "Simpan"}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Modal>
  );
}

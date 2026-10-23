"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ActionForm, SubmitButton } from "./form-bits";
import { Input } from "./ui";
import { addMembers } from "@/lib/actions/academic";

export function StudentPicker({ classId, students }: { classId: string; students: { id: string; full_name: string; username: string | null }[] }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return students.filter((x) => !s || x.full_name.toLowerCase().includes(s) || x.username?.includes(s)).slice(0, 200);
  }, [q, students]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <ActionForm action={addMembers} closeOnSuccess className="space-y-3">
      <input type="hidden" name="class_id" value={classId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="student_id" value={id} />
      ))}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau username" className="pl-9" />
      </div>
      <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
        {filtered.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
            <input type="checkbox" className="size-4 accent-brand-600" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
            <span className="flex-1 text-sm font-medium">{s.full_name}</span>
            <span className="font-mono text-xs text-slate-500">{s.username}</span>
          </label>
        ))}
        {!filtered.length && <p className="p-6 text-center text-sm text-slate-500">Tidak ada siswa yang bisa ditambahkan</p>}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{selected.size} dipilih</span>
        <SubmitButton disabled={!selected.size}>Tambahkan</SubmitButton>
      </div>
    </ActionForm>
  );
}

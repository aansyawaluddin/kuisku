import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getNGainReport } from "@/lib/reports";
import { toCsv } from "@/lib/utils";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getProfile();
  if (!me || !["mentor", "superadmin"].includes(me.role)) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const report = await getNGainReport(id);
  if (!report) return new NextResponse("Not found", { status: 404 });
  const fmt = (n: number | null) => (n === null ? "" : Number(n.toFixed(2)));
  const csv = toCsv([
    ["No", "Nama", "NIS", "Username", "Pre-test", "Formatif Terbaik", "Jumlah Formatif", "Post-test", "N-Gain", "Kategori", "Ketuntasan"],
    ...report.rows.map((r, i) => [
      i + 1,
      r.full_name,
      r.nis,
      r.username,
      fmt(r.pre),
      fmt(r.formatifBest),
      r.formatifCount,
      fmt(r.post),
      r.gain === null ? "" : r.gain.toFixed(2),
      r.category,
      r.postPassed === null ? "Belum" : r.postPassed ? "Tuntas" : "Remedial",
    ]),
  ]);
  const name = `ngain-${report.material.title.replace(/[^\w-]+/g, "_").slice(0, 40)}.csv`;
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}

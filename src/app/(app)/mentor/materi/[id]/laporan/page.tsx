import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, Gauge, Target, TrendingUp } from "lucide-react";
import { PrePostChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, CardHeader, PageHeader, StatCard, Table, buttonClass } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { getNGainReport } from "@/lib/reports";
import { formatScore, nGainCategory, nGainEffectiveness } from "@/lib/utils";

export const metadata: Metadata = { title: "Laporan N-Gain" };

export default async function NGainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(["mentor", "superadmin"]);
  const report = await getNGainReport(id);
  if (!report) notFound();
  const { material, rows, summary } = report;
  const gainPct = summary.avgGain === null ? null : summary.avgGain * 100;

  return (
    <div>
      <PageHeader
        back={{ href: `/mentor/materi/${material.id}`, label: material.title }}
        title="Laporan N-Gain"
        desc={`${material.classes.name} · Peningkatan dari Pre-test (nilai awal) ke Post-test (nilai terbaik)`}
        action={
          <div className="no-print flex gap-2">
            <a href={`/api/export/materi/${material.id}`} className={buttonClass("outline")}>
              <Download className="size-4" /> Export CSV
            </a>
            <PrintButton />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rata-rata Pre-test" value={formatScore(summary.avgPre)} icon={<Gauge className="size-5" />} tone="sky" />
        <StatCard label="Rata-rata Post-test" value={formatScore(summary.avgPost)} icon={<TrendingUp className="size-5" />} tone="emerald" />
        <StatCard
          label="Rata-rata N-Gain"
          value={summary.avgGain === null ? "-" : summary.avgGain.toFixed(2)}
          hint={summary.avgGain === null ? `${summary.complete} siswa lengkap` : `${gainPct!.toFixed(1)}% · ${nGainEffectiveness(gainPct)} · Kategori ${nGainCategory(summary.avgGain).label}`}
          icon={<TrendingUp className="size-5" />}
          tone="amber"
        />
        <StatCard label={`Tuntas Post-test (KKM ${summary.kkm})`} value={`${summary.passed}/${summary.total}`} icon={<Target className="size-5" />} tone="brand" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pre-test vs Post-test per siswa" />
          <div className="p-4">
            {rows.some((r) => r.pre !== null || r.post !== null) ? (
              <PrePostChart data={rows.map((r) => ({ name: r.full_name.split(" ")[0], pre: r.pre, post: r.post }))} />
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">Belum ada data nilai</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Kategori N-Gain" desc="Hake (1999)" />
          <div className="space-y-3 p-5">
            {[
              { label: "Tinggi", desc: "g ≥ 0,70", v: summary.tinggi, cls: "bg-emerald-500" },
              { label: "Sedang", desc: "0,30 ≤ g < 0,70", v: summary.sedang, cls: "bg-amber-500" },
              { label: "Rendah", desc: "g < 0,30", v: summary.rendah, cls: "bg-rose-500" },
            ].map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold">
                    {c.label} <span className="font-normal text-slate-500">({c.desc})</span>
                  </span>
                  <span className="font-bold">{c.v}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${c.cls}`} style={{ width: `${summary.complete ? (c.v / summary.complete) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <b>Rumus:</b> g = (Post − Pre) / (100 − Pre).
              <br />
              <b>Tafsiran efektivitas (%):</b> &lt;40 tidak efektif · 40–55 kurang efektif · 56–75 cukup efektif · &gt;75 efektif.
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Rekap per siswa" />
        <Table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>Pre-test</th>
              <th>Formatif (terbaik)</th>
              <th>Post-test</th>
              <th>N-Gain</th>
              <th>Kategori</th>
              <th>Ketuntasan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const cat = nGainCategory(r.gain);
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>
                    <p className="font-semibold">{r.full_name}</p>
                    <p className="text-xs text-slate-500">{r.nis ?? r.username}</p>
                  </td>
                  <td className="font-semibold text-sky-700">{formatScore(r.pre)}</td>
                  <td className="text-amber-700">
                    {formatScore(r.formatifBest)}
                    {r.formatifCount > 0 && <span className="ml-1 text-xs text-slate-400">({r.formatifCount}×)</span>}
                  </td>
                  <td className="font-semibold text-emerald-700">{formatScore(r.post)}</td>
                  <td className="font-bold">{r.gain === null ? "-" : r.gain.toFixed(2)}</td>
                  <td>
                    <Badge className={cat.cls}>{cat.label}</Badge>
                  </td>
                  <td>
                    {r.postPassed === null ? (
                      <Badge>Belum</Badge>
                    ) : r.postPassed ? (
                      <Badge className="bg-emerald-50 text-emerald-700">Tuntas</Badge>
                    ) : (
                      <Badge className="bg-rose-50 text-rose-700">Remedial</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Belum ada siswa
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

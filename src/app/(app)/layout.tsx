import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <AppShell role={profile.role} name={profile.full_name || profile.username || "Pengguna"}>
      {children}
    </AppShell>
  );
}

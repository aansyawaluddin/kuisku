import { requireProfile } from "@/lib/auth";

export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await requireProfile(["siswa"]);
  return <>{children}</>;
}

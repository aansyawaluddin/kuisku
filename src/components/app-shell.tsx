"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BookOpenCheck,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  ScanLine,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { Logo } from "./logo";
import { Avatar } from "./ui";
import { cn, ROLE_LABEL } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { logout } from "@/app/login/actions";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV: Record<Role, NavItem[]> = {
  superadmin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/pengguna", label: "Pengguna", icon: Users },
    { href: "/mentor/kelas", label: "Kelas & Materi", icon: School },
    { href: "/profil", label: "Profil", icon: UserCircle },
  ],
  mentor: [
    { href: "/mentor", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/mentor/kelas", label: "Kelas & Materi", icon: School },
    { href: "/profil", label: "Profil", icon: UserCircle },
  ],
  siswa: [
    { href: "/siswa", label: "Beranda", icon: BookOpenCheck, exact: true },
    { href: "/siswa/scan", label: "Scan QR", icon: ScanLine },
    { href: "/siswa/riwayat", label: "Riwayat", icon: History },
    { href: "/profil", label: "Profil", icon: UserCircle },
  ],
};

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  if (item.href === "/mentor/kelas") return pathname.startsWith("/mentor/") && pathname !== "/mentor";
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppShell({ role, name, children }: { role: Role; name: string; children: ReactNode }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (o: boolean) => setOpenAt(o ? pathname : null);
  const items = NAV[role];

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              active ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
            )}
          >
            <item.icon className="size-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABEL[role]}</p>
        </div>
      </div>
      <form action={logout} className="mt-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 text-sm font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
          <LogOut className="size-4" /> Keluar
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-slate-200 bg-white p-4 lg:flex">
        <div>
          <Link href="/dashboard" className="mb-8 block px-2 pt-2">
            <Logo />
          </Link>
          {nav}
        </div>
        {userBox}
      </aside>

      {/* Topbar mobile */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl hover:bg-slate-100" aria-label="Menu">
          <Menu className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col justify-between bg-white p-4 shadow-xl">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="Tutup">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </div>
            {userBox}
          </div>
        </div>
      )}

      <main className="print-area mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">{children}</main>

      {/* Bottom nav siswa (mobile) */}
      {role === "siswa" && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const isScan = item.href === "/siswa/scan";
            return (
              <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-brand-600" : "text-slate-500")}>
                {isScan ? (
                  <span className="-mt-6 grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/40">
                    <item.icon className="size-5" />
                  </span>
                ) : (
                  <item.icon className="size-5" />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

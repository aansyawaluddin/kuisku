import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KuisKu — Digitalisasi Quiz", template: "%s · KuisKu" },
  description: "Platform pre-test, kuis formatif, dan post-test dalam satu alur materi pembelajaran.",
};

export const viewport: Viewport = {
  themeColor: "#4646c2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-dvh">
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}

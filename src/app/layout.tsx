import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-plus-jakarta",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "TaskFlow",
  description:
    "Ứng dụng quản lý công việc kiểu Kanban với bảng, danh sách và thẻ.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={`${plusJakarta.variable} ${sora.variable} font-sans`}>
        <Providers>
          <header className="sticky top-0 z-40 border-b border-border/80 bg-card/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 font-display text-sm font-bold text-white shadow-sm">
                  TF
                </span>
                <span className="font-display text-xl font-semibold tracking-tight text-foreground">
                  TaskFlow
                </span>
              </Link>
              <AppNav />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

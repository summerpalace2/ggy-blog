import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "GGY 的博客",
  description: "用思考丈量世界",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <Header />
          <main className="min-h-screen pt-16">{children}</main>
          <footer className="mt-24 pb-12 border-t" style={{ borderColor: "var(--border-light)" }}>
            <div className="max-w-3xl mx-auto px-6 pt-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>&copy; 2026 GGY</p>
                <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>用思考丈量世界</p>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}

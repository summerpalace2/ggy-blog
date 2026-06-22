"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const { data: session } = useSession();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "var(--bg-header)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      <nav className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/blog" className="font-sans text-base font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            GGY
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/blog" className="btn-ghost text-xs sm:text-sm">首页</Link>
            <Link href="/category" className="btn-ghost text-xs sm:text-sm">分类</Link>
            <Link href="/about" className="btn-ghost text-xs sm:text-sm">关于</Link>
            {session?.user?.role === "admin" && (
              <>
                <Link href="/write" className="btn-ghost text-xs sm:text-sm">写文章</Link>
                <Link href="/admin" className="btn-ghost text-xs sm:text-sm">管理</Link>
              </>
            )}
            {session ? (
              <button onClick={() => signOut({ callbackUrl: "/blog" })} className="btn-ghost text-xs sm:text-sm">
                {session.user?.name} ▾
              </button>
            ) : (
              <Link href="/login" className="btn-ghost text-xs sm:text-sm">登录</Link>
            )}
          </div>
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}

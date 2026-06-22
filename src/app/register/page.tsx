"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "注册失败");
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="max-w-sm mx-auto px-6 py-20">
      <h1 className="font-sans text-2xl font-bold mb-8 text-center">注册</h1>
      <form onSubmit={handleRegister} className="card p-6 space-y-4">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名（至少2位）" autoFocus
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码（至少4位）"
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        {error && <p className="font-sans text-xs text-red-500">{error}</p>}
        <button disabled={loading} className="w-full py-2 rounded-lg font-sans text-sm font-medium"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
          {loading ? "注册中…" : "注册"}
        </button>
        <p className="font-sans text-xs text-center" style={{ color: "var(--text-muted)" }}>
          已有账号？<Link href="/login" className="hover:underline" style={{ color: "var(--accent)" }}>登录</Link>
        </p>
      </form>
    </div>
  );
}

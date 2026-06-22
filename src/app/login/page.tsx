"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("用户名或密码错误");
    else router.push("/blog");
  };

  return (
    <div className="max-w-sm mx-auto px-6 py-20">
      <h1 className="font-sans text-2xl font-bold mb-8 text-center">登录</h1>
      <form onSubmit={handleLogin} className="card p-6 space-y-4">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" autoFocus
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码"
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        {error && <p className="font-sans text-xs text-red-500">{error}</p>}
        <button disabled={loading} className="w-full py-2 rounded-lg font-sans text-sm font-medium"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
          {loading ? "登录中…" : "登录"}
        </button>
        <p className="font-sans text-xs text-center" style={{ color: "var(--text-muted)" }}>
          没有账号？<Link href="/register" className="hover:underline" style={{ color: "var(--accent)" }}>注册</Link>
        </p>
      </form>
    </div>
  );
}
